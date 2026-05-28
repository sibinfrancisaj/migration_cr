import { MembershipPlan, MembershipStatus, PaymentProvider, DiamondReason } from '@abroad-matrimony/shared';

// ── Checkout ──────────────────────────────────────────────────────────────────

export interface CheckoutSessionParams {
  userId: string;
  plan: MembershipPlan;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  /** Additional metadata forwarded into Stripe/Razorpay session */
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  /** URL to redirect the Flutter WebView to */
  checkoutUrl: string;
  /** Provider session / order ID (stored in PaymentIntent row) */
  sessionId: string;
}

export interface DiamondCheckoutParams {
  userId: string;
  packageKey: string;
  amountPaise: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

// ── Razorpay ──────────────────────────────────────────────────────────────────

export interface RazorpayOrderParams {
  userId: string;
  amountPaise: number;
  currency: string;
  receiptId: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  /** Razorpay key ID (safe to send to client) */
  keyId: string;
}

export interface RazorpayCapture {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'subscription.cancelled'
  | 'refund.created';

export interface WebhookEvent {
  type: WebhookEventType;
  provider: PaymentProvider;
  /** Stripe checkout session ID or Razorpay payment ID */
  paymentId: string;
  /** Stripe subscription ID (subscription payments only) */
  subscriptionId?: string;
  /** Amount in paise — may be absent on cancellation events */
  amountPaise?: number;
  currency?: string;
  /** Metadata stored on the Stripe/Razorpay session */
  metadata?: Record<string, string>;
}

// ── Membership ────────────────────────────────────────────────────────────────

export interface ActivateMembershipParams {
  userId: string;
  plan: MembershipPlan;
  provider: PaymentProvider;
  providerSubId?: string;
  currentPeriodStart?: Date;
  expiresAt?: Date;
}

export interface MembershipDto {
  id: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  provider: PaymentProvider;
  providerSubId?: string | null;
  currentPeriodStart?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

// ── Diamonds ──────────────────────────────────────────────────────────────────

export interface DiamondPackage {
  packageKey: string;
  diamonds: number;
  amountPaise: number;
  currency: string;
  description: string;
}

export interface CreditDiamondsParams {
  userId: string;
  delta: number;
  reason: DiamondReason;
  metadata?: Record<string, unknown>;
}
