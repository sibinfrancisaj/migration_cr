import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  processUnsubscribe,
  resubscribeEmail,
  UnsubscribeTokenInvalidError,
} from '@abroad-matrimony/notification';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

export const unsubscribeController = {
  /**
   * GET /api/v1/auth/unsubscribe?token=...
   * Public — no auth required. Verifies HMAC token and marks emailUnsubscribed=true.
   */
  async unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:auth:unsubscribe', requestId: req.requestId });
    try {
      const token = req.query['token'] as string | undefined;
      if (!token) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Missing token'));
        return;
      }

      const { userId } = await processUnsubscribe(token);
      log.info('Email unsubscribe processed', { userId });

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: 'You have been unsubscribed from marketing emails.' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof UnsubscribeTokenInvalidError) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Invalid or expired unsubscribe token'));
        return;
      }
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/resubscribe
   * Authenticated — lets a user re-opt in to marketing emails.
   */
  async resubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:auth:resubscribe', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      await resubscribeEmail(userId);
      log.info('Email resubscribe processed', { userId });

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: 'You have been resubscribed to marketing emails.' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },
};
