import Stripe from 'stripe';
import { PaymentProvider } from '@abroad-matrimony/shared';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  PaymentAdapter,
  PaymentSignatureError,
  UnsupportedOperationError,
} from '../base.payment.adapter.js';
import type {
  CheckoutSessionParams,
  CheckoutSessionResult,
  DiamondCheckoutParams,
  RazorpayOrderParams,
  RazorpayOrderResult,
  WebhookEvent,
} from '../../types/payment.types.js';

const log = createChildLogger({ module: 'payment:stripe' });

export class StripePaymentAdapter implements PaymentAdapter {
  private readonly client: Stripe;

  constructor(secretKey: string) {
    this.client = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }

  // ── Checkout session (subscription) ────────────────────────────────────────

  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    log.info('Creating Stripe checkout session', { userId: params.userId, plan: params.plan });

    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        userId: params.userId,
        plan: params.plan,
        ...(params.metadata ?? {}),
      },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    log.info('Stripe checkout session created', { sessionId: session.id, userId: params.userId });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  // ── Diamond purchase (one-time payment) ────────────────────────────────────

  async createDiamondCheckoutSession(
    params: DiamondCheckoutParams,
  ): Promise<CheckoutSessionResult> {
    log.info('Creating Stripe diamond checkout session', {
      userId: params.userId,
      packageKey: params.packageKey,
      amountPaise: params.amountPaise,
    });

    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: params.amountPaise,
            product_data: {
              name: 'Diamond Credits',
              description: `${params.packageKey} diamond package`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        userId: params.userId,
        type: 'diamonds',
        packageKey: params.packageKey,
      },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL for diamond purchase');
    }

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  // ── Razorpay stubs (not supported by Stripe adapter) ───────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createOrder(_params: RazorpayOrderParams): Promise<RazorpayOrderResult> {
    return Promise.reject(new UnsupportedOperationError('createOrder', 'Stripe'));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyOrderSignature(_orderId: string, _paymentId: string, _signature: string): void {
    throw new UnsupportedOperationError('verifyOrderSignature', 'Stripe');
  }

  // ── Webhook ─────────────────────────────────────────────────────────────────

  constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
  ): WebhookEvent {
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      log.warn('Stripe webhook signature verification failed');
      throw new PaymentSignatureError();
    }

    return this._normalise(event);
  }

  // ── Normalisation ──────────────────────────────────────────────────────────

  private _normalise(event: Stripe.Event): WebhookEvent {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: 'payment.succeeded',
          provider: PaymentProvider.STRIPE,
          paymentId: session.id,
          subscriptionId: session.subscription as string | undefined,
          amountPaise: session.amount_total ?? undefined,
          currency: session.currency ?? undefined,
          metadata: (session.metadata ?? {}) as Record<string, string>,
        };
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        return {
          type: 'payment.failed',
          provider: PaymentProvider.STRIPE,
          paymentId: invoice.id,
          subscriptionId: invoice.subscription as string | undefined,
          metadata: {},
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: 'subscription.cancelled',
          provider: PaymentProvider.STRIPE,
          paymentId: sub.id,
          subscriptionId: sub.id,
          metadata: (sub.metadata ?? {}) as Record<string, string>,
        };
      }
      default:
        // Return a neutral event for types we don't act on
        return {
          type: 'payment.failed',
          provider: PaymentProvider.STRIPE,
          paymentId: (event.data.object as { id?: string }).id ?? '',
          metadata: {},
        };
    }
  }
}
