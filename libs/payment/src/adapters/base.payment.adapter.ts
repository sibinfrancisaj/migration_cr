import {
  CheckoutSessionParams,
  CheckoutSessionResult,
  DiamondCheckoutParams,
  RazorpayOrderParams,
  RazorpayOrderResult,
  WebhookEvent,
} from '../types/payment.types.js';

/**
 * Adapter interface for payment providers (Stripe, Razorpay, Mock).
 *
 * Stripe flow:  createCheckoutSession → user pays → Stripe webhook → processStripeWebhook
 * Razorpay flow: createOrder → Flutter Razorpay SDK → verifyOrderSignature → activate
 */
export interface PaymentAdapter {
  /**
   * Create a Stripe Checkout Session URL (subscription or one-time payment).
   * Razorpay adapter throws UnsupportedOperationError — use createOrder() instead.
   */
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;

  /**
   * Create a one-time diamond-purchase Stripe Checkout Session.
   * Razorpay adapter throws UnsupportedOperationError.
   */
  createDiamondCheckoutSession(params: DiamondCheckoutParams): Promise<CheckoutSessionResult>;

  /**
   * Create a Razorpay order. Flutter's Razorpay SDK uses the returned orderId to
   * present the payment sheet. Stripe adapter throws UnsupportedOperationError.
   */
  createOrder(params: RazorpayOrderParams): Promise<RazorpayOrderResult>;

  /**
   * Verify that `orderId|paymentId` HMAC-SHA256 matches `signature`.
   * Throws PaymentSignatureError on mismatch.
   * Used in the Razorpay capture flow — Stripe adapter is a no-op stub.
   */
  verifyOrderSignature(orderId: string, paymentId: string, signature: string): void;

  /**
   * Parse and verify a raw webhook body + provider signature.
   * Returns a normalised WebhookEvent on success; throws on invalid signature.
   */
  constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
  ): WebhookEvent;
}

export class UnsupportedOperationError extends Error {
  constructor(operation: string, provider: string) {
    super(`${operation} is not supported by ${provider} adapter`);
    this.name = 'UnsupportedOperationError';
  }
}

export class PaymentSignatureError extends Error {
  constructor() {
    super('Payment signature verification failed');
    this.name = 'PaymentSignatureError';
  }
}
