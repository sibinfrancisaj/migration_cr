import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import { messagesController } from '../../controllers/messages/messages.controller.js';
import { flagMessageBodySchema } from '../../schemas/messages/flag.schema.js';
import { z } from 'zod';

const msgIdParamsSchema = z.object({
  msgId: z.string().uuid('msgId must be a valid UUID'),
});

export const messagesRouter = Router();

/**
 * POST /api/v1/messages/:msgId/flag
 * Report a message to the moderation queue (MSG-005).
 */
messagesRouter.post(
  '/:msgId/flag',
  requireAuth,
  validateParams(msgIdParamsSchema),
  validateBody(flagMessageBodySchema),
  messagesController.flagMessage,
);
