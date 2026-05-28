import { prisma } from '@abroad-matrimony/db';
import { MembershipPlan, PaymentProvider, PaymentStatus } from '@abroad-matrimony/shared';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getStripeAdapter, getRazorpayAdapter } from './adapters/index.js';
import { DIAMOND_PACKAGES } from './diamond.service.js';
import type {
  CheckoutSessionResult,
  RazorpayOrderResult,
  RazorpayCapture,
} from './types/payment.types.js';
import { PaymentSignatureError } from './adapters/index.js';

const log = createChildLogger({ module: 'payment:checkout' });

// ── Error classes ─────────────────────────────────────────────────────────────

export class PaymentNotFoundError extends Error {
  constructor() {
    super('PAYMENT_NOT_FOUND');
    this.name = 'PaymentNotFoundError';
  }
}

export class InvalidDiamondPackageError extends Error {
  constructor(key: string) {
    super(`INVALID_DIAMOND_PACKAGE: ${key}`);
    this.name = 'InvalidDiamondPackageError';
  }
}

// ── Stripe — Membership checkout ─────────────────────────────────────────────

/**
 * PAY-001: Create a Stripe Checkout Session for the FOUNDING_MEMBER plan.
 * Returns the URL to open in a Flutter WebView.
 */
export async function createMembershipCheckout(
  userId: string,
  customerEmail?: string,
): Promise<CheckoutSessionResult> {
  const env = getEnv();

  if (!env.STRIPE_FOUNDING_MEMBER_PRICE_ID) {
    throw new Error('STRIPE_FOUNDING_MEMBER_PRICE_ID is not configured');
  }

  const successUrl = `${env.PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = env.PAYMENT_CANCEL_URL;

  const result = await getStripeAdapter().createCheckoutSession({
    userId,
    plan: MembershipPlan.FOUNDING_MEMBER,
    priceId: env.STRIPE_FOUNDING_MEMBER_PRICE_ID,
    successUrl,
    cancelUrl,
    customerEmail,
    metadata: { userId, plan: MembershipPlan.FOUNDING_MEMBER },
  });

  // Record a PENDING PaymentIntent so we can track it
  await prisma.paymentIntent.create({
    data: {
      userId,
      provider: PaymentProvider.STRIPE,
      providerPaymentId: result.sessionId,
      amountPaise: 0,   // filled in on webhook (amount unknown at session creation)
      currency: 'INR',
      status: PaymentStatus.PENDING,
      metadata: { plan: MembershipPlan.FOUNDING_MEMBER },
    },
  });

  log.info('Stripe membership checkout created', { userId, sessionId: result.sessionId });
  return result;
}

// ── Stripe — Diamond purchase ─────────────────────────────────────────────────

/**
 * PAY-006: Create a Stripe Checkout Session for a diamond credit package.
 */
export async function createDiamondCheckout(
  userId: string,
  packageKey: string,
  customerEmail?: string,
): Promise<CheckoutSessionResult> {
  const env = getEnv();
  const pkg = DIAMOND_PACKAGES[packageKey];

  if (!pkg) {
    throw new InvalidDiamondPackageError(packageKey);
  }

  const successUrl = `${env.PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = env.PAYMENT_CANCEL_URL;

  const result = await getStripeAdapter().createDiamondCheckoutSession({
    userId,
    packageKey,
    amountPaise: pkg.amountPaise,
    successUrl,
    cancelUrl,
    customerEmail,
  });

  await prisma.paymentIntent.create({
    data: {
      userId,
      provider: PaymentProvider.STRIPE,
      providerPaymentId: result.sessionId,
      amountPaise: pkg.amountPaise,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      metadata: { type: 'diamonds', packageKey, diamonds: pkg.diamonds },
    },
  });

  log.info('Stripe diamond checkout created', { userId, packageKey, sessionId: result.sessionId });
  return result;
}

// ── Razorpay — Membership order ───────────────────────────────────────────────

/**
 * PAY-003: Create a Razorpay order for the FOUNDING_MEMBER plan.
 * The client-side Razorpay Flutter SDK uses the returned orderId.
 */
export async function createRazorpayMembershipOrder(
  userId: string,
  amountPaise: number,
): Promise<RazorpayOrderResult> {
  const receiptId = `rzp_mem_${userId.slice(0, 8)}_${Date.now()}`;

  const result = await getRazorpayAdapter().createOrder({
    userId,
    amountPaise,
    currency: 'INR',
    receiptId,
    notes: { plan: MembershipPlan.FOUNDING_MEMBER, userId },
  });

  await prisma.paymentIntent.create({
    data: {
      userId,
      provider: PaymentProvider.RAZORPAY,
      providerPaymentId: result.orderId,
      amountPaise,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      metadata: { plan: MembershipPlan.FOUNDING_MEMBER },
    },
  });

  log.info('Razorpay order created', { userId, orderId: result.orderId });
  return result;
}

/**
 * PAY-003 (capture): Verify Razorpay payment signature after Flutter SDK completes payment.
 * Updates the PaymentIntent to SUCCEEDED.
 */
export async function captureRazorpayPayment(capture: RazorpayCapture): Promise<void> {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = capture;

  // Throws PaymentSignatureError on mismatch
  getRazorpayAdapter().verifyOrderSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  const intent = await prisma.paymentIntent.findFirst({
    where: { providerPaymentId: razorpayOrderId },
  });

  if (!intent) {
    throw new PaymentNotFoundError();
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { status: PaymentStatus.SUCCEEDED, providerPaymentId: razorpayPaymentId },
  });

  log.info('Razorpay payment captured', { orderId: razorpayOrderId, paymentId: razorpayPaymentId });
}

// ── Admin — Refund ────────────────────────────────────────────────────────────

/**
 * PAY-008: Mark a PaymentIntent as REFUNDED.
 * Called by the admin refund endpoint; actual refund is processed in the payment provider.
 */
export async function markPaymentRefunded(providerPaymentId: string): Promise<void> {
  const intent = await prisma.paymentIntent.findFirst({
    where: { providerPaymentId },
  });

  if (!intent) {
    throw new PaymentNotFoundError();
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { status: PaymentStatus.REFUNDED },
  });

  log.info('Payment marked as refunded', { providerPaymentId });
}

export { PaymentSignatureError };
