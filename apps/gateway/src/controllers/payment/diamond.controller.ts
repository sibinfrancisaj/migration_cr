import type { Request, Response, NextFunction } from 'express';
import {
  getDiamondBalance,
  spendDiamonds,
  createDiamondCheckout,
  InsufficientDiamondsError,
  InvalidDiamondPackageError,
  DIAMOND_PACKAGES,
} from '@abroad-matrimony/payment';
import { createChildLogger } from '@abroad-matrimony/logger';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PAYMENT_ERRORS, PAYMENT_MESSAGES } from '../../constants/payment.constants.js';
import type { DiamondSpendBody } from '../../schemas/payment/diamond-spend.schema.js';
import type { DiamondPurchaseBody } from '../../schemas/payment/diamond-purchase.schema.js';

const log = createChildLogger({ module: 'gateway:payment:diamond' });

export const diamondController = {
  /**
   * GET /api/v1/payment/diamonds/balance
   * PAY-007 — Return the authenticated user's current diamond balance.
   */
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const balance = await getDiamondBalance(userId);

      res.status(200).json({
        success: true,
        requestId: req.requestId,
        data: { userId, balance },
        message: PAYMENT_MESSAGES.BALANCE_RETRIEVED,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/payment/diamonds/spend
   * PAY-007 — Deduct diamonds from the authenticated user's balance.
   */
  async spend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { amount, reason, reference } = req.body as DiamondSpendBody;

      const newBalance = await spendDiamonds(userId, amount, reason, reference ? { reference } : undefined);

      log.info('Diamonds spent', { userId, amount, reason, requestId: req.requestId });

      res.status(200).json({
        success: true,
        requestId: req.requestId,
        data: { balance: newBalance },
        message: PAYMENT_MESSAGES.DIAMONDS_SPENT,
      });
    } catch (err) {
      if (err instanceof InsufficientDiamondsError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, PAYMENT_ERRORS.INSUFFICIENT_DIAMONDS));
      } else {
        next(err);
      }
    }
  },

  /**
   * POST /api/v1/payment/diamonds/purchase
   * PAY-006 — Create a Stripe Checkout Session for a diamond credit package.
   */
  async purchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { packageKey, email } = req.body as DiamondPurchaseBody;

      const result = await createDiamondCheckout(userId, packageKey, email);

      log.info('Diamond purchase checkout created', { userId, packageKey, sessionId: result.sessionId, requestId: req.requestId });

      res.status(201).json({
        success: true,
        requestId: req.requestId,
        data: { checkoutUrl: result.checkoutUrl, sessionId: result.sessionId },
        message: PAYMENT_MESSAGES.DIAMOND_PURCHASE_CREATED,
      });
    } catch (err) {
      if (err instanceof InvalidDiamondPackageError) {
        next(new AppError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          `${PAYMENT_ERRORS.INVALID_DIAMOND_PACKAGE}: ${(req.body as DiamondPurchaseBody).packageKey}. Valid packages: ${Object.keys(DIAMOND_PACKAGES).join(', ')}`,
        ));
      } else {
        next(err);
      }
    }
  },
};
