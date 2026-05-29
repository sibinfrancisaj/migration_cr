import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getMatchTuning, setMatchTuning } from '@abroad-matrimony/matching';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';
import type { SetMatchTuningBody } from '../../schemas/matches/matches.schema.js';

export const matchTuningController = {
  /**
   * GET /api/v1/matches/tuning
   * Get the authenticated user's current match weight preferences.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:matches:tuning:get', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get match tuning', { userId });

      const dto = await getMatchTuning(userId);

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

  /**
   * PUT /api/v1/matches/tuning
   * Update the authenticated user's match weight preferences.
   */
  async set(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:matches:tuning:set', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { weights } = req.body as SetMatchTuningBody;

      log.info('Set match tuning', { userId, keys: Object.keys(weights) });

      const dto = await setMatchTuning(userId, weights);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: 'Match preferences updated' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },
};
