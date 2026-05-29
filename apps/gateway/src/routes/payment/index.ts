import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody } from '../../middleware/validate.middleware.js';
import { stripeController } from '../../controllers/payment/stripe.controller.js';
import { razorpayController } from '../../controllers/payment/razorpay.controller.js';
import { membershipController } from '../../controllers/payment/membership.controller.js';
import { diamondController } from '../../controllers/payment/diamond.controller.js';
import { stripeCheckoutBodySchema } from '../../schemas/payment/stripe-checkout.schema.js';
import { razorpayOrderBodySchema } from '../../schemas/payment/razorpay-order.schema.js';
import { razorpayCaptureBodySchema } from '../../schemas/payment/razorpay-capture.schema.js';
import { diamondSpendBodySchema } from '../../schemas/payment/diamond-spend.schema.js';
import { diamondPurchaseBodySchema } from '../../schemas/payment/diamond-purchase.schema.js';

export const paymentRouter = Router();

// ── Stripe ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/payment/stripe/checkout
 * PAY-001: Create Stripe Checkout Session for FOUNDING_MEMBER plan.
 */
paymentRouter.post(
  '/stripe/checkout',
  requireAuth,
  validateBody(stripeCheckoutBodySchema),
  stripeController.createCheckout,
);

/**
 * POST /api/v1/payment/stripe/webhook
 * PAY-002: Stripe webhook (raw body — express.raw middleware applied in app.ts BEFORE express.json).
 * No auth — webhook signature is the security mechanism.
 */
paymentRouter.post('/stripe/webhook', stripeController.handleWebhook);

// ── Razorpay ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/payment/razorpay/order
 * PAY-003: Create Razorpay order, returns orderId + keyId for Flutter SDK.
 */
paymentRouter.post(
  '/razorpay/order',
  requireAuth,
  validateBody(razorpayOrderBodySchema),
  razorpayController.createOrder,
);

/**
 * POST /api/v1/payment/razorpay/capture
 * PAY-003: Verify Razorpay payment signature after Flutter SDK payment.
 */
paymentRouter.post(
  '/razorpay/capture',
  requireAuth,
  validateBody(razorpayCaptureBodySchema),
  razorpayController.capturePayment,
);

/**
 * POST /api/v1/payment/razorpay/webhook
 * PAY-004: Razorpay webhook (raw body — express.raw middleware applied in app.ts).
 * No auth — webhook signature is the security mechanism.
 */
paymentRouter.post('/razorpay/webhook', razorpayController.handleWebhook);

// ── Membership ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/payment/membership
 * PAY-005: Get current user's active membership status.
 */
paymentRouter.get('/membership', requireAuth, membershipController.getActive);

// ── Diamonds ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/payment/diamonds/balance
 * PAY-007: Get current user's diamond balance.
 */
paymentRouter.get('/diamonds/balance', requireAuth, diamondController.getBalance);

/**
 * POST /api/v1/payment/diamonds/spend
 * PAY-007: Deduct diamonds from the current user's balance.
 */
paymentRouter.post(
  '/diamonds/spend',
  requireAuth,
  validateBody(diamondSpendBodySchema),
  diamondController.spend,
);

/**
 * GET /api/v1/payment/credits/transactions
 * List the authenticated user's diamond ledger history.
 */
paymentRouter.get('/credits/transactions', requireAuth, diamondController.getTransactions);

/**
 * POST /api/v1/payment/diamonds/purchase
 * PAY-006: Create Stripe Checkout Session for a diamond credit package.
 */
paymentRouter.post(
  '/diamonds/purchase',
  requireAuth,
  validateBody(diamondPurchaseBodySchema),
  diamondController.purchase,
);
