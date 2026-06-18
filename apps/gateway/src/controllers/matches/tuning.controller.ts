import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getEnv } from '@abroad-matrimony/config';
import {
  getMatchTuning,
  setMatchTuning,
  getTuningAsQuestions,
  setTuningFromQuestions,
  computeTuningImpact,
  enqueueScoreRecompute,
} from '@abroad-matrimony/matching';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';
import type {
  SetMatchTuningBody,
  MatchTuningQuestionsBody,
  TuningImpactQuery,
} from '../../schemas/matches/matches.schema.js';

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
   * Triggers a background score recompute job (ALG-013).
   */
  async set(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:matches:tuning:set', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { weights } = req.body as SetMatchTuningBody;

      log.info('Set match tuning', { userId, keys: Object.keys(weights) });

      const dto = await setMatchTuning(userId, weights);

      // ALG-013: fire-and-forget recompute job
      const { REDIS_URL } = getEnv();
      enqueueScoreRecompute(REDIS_URL, { triggeredBy: userId }).catch((err: unknown) => {
        log.warn('Failed to enqueue score recompute after tuning update', { err });
      });

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

  /**
   * GET /api/v1/profile/match-tuning
   * Get current tuning expressed as 2 importance ratings (ALG-011).
   */
  async getQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:matches:tuning:getQ', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get match tuning questions', { userId });

      const dto = await getTuningAsQuestions(userId);

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
   * POST /api/v1/profile/match-tuning
   * Save tuning from simplified 2-question UI. Triggers recompute (ALG-011/013).
   */
  async setQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:matches:tuning:setQ', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { settlementImportance, familyImportance } = req.body as MatchTuningQuestionsBody;

      log.info('Set match tuning questions', { userId, settlementImportance, familyImportance });

      const dto = await setTuningFromQuestions(userId, settlementImportance, familyImportance);

      // ALG-013: fire-and-forget recompute job
      const { REDIS_URL } = getEnv();
      enqueueScoreRecompute(REDIS_URL, { triggeredBy: userId }).catch((err: unknown) => {
        log.warn('Failed to enqueue score recompute after question tuning', { err });
      });

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: 'Preferences saved' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/profile/match-tuning/impact
   * Preview rank changes from proposed tuning answers (ALG-012).
   */
  async getImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:matches:tuning:impact', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { settlementImportance, familyImportance } = req.query as unknown as TuningImpactQuery;

      log.info('Compute tuning impact', { userId, settlementImportance, familyImportance });

      const dto = await computeTuningImpact(userId, settlementImportance, familyImportance);

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
