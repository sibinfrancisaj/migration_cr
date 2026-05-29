import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  sendConnectionSchema,
  connectionIdParamSchema,
  listConnectionsQuerySchema,
} from '../../schemas/connections/connections.schema.js';
import { connectionsController } from '../../controllers/connections/connections.controller.js';

export const connectionsRouter = Router();

// All connection routes require authentication
connectionsRouter.use(requireAuth);

/**
 * POST /api/v1/connections
 * Send a connection request to another user.
 * Rate-limited to 20 requests/day (enforced at the service layer via Redis).
 */
connectionsRouter.post(
  '/',
  validateBody(sendConnectionSchema),
  connectionsController.send,
);

/**
 * GET /api/v1/connections?status=PENDING|ACCEPTED|...
 * List all connections for the authenticated user.
 */
connectionsRouter.get(
  '/',
  validateQuery(listConnectionsQuerySchema),
  connectionsController.list,
);

/**
 * PUT /api/v1/connections/:connectionId/accept
 * Accept a pending incoming connection request.
 */
connectionsRouter.put(
  '/:connectionId/accept',
  validateParams(connectionIdParamSchema),
  connectionsController.accept,
);

/**
 * PUT /api/v1/connections/:connectionId/decline
 * Decline a pending incoming connection request.
 */
connectionsRouter.put(
  '/:connectionId/decline',
  validateParams(connectionIdParamSchema),
  connectionsController.decline,
);

/**
 * DELETE /api/v1/connections/:connectionId
 * Withdraw a pending outgoing connection request.
 */
connectionsRouter.delete(
  '/:connectionId',
  validateParams(connectionIdParamSchema),
  connectionsController.withdraw,
);
