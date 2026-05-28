import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import { conversationsController } from '../../controllers/conversations/conversations.controller.js';
import {
  messagesQuerySchema,
  convIdParamsSchema,
} from '../../schemas/conversations/messages.schema.js';
import {
  sendMessageBodySchema,
  uploadUrlQuerySchema,
} from '../../schemas/conversations/send-message.schema.js';
import { readReceiptBodySchema } from '../../schemas/conversations/read-receipt.schema.js';

export const conversationsRouter = Router();

/**
 * GET /api/v1/conversations
 * List all conversations for the authenticated user, newest-first.
 */
conversationsRouter.get('/', requireAuth, conversationsController.list);

/**
 * GET /api/v1/conversations/:convId
 * Get metadata for a single conversation.
 */
conversationsRouter.get(
  '/:convId',
  requireAuth,
  validateParams(convIdParamsSchema),
  conversationsController.getOne,
);

/**
 * GET /api/v1/conversations/:convId/messages?cursor=&limit=
 * Paginated message history (newest-first). Use cursor for older pages.
 */
conversationsRouter.get(
  '/:convId/messages',
  requireAuth,
  validateParams(convIdParamsSchema),
  validateQuery(messagesQuerySchema),
  conversationsController.getMessages,
);

/**
 * POST /api/v1/conversations/:convId/messages
 * Send a text, image, or voice message.
 * For IMAGE/VOICE, `content` must be the S3/CloudFront URL from upload-url.
 */
conversationsRouter.post(
  '/:convId/messages',
  requireAuth,
  validateParams(convIdParamsSchema),
  validateBody(sendMessageBodySchema),
  conversationsController.sendMessage,
);

/**
 * GET /api/v1/conversations/:convId/upload-url?type=image|voice&mimeType=...
 * Get a presigned S3 PUT URL for direct media upload from the client.
 */
conversationsRouter.get(
  '/:convId/upload-url',
  requireAuth,
  validateParams(convIdParamsSchema),
  validateQuery(uploadUrlQuerySchema),
  conversationsController.getUploadUrl,
);

/**
 * POST /api/v1/conversations/:convId/read
 * REST fallback for marking messages as read (MSG-004).
 * Body: { lastReadMessageId: string (UUID) }
 */
conversationsRouter.post(
  '/:convId/read',
  requireAuth,
  validateParams(convIdParamsSchema),
  validateBody(readReceiptBodySchema),
  conversationsController.markRead,
);
