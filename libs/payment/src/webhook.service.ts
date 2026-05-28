import { prisma } from '@abroad-matrimony/db';
import { PaymentProvider, PaymentStatus } from '@abroad-matrimony/shared';
import { getEnv } from '@abroad-matrimony/config';
import { publish } from '@abroad-matrimony/event-bus';
import { CLOUD_EVENT_TYPES } from '@abroad-matrimony/shared';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getStripeAdapter, getRazorpayAdapter } from './adapters/index.js';
import {
  activateMembership,
  cancelMembership,
  markMembershipPastDue,
} from './membership.service.js';
import { creditDiamonds, DIAMOND_PACKAGES } from './diamond.service.js';
import { MembershipPlan, DiamondReason } from '@abroad-matrimony/shared';
import type { WebhookEvent } from './types/payment.types.js';

const log = createChildLogger({ module: 'payment:webhook' });

// ── Stripe Webhook ────────────────────────────────────────────────────────────

/**
 * PAY-002: Process a Stripe webhook payload.
 * The raw body (Buffer) and Stripe-Signature header are required for
 * signature verification via stripe.webhooks.constructEvent().
 */
export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  const env = getEnv();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    log.warn('STRIPE_WEBHOOK_SECRET not set — skipping webhook processing');
    return;
  }

  const event = getStripeAdapter().constructWebhookEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );

  log.info('Processing Stripe webhook', { type: event.type });

  switch (event.type) {
    case 'payment.succeeded':
      await _handleStripePaymentSucceeded(event);
      break;

    case 'payment.failed':
      await _handleStripePaymentFailed(event);
      break;

    case 'subscription.cancelled':
      if (event.subscriptionId) {
        await cancelMembership(event.subscriptionId);
      }
      break;

    default:
      log.debug('Unhandled Stripe webhook event type', { type: event.type });
  }
}

// ── Razorpay Webhook ──────────────────────────────────────────────────────────

/**
 * PAY-004: Process a Razorpay webhook payload.
 * The raw body and x-razorpay-signature header are used for HMAC verification.
 */
export async function processRazorpayWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  const env = getEnv();

  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    log.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping webhook processing');
    return;
  }

  const event = getRazorpayAdapter().constructWebhookEvent(
    rawBody,
    signature,
    env.RAZORPAY_WEBHOOK_SECRET,
  );

  log.info('Processing Razorpay webhook', { type: event.type });

  switch (event.type) {
    case 'payment.succeeded':
      await _handleRazorpayPaymentSucceeded(event);
      break;

    case 'payment.failed':
      await _handleRazorpayPaymentFailed(event);
      break;

    default:
      log.debug('Unhandled Razorpay webhook event type', { type: event.type });
  }
}

// ── Internal handlers ─────────────────────────────────────────────────────────

async function _handleStripePaymentSucceeded(event: WebhookEvent): Promise<void> {
  const meta = event.metadata ?? {};
  const userId = meta['userId'];
  const plan = meta['plan'];
  const type = meta['type'];       // 'diamonds' for diamond purchases
  const packageKey = meta['packageKey'];

  if (!userId) {
    log.warn('Stripe payment.succeeded missing userId in metadata', { paymentId: event.paymentId });
    return;
  }

  // Update PaymentIntent row to SUCCEEDED
  await _updatePaymentIntentStatus(event.paymentId, PaymentStatus.SUCCEEDED, event.amountPaise);

  if (type === 'diamonds' && packageKey) {
    // Diamond purchase
    const pkg = DIAMOND_PACKAGES[packageKey];
    if (pkg) {
      await creditDiamonds({
        userId,
        delta: pkg.diamonds,
        reason: DiamondReason.PURCHASE,
        metadata: { sessionId: event.paymentId, packageKey },
      });
      log.info('Diamonds credited via Stripe', { userId, diamonds: pkg.diamonds, packageKey });
    }
  } else if (plan === MembershipPlan.FOUNDING_MEMBER) {
    // Membership activation
    await activateMembership({
      userId,
      plan: MembershipPlan.FOUNDING_MEMBER,
      provider: PaymentProvider.STRIPE,
      providerSubId: event.subscriptionId,
    });

    await publish(CLOUD_EVENT_TYPES.MEMBERSHIP_ACTIVATED, { userId, plan }, `user:${userId}`);
  }

  await publish(CLOUD_EVENT_TYPES.PAYMENT_SUCCEEDED, { userId, paymentId: event.paymentId }, `user:${userId}`);
}

async function _handleStripePaymentFailed(event: WebhookEvent): Promise<void> {
  await _updatePaymentIntentStatus(event.paymentId, PaymentStatus.FAILED, event.amountPaise);

  const meta = event.metadata ?? {};
  const userId = meta['userId'];
  if (userId) {
    await publish(CLOUD_EVENT_TYPES.PAYMENT_FAILED, { userId, paymentId: event.paymentId }, `user:${userId}`);
  }

  // Mark subscription PAST_DUE when a recurring invoice fails
  if (event.subscriptionId) {
    await markMembershipPastDue(event.subscriptionId);
  }
}

async function _handleRazorpayPaymentSucceeded(event: WebhookEvent): Promise<void> {
  const meta = event.metadata ?? {};
  const userId = meta['userId'];
  const plan = meta['plan'];

  if (!userId) {
    log.warn('Razorpay payment.captured missing userId in notes', { paymentId: event.paymentId });
    return;
  }

  // Find and update the PaymentIntent (keyed on orderId stored at order creation)
  const intent = await prisma.paymentIntent.findFirst({
    where: { provider: PaymentProvider.RAZORPAY, userId, status: PaymentStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  });

  if (intent) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        amountPaise: event.amountPaise ?? intent.amountPaise,
      },
    });
  }

  if (plan === MembershipPlan.FOUNDING_MEMBER) {
    await activateMembership({
      userId,
      plan: MembershipPlan.FOUNDING_MEMBER,
      provider: PaymentProvider.RAZORPAY,
      providerSubId: event.paymentId,
    });

    await publish(CLOUD_EVENT_TYPES.MEMBERSHIP_ACTIVATED, { userId, plan }, `user:${userId}`);
  }

  await publish(CLOUD_EVENT_TYPES.PAYMENT_SUCCEEDED, { userId, paymentId: event.paymentId }, `user:${userId}`);
}

async function _handleRazorpayPaymentFailed(event: WebhookEvent): Promise<void> {
  const meta = event.metadata ?? {};
  const userId = meta['userId'];

  const intent = await prisma.paymentIntent.findFirst({
    where: { provider: PaymentProvider.RAZORPAY, userId: userId ?? '', status: PaymentStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  });

  if (intent) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  if (userId) {
    await publish(CLOUD_EVENT_TYPES.PAYMENT_FAILED, { userId, paymentId: event.paymentId }, `user:${userId}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function _updatePaymentIntentStatus(
  providerPaymentId: string,
  status: PaymentStatus,
  amountPaise?: number,
): Promise<void> {
  try {
    await prisma.paymentIntent.updateMany({
      where: { providerPaymentId },
      data: {
        status,
        ...(amountPaise !== undefined ? { amountPaise } : {}),
      },
    });
  } catch {
    log.warn('Could not update PaymentIntent status', { providerPaymentId, status });
  }
}
