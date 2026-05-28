import type { Request, Response, NextFunction } from 'express';
import {
  createMembershipCheckout,
  processStripeWebhook,
  PaymentSignatureError,
} from '@abroad-matrimony/payment';
import { createChildLogger } from '@abroad-matrimony/logger';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PAYMENT_ERRORS, PAYMENT_MESSAGES } from '../../constants/payment.constants.js';

const log = createChildLogger({ module: 'gateway:payment:stripe' });

export const stripeController = {
  /**
   * POST /api/v1/payment/stripe/checkout
   * PAY-001 — Create a Stripe Checkout Session for the FOUNDING_MEMBER plan.
   * Returns { checkoutUrl } for the Flutter WebView to open.
   */
  async createCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const email = (req.body as { email?: string }).email;

      const result = await createMembershipCheckout(userId, email);

      log.info('Stripe checkout session created', { userId, sessionId: result.sessionId, requestId: req.requestId });

      res.status(201).json({
        success: true,
        requestId: req.requestId,
        data: { checkoutUrl: result.checkoutUrl, sessionId: result.sessionId },
        message: PAYMENT_MESSAGES.CHECKOUT_CREATED,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/payment/stripe/webhook
   * PAY-002 — Stripe webhook handler. Body must be raw Buffer (express.raw middleware).
   * No auth — signature verification is the security mechanism.
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'];

      if (!signature || typeof signature !== 'string') {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Missing Stripe-Signature header');
      }

      await processStripeWebhook(req.body as Buffer, signature);

      res.status(200).json({ received: true });
    } catch (err) {
      if (err instanceof PaymentSignatureError) {
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, PAYMENT_ERRORS.INVALID_WEBHOOK_SIGNATURE));
      } else {
        log.error('Stripe webhook processing error', { error: String(err), requestId: req.requestId });
        next(err);
      }
    }
  },
};
