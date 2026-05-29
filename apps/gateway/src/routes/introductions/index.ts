import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  introIdParamSchema,
  introHistoryQuerySchema,
} from '../../schemas/introductions/introductions.schema.js';
import { introductionsController } from '../../controllers/introductions/introductions.controller.js';

export const introductionsRouter = Router();

introductionsRouter.use(requireAuth);

/** GET /api/v1/introductions — current week's introductions */
introductionsRouter.get('/', introductionsController.list);

/** GET /api/v1/introductions/history — past introductions */
introductionsRouter.get(
  '/history',
  validateQuery(introHistoryQuerySchema),
  introductionsController.history,
);

/** POST /api/v1/introductions/:introId/accept */
introductionsRouter.post(
  '/:introId/accept',
  validateParams(introIdParamSchema),
  introductionsController.accept,
);

/** POST /api/v1/introductions/:introId/decline */
introductionsRouter.post(
  '/:introId/decline',
  validateParams(introIdParamSchema),
  introductionsController.decline,
);
