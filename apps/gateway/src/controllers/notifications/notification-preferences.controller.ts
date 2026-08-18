import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getNotificationPreferences, updateNotificationPreferences } from '@abroad-matrimony/notification';
import type { ApiResponse } from '@abroad-matrimony/shared';
import type { UpdateNotificationPreferenceBody } from '../../schemas/notifications/notification-preferences.schema.js';

export const notificationPreferencesController = {
  /**
   * GET /api/v1/notifications/preferences
   * Returns the user's notification channel preferences (defaults to all-enabled).
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:notif-prefs:get', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const prefs = await getNotificationPreferences(userId);

      const body: ApiResponse<typeof prefs> = {
        success: true,
        data: prefs,
        requestId: req.requestId,
      };
      res.status(200).json(body);
    } catch (err) {
      log.error('Failed to get notification preferences', { err });
      next(err);
    }
  },

  /**
   * PUT /api/v1/notifications/preferences
   * Upserts the user's notification channel preferences (partial update).
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:notif-prefs:update', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const input = req.body as UpdateNotificationPreferenceBody;

      const prefs = await updateNotificationPreferences(userId, input);

      log.info('Notification preferences updated', { userId });

      const body: ApiResponse<typeof prefs> = {
        success: true,
        data: prefs,
        meta: { message: 'Notification preferences updated.' },
        requestId: req.requestId,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  },
};
