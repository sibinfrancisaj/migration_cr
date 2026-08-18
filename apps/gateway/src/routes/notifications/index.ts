import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody } from '../../middleware/validate.middleware.js';
import { updateNotificationPreferenceSchema } from '../../schemas/notifications/notification-preferences.schema.js';
import { notificationPreferencesController } from '../../controllers/notifications/notification-preferences.controller.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// GET /api/v1/notifications/preferences — get channel opt-out preferences (PROD-005)
notificationsRouter.get('/preferences', notificationPreferencesController.get);

// PUT /api/v1/notifications/preferences — update channel opt-out preferences (PROD-005)
notificationsRouter.put(
  '/preferences',
  validateBody(updateNotificationPreferenceSchema),
  notificationPreferencesController.update,
);
