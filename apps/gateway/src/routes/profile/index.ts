import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody } from '../../middleware/validate.middleware.js';
import { createProfileSchema } from '../../schemas/profile/create-profile.schema.js';
import { profileController } from '../../controllers/profile/profile.controller.js';

export const profileRouter = Router();

// POST /api/v1/profile — create profile for the authenticated user
profileRouter.post(
  '/',
  requireAuth,
  validateBody(createProfileSchema),
  profileController.create,
);
