import Razorpay from 'razorpay';
import crypto from 'crypto';
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

const log = createChildLogger({ module: 'payment:razorpay' });

export class RazorpayPaymentAdapter implements PaymentAdapter {
  private readonly client: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  // ── Razorpay Order ─────────────────────────────────────────────────────────

  async createOrder(params: RazorpayOrderParams): Promise<RazorpayOrderResult> {
    log.info('Creating Razorpay order', {
      userId: params.userId,
      amountPaise: params.amountPaise,
    });

    const order = await this.client.orders.create({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receiptId,
      notes: {
        userId: params.userId,
        ...(params.notes ?? {}),
      },
    });

    log.info('Razorpay order created', { orderId: order.id, userId: params.userId });

    return {
      orderId: order.id,
      amount: order.amount as number,
      currency: order.currency,
      keyId: this.keyId,
    };
  }

  // ── Signature verification (capture flow) ──────────────────────────────────

  /**
   * Verify HMAC-SHA256 of `{orderId}|{paymentId}` using the Razorpay key secret.
   * Called from the capture endpoint after Flutter completes payment.
   */
  verifyOrderSignature(orderId: string, paymentId: string, signature: string): void {
    const payload = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      log.warn('Razorpay order signature mismatch', { orderId, paymentId });
      throw new PaymentSignatureError();
    }
  }

  // ── Webhook ─────────────────────────────────────────────────────────────────

  constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
  ): WebhookEvent {
    // Razorpay webhook signature: HMAC-SHA256 of raw body using webhook secret
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expected !== signature) {
      log.warn('Razorpay webhook signature mismatch');
      throw new PaymentSignatureError();
    }

    const body = JSON.parse(
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'),
    ) as { event: string; payload: { payment?: { entity?: Record<string, unknown> } } };

    const entity = body.payload?.payment?.entity ?? {};
    const amountPaise =
      typeof entity['amount'] === 'number' ? entity['amount'] : undefined;
    const currency =
      typeof entity['currency'] === 'string' ? entity['currency'] : undefined;
    const paymentId =
      typeof entity['id'] === 'string' ? entity['id'] : '';

    switch (body.event) {
      case 'payment.captured':
        return {
          type: 'payment.succeeded',
          provider: PaymentProvider.RAZORPAY,
          paymentId,
          amountPaise,
          currency,
          metadata: this._extractNotes(entity),
        };
      case 'payment.failed':
        return {
          type: 'payment.failed',
          provider: PaymentProvider.RAZORPAY,
          paymentId,
          amountPaise,
          currency,
          metadata: this._extractNotes(entity),
        };
      default:
        return {
          type: 'payment.failed',
          provider: PaymentProvider.RAZORPAY,
          paymentId,
          metadata: {},
        };
    }
  }

  // ── Stripe stubs (not supported by Razorpay adapter) ──────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createCheckoutSession(_params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    return Promise.reject(new UnsupportedOperationError('createCheckoutSession', 'Razorpay'));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDiamondCheckoutSession(_params: DiamondCheckoutParams): Promise<CheckoutSessionResult> {
    return Promise.reject(new UnsupportedOperationError('createDiamondCheckoutSession', 'Razorpay'));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _extractNotes(entity: Record<string, unknown>): Record<string, string> {
    const notes = entity['notes'];
    if (notes && typeof notes === 'object' && !Array.isArray(notes)) {
      return Object.fromEntries(
        Object.entries(notes as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
      );
    }
    return {};
  }
}
