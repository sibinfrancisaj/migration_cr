import { PaymentProvider } from '@abroad-matrimony/shared';
import type { PaymentAdapter } from '../base.payment.adapter.js';
import type {
  CheckoutSessionParams,
  CheckoutSessionResult,
  DiamondCheckoutParams,
  RazorpayOrderParams,
  RazorpayOrderResult,
  WebhookEvent,
} from '../../types/payment.types.js';

/**
 * Mock payment adapter for development and testing.
 * Returns deterministic, configurable data without hitting real payment APIs.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    return {
      checkoutUrl: `https://checkout.mock/session/mock-session-${params.userId}`,
      sessionId: `mock-session-${params.userId}`,
    };
  }

  async createDiamondCheckoutSession(
    params: DiamondCheckoutParams,
  ): Promise<CheckoutSessionResult> {
    return {
      checkoutUrl: `https://checkout.mock/diamonds/${params.packageKey}-${params.userId}`,
      sessionId: `mock-diamond-session-${params.userId}`,
    };
  }

  async createOrder(params: RazorpayOrderParams): Promise<RazorpayOrderResult> {
    return {
      orderId: `mock_order_${params.receiptId}`,
      amount: params.amountPaise,
      currency: params.currency,
      keyId: 'rzp_test_mock',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyOrderSignature(_orderId: string, _paymentId: string, _signature: string): void {
    // Mock always passes
  }

  constructWebhookEvent(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rawBody: Buffer | string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _signature: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _secret: string,
  ): WebhookEvent {
    return {
      type: 'payment.succeeded',
      provider: PaymentProvider.STRIPE,
      paymentId: 'mock-payment-id',
      amountPaise: 99900,
      currency: 'inr',
      metadata: { userId: 'mock-user', plan: 'FOUNDING_MEMBER' },
    };
  }
}
