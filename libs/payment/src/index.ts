// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  CheckoutSessionParams,
  CheckoutSessionResult,
  DiamondCheckoutParams,
  RazorpayOrderParams,
  RazorpayOrderResult,
  RazorpayCapture,
  WebhookEvent,
  WebhookEventType,
  MembershipDto,
  DiamondBalanceDto,
  DiamondPackage,
  CreditDiamondsParams,
  ActivateMembershipParams,
} from './types/payment.types.js';

// ── Adapters ───────────────────────────────────────────────────────────────────
export {
  getStripeAdapter,
  getRazorpayAdapter,
  _resetPaymentAdapters,
  MockPaymentAdapter,
  PaymentSignatureError,
  UnsupportedOperationError,
} from './adapters/index.js';
export type { PaymentAdapter } from './adapters/index.js';

// ── Checkout ───────────────────────────────────────────────────────────────────
export {
  createMembershipCheckout,
  createDiamondCheckout,
  createRazorpayMembershipOrder,
  captureRazorpayPayment,
  markPaymentRefunded,
  PaymentNotFoundError,
  InvalidDiamondPackageError,
} from './checkout.service.js';

// ── Webhooks ───────────────────────────────────────────────────────────────────
export {
  processStripeWebhook,
  processRazorpayWebhook,
} from './webhook.service.js';

// ── Membership ─────────────────────────────────────────────────────────────────
export {
  activateMembership,
  getActiveMembership,
  cancelMembership,
  markMembershipPastDue,
  MembershipAlreadyActiveError,
} from './membership.service.js';

// ── Diamonds ───────────────────────────────────────────────────────────────────
export {
  getDiamondBalance,
  creditDiamonds,
  spendDiamonds,
  refundDiamonds,
  DIAMOND_PACKAGES,
  InsufficientDiamondsError,
} from './diamond.service.js';
