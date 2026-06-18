import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateParams } from '../../middleware/validate.middleware.js';
import { profileIdParamsSchema } from '../../schemas/profile/get-profile.schema.js';
import { profileController } from '../../controllers/profile/profile.controller.js';
import { introductionsController } from '../../controllers/introductions/introductions.controller.js';
import { signalsController } from '../../controllers/signals/signals.controller.js';

export const profilesRouter = Router();

// POST /api/v1/profiles/:id/view — log a profile view (SIGNAL-001)
profilesRouter.post(
  '/:id/view',
  requireAuth,
  validateParams(profileIdParamsSchema),
  signalsController.logView,
);

// GET /api/v1/profiles/:id/match-context — score + dimension cards (INTRO-007)
profilesRouter.get(
  '/:id/match-context',
  requireAuth,
  validateParams(profileIdParamsSchema),
  introductionsController.getMatchContext,
);

// GET /api/v1/profiles/:id — fetch a user's public profile by profile ID
profilesRouter.get(
  '/:id',
  requireAuth,
  validateParams(profileIdParamsSchema),
  profileController.getProfileById,
);
