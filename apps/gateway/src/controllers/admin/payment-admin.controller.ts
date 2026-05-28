import type { Request, Response, NextFunction } from 'express';
import {
  markPaymentRefunded,
  refundDiamonds,
  PaymentNotFoundError,
} from '@abroad-matrimony/payment';
import { createChildLogger } from '@abroad-matrimony/logger';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PAYMENT_ERRORS, PAYMENT_MESSAGES } from '../../constants/payment.constants.js';
import type { AdminRefundBody } from '../../schemas/payment/admin-refund.schema.js';

const log = createChildLogger({ module: 'gateway:admin:payment' });

export const paymentAdminController = {
  /**
   * POST /admin/payment/refund
   * PAY-008 — Record a refund for a payment and optionally reverse diamond credits.
   * Requires SUPERADMIN role.
   */
  async refund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { providerPaymentId, reason, diamondAmount } = req.body as AdminRefundBody;
      const adminId = req.admin?.id ?? 'unknown';

      // Mark PaymentIntent as REFUNDED
      await markPaymentRefunded(providerPaymentId);

      // Reverse diamonds if applicable
      if (diamondAmount > 0) {
        // We need to find the userId from the PaymentIntent — the service handles that
        // For the ledger, we look up from the refund metadata passed in the body
        const meta = req.body as AdminRefundBody & { userId?: string };
        if (meta.userId) {
          await refundDiamonds(meta.userId, diamondAmount, { reason, refundedBy: adminId, providerPaymentId });
        }
      }

      log.info('Payment refunded', { providerPaymentId, diamondAmount, reason, adminId, requestId: req.requestId });

      res.status(200).json({
        success: true,
        requestId: req.requestId,
        message: PAYMENT_MESSAGES.REFUND_RECORDED,
      });
    } catch (err) {
      if (err instanceof PaymentNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PAYMENT_ERRORS.PAYMENT_NOT_FOUND));
      } else {
        next(err);
      }
    }
  },
};
