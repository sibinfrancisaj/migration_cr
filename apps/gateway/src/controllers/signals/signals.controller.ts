import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getSignals } from '@abroad-matrimony/trust';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';

export const signalsController = {
  /**
   * GET /api/v1/signals
   * Returns engagement metrics for the authenticated user.
   */
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
};
