export const PAYMENT_ERRORS = {
  STRIPE_NOT_CONFIGURED:    'Stripe is not configured',
  RAZORPAY_NOT_CONFIGURED:  'Razorpay is not configured',
  PAYMENT_NOT_FOUND:        'Payment record not found',
  INVALID_WEBHOOK_SIGNATURE:'Invalid webhook signature',
  INVALID_DIAMOND_PACKAGE:  'Invalid diamond package key',
  INSUFFICIENT_DIAMONDS:    'Insufficient diamond balance',
  MEMBERSHIP_ALREADY_ACTIVE:'An active membership already exists',
  UNSUPPORTED_OPERATION:    'This operation is not supported by the selected payment provider',
} as const;

export const PAYMENT_MESSAGES = {
  CHECKOUT_CREATED:     'Checkout session created',
  ORDER_CREATED:        'Razorpay order created',
  PAYMENT_CAPTURED:     'Payment captured successfully',
  WEBHOOK_PROCESSED:    'Webhook processed',
  MEMBERSHIP_RETRIEVED: 'Membership retrieved',
  BALANCE_RETRIEVED:    'Diamond balance retrieved',
  DIAMONDS_SPENT:       'Diamonds deducted successfully',
  DIAMOND_PURCHASE_CREATED: 'Diamond purchase checkout created',
  REFUND_RECORDED:      'Payment refund recorded',
} as const;
