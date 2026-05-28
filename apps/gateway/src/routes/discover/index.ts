import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateQuery } from '../../middleware/validate.middleware.js';
import { discoverQuerySchema } from '../../schemas/discover/discover.schema.js';
import { discoverController } from '../../controllers/discover/discover.controller.js';

export const discoverRouter = Router();

// GET /api/v1/discover — paginated discovery feed for the authenticated user
discoverRouter.get(
  '/',
  requireAuth,
  validateQuery(discoverQuerySchema),
  discoverController.getFeed,
);
