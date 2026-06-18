import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listUsers,
  getUserAdminDetail,
  suspendUser,
  unsuspendUser,
  banUser,
  wipeSeededUser,
  UserNotFoundError,
  UserAlreadySuspendedError,
  UserNotSuspendedError,
} from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const USER_ADMIN_ERRORS = {
  NOT_FOUND:          'User not found',
  ALREADY_SUSPENDED:  'User is already suspended',
  NOT_SUSPENDED:      'User is not suspended',
} as const;

function mapUserAdminError(err: unknown, next: NextFunction): void {
  if (err instanceof UserNotFoundError)         { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, USER_ADMIN_ERRORS.NOT_FOUND)); return; }
  if (err instanceof UserAlreadySuspendedError) { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  USER_ADMIN_ERRORS.ALREADY_SUSPENDED)); return; }
  if (err instanceof UserNotSuspendedError)     { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  USER_ADMIN_ERRORS.NOT_SUSPENDED)); return; }
  next(err);
}

export const usersAdminController = {

  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:users:list', requestId: req.requestId });
    try {
      const { search, status, limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list users', { search, status });
      const result = await listUsers({ search, status, limit: limit ? Number(limit) : undefined, cursor });
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapUserAdminError(err, next); }
  },

  async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:users:detail', requestId: req.requestId });
    try {
      const { userId } = req.params;
      log.info('Admin get user detail', { userId });
      const detail = await getUserAdminDetail(userId);
      const body: ApiResponse<typeof detail> = { success: true, data: detail, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapUserAdminError(err, next); }
  },

  async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:users:suspend', requestId: req.requestId });
    try {
      const { userId } = req.params;
      const { reason } = req.body as { reason: string };
      log.info('Admin suspend user', { userId });
      await suspendUser(userId, req.admin!.id, reason, req.ip ?? '');
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'User suspended' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapUserAdminError(err, next); }
  },

  async unsuspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:users:unsuspend', requestId: req.requestId });
    try {
      const { userId } = req.params;
      log.info('Admin unsuspend user', { userId });
      await unsuspendUser(userId, req.admin!.id, req.ip ?? '');
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'User unsuspended' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapUserAdminError(err, next); }
  },

  async banUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:users:ban', requestId: req.requestId });
    try {
      const { userId } = req.params;
      const { reason } = req.body as { reason: string };
      log.info('Admin ban user', { userId });
      await banUser(userId, req.admin!.id, reason, req.ip ?? '');
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'User banned and tokens revoked' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapUserAdminError(err, next); }
  },

  async wipeSeededData(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:users:wipe', requestId: req.requestId });
    try {
      const { userId } = req.params;
      log.info('Admin wipe seeded user data', { userId });
      const result = await wipeSeededUser(userId, req.admin!.id, req.ip ?? '');
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapUserAdminError(err, next); }
  },
};
