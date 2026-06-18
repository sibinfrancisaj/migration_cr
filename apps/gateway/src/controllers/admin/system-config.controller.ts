import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listSystemConfig,
  getSystemConfig,
  upsertSystemConfig,
  createSystemConfig,
  deleteSystemConfig,
  SystemConfigNotFoundError,
  SystemConfigDeleteProtectedError,
  SystemConfigValidationError,
  SystemConfigAlreadyExistsError,
} from '@abroad-matrimony/config';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const SYSTEM_CONFIG_ERRORS = {
  NOT_FOUND:     'System config key not found',
  PROTECTED:     'System config key is protected and cannot be deleted',
  KEY_INVALID:   'System config key must be UPPER_SNAKE_CASE',
  ALREADY_EXISTS: 'System config key already exists',
} as const;

function mapConfigError(err: unknown, next: NextFunction): void {
  if (err instanceof SystemConfigNotFoundError)        { next(new AppError(HTTP_STATUS.NOT_FOUND,  ERROR_CODES.NOT_FOUND,   SYSTEM_CONFIG_ERRORS.NOT_FOUND));     return; }
  if (err instanceof SystemConfigDeleteProtectedError) { next(new AppError(HTTP_STATUS.FORBIDDEN,  ERROR_CODES.FORBIDDEN,   SYSTEM_CONFIG_ERRORS.PROTECTED));      return; }
  if (err instanceof SystemConfigValidationError)      { next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION, err.message));                         return; }
  if (err instanceof SystemConfigAlreadyExistsError)   { next(new AppError(HTTP_STATUS.CONFLICT,   ERROR_CODES.CONFLICT,   SYSTEM_CONFIG_ERRORS.ALREADY_EXISTS)); return; }
  next(err);
}

export const systemConfigController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:system-config:list', requestId: req.requestId });
    try {
      log.info('Admin list system config');
      const data = await listSystemConfig();
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapConfigError(err, next); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:system-config:get', requestId: req.requestId });
    try {
      const { configKey } = req.params;
      log.info('Admin get system config', { configKey });
      const data = await getSystemConfig(configKey);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapConfigError(err, next); }
  },

  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:system-config:upsert', requestId: req.requestId });
    try {
      const { configKey } = req.params;
      const { value, description } = req.body as { value: string; description?: string };
      log.info('Admin upsert system config', { configKey });
      const data = await upsertSystemConfig(configKey, value, description);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapConfigError(err, next); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:system-config:create', requestId: req.requestId });
    try {
      const { key, value, description } = req.body as { key: string; value: string; description?: string };
      log.info('Admin create system config', { key });
      const data = await createSystemConfig(key, value, description);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapConfigError(err, next); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:system-config:delete', requestId: req.requestId });
    try {
      const { configKey } = req.params;
      log.info('Admin delete system config', { configKey });
      await deleteSystemConfig(configKey);
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'Config key deleted' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapConfigError(err, next); }
  },
};
