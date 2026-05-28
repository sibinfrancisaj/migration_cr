import type { Request, Response, NextFunction } from 'express';
import { getActiveMembership } from '@abroad-matrimony/payment';
import { createChildLogger } from '@abroad-matrimony/logger';
import { PAYMENT_MESSAGES } from '../../constants/payment.constants.js';

const log = createChildLogger({ module: 'gateway:payment:membership' });

export const membershipController = {
  /**
   * GET /api/v1/payment/membership
   * PAY-005 — Return the authenticated user's active membership, or null.
   */
  async getActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const membership = await getActiveMembership(userId);

      log.info('Membership status retrieved', { userId, hasActive: !!membership, requestId: req.requestId });

      res.status(200).json({
        success: true,
        requestId: req.requestId,
        data: { membership },
        message: PAYMENT_MESSAGES.MEMBERSHIP_RETRIEVED,
      });
    } catch (err) {
      next(err);
    }
  },
};
