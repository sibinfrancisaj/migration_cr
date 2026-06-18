import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  sendConnectionRequest,
  listConnections,
  acceptConnection,
  declineConnection,
  withdrawConnection,
  ConnectionAlreadyExistsError,
  ConnectionNotFoundError,
  ConnectionForbiddenError,
  ConnectionInvalidStatusError,
  BlockedUserError,
} from '@abroad-matrimony/connections';
import type { ApiResponse } from '@abroad-matrimony/shared';
import type { ConnectionDto } from '@abroad-matrimony/connections';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { CONNECTION_ERRORS, CONNECTION_MESSAGES } from '../../constants/connections.constants.js';
import type {
  SendConnectionBody,
  ConnectionIdParams,
  ListConnectionsQuery,
} from '../../schemas/connections/connections.schema.js';
import { ConnectionStatus } from '@abroad-matrimony/shared';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapConnectionError(err: unknown, next: NextFunction): void {
  if (err instanceof ConnectionNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, CONNECTION_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof ConnectionForbiddenError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, CONNECTION_ERRORS.FORBIDDEN));
    return;
  }
  if (err instanceof ConnectionAlreadyExistsError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, CONNECTION_ERRORS.ALREADY_EXISTS));
    return;
  }
  if (err instanceof ConnectionInvalidStatusError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, CONNECTION_ERRORS.INVALID_STATUS));
    return;
  }
  if (err instanceof BlockedUserError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, CONNECTION_ERRORS.BLOCKED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const connectionsController = {
  /**
   * POST /api/v1/connections
   *
   * Send a connection request to another user.
   * 409 if a connection already exists.
   * 403 if the other user has blocked you (or vice versa).
   */
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:connections:send', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { receiverId, message } = req.body as SendConnectionBody;

      log.info('Send connection request', { userId, receiverId });

      const dto = await sendConnectionRequest(userId, receiverId, message);

      const body: ApiResponse<ConnectionDto> = {
        success: true,
        data: dto,
        meta: { message: CONNECTION_MESSAGES.REQUEST_SENT },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapConnectionError(err, next);
    }
  },

  /**
   * GET /api/v1/connections?status=PENDING|ACCEPTED|...
   *
   * List all connections for the authenticated user.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:connections:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { status } = req.query as unknown as ListConnectionsQuery;

      log.info('List connections', { userId, status });

      const connections = await listConnections(userId, status as ConnectionStatus | undefined);

      const body: ApiResponse<ConnectionDto[]> = {
        success: true,
        data: connections,
        meta: { total: connections.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapConnectionError(err, next);
    }
  },

  /**
   * PUT /api/v1/connections/:connectionId/accept
   *
   * Accept a pending incoming connection request. Creates a Match record.
   * 403 if caller is not the receiver.
   * 404 if the connection does not exist.
   * 409 if not in PENDING state.
   */
  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:connections:accept', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params as unknown as ConnectionIdParams;

      log.info('Accept connection', { userId, connectionId });

      const dto = await acceptConnection(connectionId, userId);

      const body: ApiResponse<ConnectionDto> = {
        success: true,
        data: dto,
        meta: { message: CONNECTION_MESSAGES.ACCEPTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapConnectionError(err, next);
    }
  },

  /**
   * PUT /api/v1/connections/:connectionId/decline
   *
   * Decline a pending incoming connection request.
   * 403 if caller is not the receiver.
   */
  async decline(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:connections:decline', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params as unknown as ConnectionIdParams;

      log.info('Decline connection', { userId, connectionId });

      const dto = await declineConnection(connectionId, userId);

      const body: ApiResponse<ConnectionDto> = {
        success: true,
        data: dto,
        meta: { message: CONNECTION_MESSAGES.DECLINED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapConnectionError(err, next);
    }
  },

  /**
   * DELETE /api/v1/connections/:connectionId
   *
   * Withdraw a pending outgoing connection request.
   * 403 if caller is not the sender.
   */
  async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:connections:withdraw', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params as unknown as ConnectionIdParams;

      log.info('Withdraw connection', { userId, connectionId });

      await withdrawConnection(connectionId, userId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: CONNECTION_MESSAGES.WITHDRAWN },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapConnectionError(err, next);
    }
  },
};
