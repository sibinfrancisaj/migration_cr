import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listCurrentIntroductions,
  listIntroductionHistory,
  acceptIntroduction,
  declineIntroduction,
  IntroductionNotFoundError,
  IntroductionForbiddenError,
  IntroductionExpiredError,
  IntroductionAlreadyRespondedError,
} from '@abroad-matrimony/introductions';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { INTRODUCTION_ERRORS, INTRODUCTION_MESSAGES } from '../../constants/introductions.constants.js';
import type { IntroIdParams, IntroHistoryQuery } from '../../schemas/introductions/introductions.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapIntroError(err: unknown, next: NextFunction): void {
  if (err instanceof IntroductionNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, INTRODUCTION_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof IntroductionForbiddenError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, INTRODUCTION_ERRORS.FORBIDDEN));
    return;
  }
  if (err instanceof IntroductionExpiredError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, INTRODUCTION_ERRORS.EXPIRED));
    return;
  }
  if (err instanceof IntroductionAlreadyRespondedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, INTRODUCTION_ERRORS.ALREADY_RESPONDED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const introductionsController = {
  /**
   * GET /api/v1/introductions
   * List this week's introductions for the authenticated user.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('List introductions', { userId });

      const intros = await listCurrentIntroductions(userId);

      const body: ApiResponse<typeof intros> = {
        success: true,
        data: intros,
        meta: { total: intros.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * GET /api/v1/introductions/history?page=&limit=
   * List historical introductions (all previous weeks).
   */
  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:history', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { page, limit } = req.query as unknown as IntroHistoryQuery;

      log.info('List introduction history', { userId, page, limit });

      const result = await listIntroductionHistory(userId, page, limit);

      const body: ApiResponse<typeof result.intros> = {
        success: true,
        data: result.intros,
        meta: { total: result.total, page, limit },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/:introId/accept
   * Accept an introduction.
   */
  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:accept', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { introId } = req.params as unknown as IntroIdParams;

      log.info('Accept introduction', { userId, introId });

      const dto = await acceptIntroduction(introId, userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: INTRODUCTION_MESSAGES.ACCEPTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },

  /**
   * POST /api/v1/introductions/:introId/decline
   * Decline an introduction.
   */
  async decline(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:introductions:decline', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { introId } = req.params as unknown as IntroIdParams;

      log.info('Decline introduction', { userId, introId });

      const dto = await declineIntroduction(introId, userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: INTRODUCTION_MESSAGES.DECLINED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapIntroError(err, next);
    }
  },
};
