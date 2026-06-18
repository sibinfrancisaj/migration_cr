import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getSignals } from '@abroad-matrimony/trust';
import {
  logProfileView,
  getWeeklyMetrics,
  getActionQueue,
  getMomentumData,
  ViewSelfError,
} from '@abroad-matrimony/signals';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { SIGNALS_ERRORS, SIGNALS_MESSAGES } from '../../constants/signals.constants.js';

export const signalsController = {
  async logView(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:signals:logView', requestId: req.requestId });
    try {
      const viewerId = req.user!.id;
      const viewedId = req.params['id']!;

      log.info('Log profile view', { viewerId, viewedId });

      await logProfileView(viewerId, viewedId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: SIGNALS_MESSAGES.VIEW_LOGGED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof ViewSelfError) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, SIGNALS_ERRORS.VIEW_SELF));
        return;
      }
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:signals', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get signals', { userId });

      const dto = await getSignals(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  async getWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:signals:week', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get weekly metrics', { userId });

      const dto = await getWeeklyMetrics(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  async getActionQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:signals:action-queue', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get action queue', { userId });

      const items = await getActionQueue(userId);

      const body: ApiResponse<typeof items> = {
        success: true,
        data: items,
        meta: { total: items.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  async getMomentum(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:signals:momentum', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get momentum data', { userId });

      const data = await getMomentumData(userId);

      const body: ApiResponse<typeof data> = {
        success: true,
        data,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },
};
