import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  introIdParamSchema,
  introHistoryQuerySchema,
  dropIdParamSchema,
} from '../../schemas/introductions/introductions.schema.js';
import { introductionsController } from '../../controllers/introductions/introductions.controller.js';

export const introductionsRouter = Router();

introductionsRouter.use(requireAuth);

/** GET /api/v1/introductions — current week's introductions */
introductionsRouter.get('/', introductionsController.list);

// ─── Drop routes (static paths must precede /:introId/* dynamic routes) ───────

/** GET /api/v1/introductions/drops — list LIVE drops for user */
introductionsRouter.get('/drops', introductionsController.listDrops);

/** GET /api/v1/introductions/drops/:dropId — drop detail + pairings */
introductionsRouter.get(
  '/drops/:dropId',
  validateParams(dropIdParamSchema),
  introductionsController.getDropDetail,
);

/** POST /api/v1/introductions/drops/:dropId/early-access — spend earlyAccessCost diamonds */
introductionsRouter.post(
  '/drops/:dropId/early-access',
  validateParams(dropIdParamSchema),
  introductionsController.earlyAccess,
);

/** POST /api/v1/introductions/drops/:dropId/unlock — spend incremental diamonds to unlock */
introductionsRouter.post(
  '/drops/:dropId/unlock',
  validateParams(dropIdParamSchema),
  introductionsController.unlock,
);

// ─── Legacy week-key introduction routes ──────────────────────────────────────

/** GET /api/v1/introductions/history — past introductions */
introductionsRouter.get(
  '/history',
  validateQuery(introHistoryQuerySchema),
  introductionsController.history,
);

/** POST /api/v1/introductions/unlock-early — spend 300 diamonds (INTRO-004) */
introductionsRouter.post('/unlock-early', introductionsController.unlockEarly);

/** GET /api/v1/introductions/:introId — introduction detail (INTRO-003) */
introductionsRouter.get(
  '/:introId',
  validateParams(introIdParamSchema),
  introductionsController.getDetail,
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
