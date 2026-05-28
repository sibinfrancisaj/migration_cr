import type { Request, Response, NextFunction } from 'express';
import {
  createRazorpayMembershipOrder,
  captureRazorpayPayment,
  processRazorpayWebhook,
  PaymentNotFoundError,
  PaymentSignatureError,
} from '@abroad-matrimony/payment';
import { createChildLogger } from '@abroad-matrimony/logger';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PAYMENT_ERRORS, PAYMENT_MESSAGES } from '../../constants/payment.constants.js';
import type { RazorpayOrderBody } from '../../schemas/payment/razorpay-order.schema.js';
import type { RazorpayCaptureBody } from '../../schemas/payment/razorpay-capture.schema.js';

const log = createChildLogger({ module: 'gateway:payment:razorpay' });

export const razorpayController = {
  /**
   * POST /api/v1/payment/razorpay/order
   * PAY-003 — Create a Razorpay order for FOUNDING_MEMBER.
   * Returns orderId + keyId for the Flutter Razorpay SDK.
   */
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { amountPaise } = req.body as RazorpayOrderBody;

      const result = await createRazorpayMembershipOrder(userId, amountPaise);

      log.info('Razorpay order created', { userId, orderId: result.orderId, requestId: req.requestId });

      res.status(201).json({
        success: true,
        requestId: req.requestId,
        data: result,
        message: PAYMENT_MESSAGES.ORDER_CREATED,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/payment/razorpay/capture
   * PAY-003 — Verify Razorpay payment signature after Flutter SDK completes payment.
   */
  async capturePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as RazorpayCaptureBody;

      await captureRazorpayPayment({
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
      });

      log.info('Razorpay payment captured', { orderId: body.razorpayOrderId, requestId: req.requestId });

      res.status(200).json({
        success: true,
        requestId: req.requestId,
        message: PAYMENT_MESSAGES.PAYMENT_CAPTURED,
      });
    } catch (err) {
      if (err instanceof PaymentSignatureError) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, PAYMENT_ERRORS.INVALID_WEBHOOK_SIGNATURE));
      } else if (err instanceof PaymentNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PAYMENT_ERRORS.PAYMENT_NOT_FOUND));
      } else {
        next(err);
      }
    }
  },

  /**
   * POST /api/v1/payment/razorpay/webhook
   * PAY-004 — Razorpay webhook handler. Body must be raw Buffer.
   * Signature in x-razorpay-signature header.
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'];

      if (!signature || typeof signature !== 'string') {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Missing x-razorpay-signature header');
      }

      await processRazorpayWebhook(req.body as Buffer, signature);

      res.status(200).json({ received: true });
    } catch (err) {
      if (err instanceof PaymentSignatureError) {
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, PAYMENT_ERRORS.INVALID_WEBHOOK_SIGNATURE));
      } else {
        log.error('Razorpay webhook processing error', { error: String(err), requestId: req.requestId });
        next(err);
      }
    }
  },
};
