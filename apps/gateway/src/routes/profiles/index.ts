import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateParams } from '../../middleware/validate.middleware.js';
import { profileIdParamsSchema } from '../../schemas/profile/get-profile.schema.js';
import { profileController } from '../../controllers/profile/profile.controller.js';

export const profilesRouter = Router();

// GET /api/v1/profiles/:id — fetch a user's public profile by profile ID
profilesRouter.get(
  '/:id',
  requireAuth,
  validateParams(profileIdParamsSchema),
  profileController.getProfileById,
);
