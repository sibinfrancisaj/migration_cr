import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getPartnerPreferences, setPartnerPreferences } from '@abroad-matrimony/matching';
import type { ApiResponse } from '@abroad-matrimony/shared';
import type { SetPartnerPreferenceBody } from '../../schemas/profile/partner-preferences.schema.js';

export const partnerPreferencesController = {
  /**
   * GET /api/v1/profile/partner-preferences
   * Returns the user's partner preference filters.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:partner-prefs:get', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const prefs = await getPartnerPreferences(userId);

      const body: ApiResponse<typeof prefs> = {
        success: true,
        data: prefs,
        requestId: req.requestId,
      };
      res.status(200).json(body);
    } catch (err) {
      log.error('Failed to get partner preferences', { err });
      next(err);
    }
  },

  /**
   * PUT /api/v1/profile/partner-preferences
   * Upserts the user's partner preference filters.
   */
  async set(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:partner-prefs:set', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const input = req.body as SetPartnerPreferenceBody;

      const prefs = await setPartnerPreferences(userId, input);

      log.info('Partner preferences updated', { userId });

      const body: ApiResponse<typeof prefs> = {
        success: true,
        data: prefs,
        meta: { message: 'Partner preferences updated.' },
        requestId: req.requestId,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  },
};
