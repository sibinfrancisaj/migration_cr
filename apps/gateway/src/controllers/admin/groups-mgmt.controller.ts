import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listAdminGroups,
  getAdminGroup,
  createAdminGroup,
  updateAdminGroup,
  archiveAdminGroup,
  GroupAdminNotFoundError,
  GroupAlreadyArchivedError,
} from '@abroad-matrimony/groups';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const GROUPS_MGMT_ERRORS = {
  NOT_FOUND:       'Group not found',
  ALREADY_ARCHIVED: 'Group is already archived',
} as const;

function mapGroupMgmtError(err: unknown, next: NextFunction): void {
  if (err instanceof GroupAdminNotFoundError)   { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUPS_MGMT_ERRORS.NOT_FOUND)); return; }
  if (err instanceof GroupAlreadyArchivedError) { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  GROUPS_MGMT_ERRORS.ALREADY_ARCHIVED)); return; }
  next(err);
}

export const groupsMgmtController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:groups-mgmt:list', requestId: req.requestId });
    try {
      const { type, status, limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list groups', { type, status });
      const result = await listAdminGroups({ type, status, limit: limit ? Number(limit) : undefined, cursor });
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupMgmtError(err, next); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:groups-mgmt:get', requestId: req.requestId });
    try {
      const { groupId } = req.params;
      log.info('Admin get group', { groupId });
      const data = await getAdminGroup(groupId);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupMgmtError(err, next); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:groups-mgmt:create', requestId: req.requestId });
    try {
      log.info('Admin create group');
      const data = await createAdminGroup(
        req.body as Parameters<typeof createAdminGroup>[0],
        req.admin!.id,
        req.ip ?? '',
      );
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapGroupMgmtError(err, next); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:groups-mgmt:update', requestId: req.requestId });
    try {
      const { groupId } = req.params;
      log.info('Admin update group', { groupId });
      const data = await updateAdminGroup(
        groupId,
        req.body as Parameters<typeof updateAdminGroup>[1],
        req.admin!.id,
        req.ip ?? '',
      );
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupMgmtError(err, next); }
  },

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:groups-mgmt:archive', requestId: req.requestId });
    try {
      const { groupId } = req.params;
      log.info('Admin archive group', { groupId });
      await archiveAdminGroup(groupId, req.admin!.id, req.ip ?? '');
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'Group archived' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupMgmtError(err, next); }
  },
};
