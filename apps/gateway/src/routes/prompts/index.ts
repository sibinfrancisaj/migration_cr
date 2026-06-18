import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  promptIdParamSchema,
  responseIdParamSchema,
  respondToPromptSchema,
  promptResponsesQuerySchema,
  currentResponseSchema,
  currentResponsesQuerySchema,
} from '../../schemas/prompts/prompts.schema.js';
import { promptsController } from '../../controllers/prompts/prompts.controller.js';

export const promptsRouter = Router();

promptsRouter.use(requireAuth);

// ─── Static routes FIRST (before parameterised /:promptId routes) ─────────────

/** GET /api/v1/prompts — current week's prompt (no-current alias) */
promptsRouter.get('/', promptsController.getCurrent);

/** GET /api/v1/prompts/current — current week's prompt (PROMPT-002) */
promptsRouter.get('/current', promptsController.getCurrent);

/**
 * GET /api/v1/prompts/current/responses — community responses for current prompt
 * PROMPT-004 — must be BEFORE /:promptId/responses to avoid path conflict
 */
promptsRouter.get(
  '/current/responses',
  validateQuery(currentResponsesQuerySchema),
  promptsController.getCurrentResponses,
);

/**
 * POST /api/v1/prompts/current/response — submit response to current prompt
 * PROMPT-003 — static path; no conflict with /:promptId/respond (different last segment)
 */
promptsRouter.post(
  '/current/response',
  validateBody(currentResponseSchema),
  promptsController.respondToCurrent,
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

// ─── Parameterised routes AFTER static routes ─────────────────────────────────

/** POST /api/v1/prompts/:promptId/respond (original endpoint — kept for compatibility) */
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
