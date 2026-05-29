import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  promptIdParamSchema,
  responseIdParamSchema,
  respondToPromptSchema,
  promptResponsesQuerySchema,
} from '../../schemas/prompts/prompts.schema.js';
import { promptsController } from '../../controllers/prompts/prompts.controller.js';

export const promptsRouter = Router();

promptsRouter.use(requireAuth);

/** GET /api/v1/prompts — current week's prompt */
promptsRouter.get('/', promptsController.getCurrent);

/** POST /api/v1/prompts/:promptId/respond */
promptsRouter.post(
  '/:promptId/respond',
  validateParams(promptIdParamSchema),
  validateBody(respondToPromptSchema),
  promptsController.respond,
);

/** GET /api/v1/prompts/:promptId/responses */
promptsRouter.get(
  '/:promptId/responses',
  validateParams(promptIdParamSchema),
  validateQuery(promptResponsesQuerySchema),
  promptsController.getResponses,
);

/** POST /api/v1/prompts/responses/:responseId/resonate */
promptsRouter.post(
  '/responses/:responseId/resonate',
  validateParams(responseIdParamSchema),
  promptsController.resonate,
);

/** DELETE /api/v1/prompts/responses/:responseId/resonate */
promptsRouter.delete(
  '/responses/:responseId/resonate',
  validateParams(responseIdParamSchema),
  promptsController.unresonate,
);
