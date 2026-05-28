import { getEnv } from '@abroad-matrimony/config';
import type { PaymentAdapter } from './base.payment.adapter.js';
import { MockPaymentAdapter } from './mock/mock.payment.adapter.js';

// Lazy singletons — initialised on first call, reused thereafter
let _stripeAdapter: PaymentAdapter | null = null;
let _razorpayAdapter: PaymentAdapter | null = null;

/**
 * Returns a StripePaymentAdapter when STRIPE_SECRET_KEY is set,
 * otherwise a MockPaymentAdapter (local dev / CI).
 */
export function getStripeAdapter(): PaymentAdapter {
  if (_stripeAdapter) return _stripeAdapter;

  const env = getEnv();
  if (env.STRIPE_SECRET_KEY) {
    // Dynamic require keeps the real Stripe SDK out of test bundles
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StripePaymentAdapter } = require('./stripe/stripe.payment.adapter.js') as {
      StripePaymentAdapter: new (key: string) => PaymentAdapter;
    };
    _stripeAdapter = new StripePaymentAdapter(env.STRIPE_SECRET_KEY);
  } else {
    _stripeAdapter = new MockPaymentAdapter();
  }
  return _stripeAdapter;
}

/**
 * Returns a RazorpayPaymentAdapter when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set,
 * otherwise a MockPaymentAdapter.
 */
export function getRazorpayAdapter(): PaymentAdapter {
  if (_razorpayAdapter) return _razorpayAdapter;

  const env = getEnv();
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RazorpayPaymentAdapter } = require('./razorpay/razorpay.payment.adapter.js') as {
      RazorpayPaymentAdapter: new (keyId: string, keySecret: string) => PaymentAdapter;
    };
    _razorpayAdapter = new RazorpayPaymentAdapter(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET);
  } else {
    _razorpayAdapter = new MockPaymentAdapter();
  }
  return _razorpayAdapter;
}

/** Reset singletons — for testing only. */
export function _resetPaymentAdapters(): void {
  _stripeAdapter = null;
  _razorpayAdapter = null;
}

export { MockPaymentAdapter } from './mock/mock.payment.adapter.js';
export { PaymentSignatureError, UnsupportedOperationError } from './base.payment.adapter.js';
export type { PaymentAdapter } from './base.payment.adapter.js';
