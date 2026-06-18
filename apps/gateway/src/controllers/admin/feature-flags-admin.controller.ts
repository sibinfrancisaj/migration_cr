import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listFeatureFlags,
  getFeatureFlag,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  FeatureFlagNotFoundError,
  FeatureFlagAlreadyExistsError,
} from '@abroad-matrimony/config';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const FEATURE_FLAG_ERRORS = {
  NOT_FOUND:     'Feature flag not found',
  ALREADY_EXISTS: 'Feature flag already exists',
} as const;

function mapFlagError(err: unknown, next: NextFunction): void {
  if (err instanceof FeatureFlagNotFoundError)     { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, FEATURE_FLAG_ERRORS.NOT_FOUND)); return; }
  if (err instanceof FeatureFlagAlreadyExistsError) { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  FEATURE_FLAG_ERRORS.ALREADY_EXISTS)); return; }
  next(err);
}

export const featureFlagsAdminController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:list', requestId: req.requestId });
    try {
      log.info('Admin list feature flags');
      const flags = await listFeatureFlags();
      const body: ApiResponse<typeof flags> = { success: true, data: flags, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapFlagError(err, next); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:get', requestId: req.requestId });
    try {
      const { flagKey } = req.params;
      log.info('Admin get feature flag', { flagKey });
      const flag = await getFeatureFlag(flagKey);
      const body: ApiResponse<typeof flag> = { success: true, data: flag, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapFlagError(err, next); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:create', requestId: req.requestId });
    try {
      const flag = await createFeatureFlag(req.body as Parameters<typeof createFeatureFlag>[0]);
      log.info('Admin create feature flag', { flagKey: flag.key });
      const body: ApiResponse<typeof flag> = { success: true, data: flag, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapFlagError(err, next); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:update', requestId: req.requestId });
    try {
      const { flagKey } = req.params;
      log.info('Admin update feature flag', { flagKey });
      const flag = await updateFeatureFlag(flagKey, req.body as Parameters<typeof updateFeatureFlag>[1]);
      const body: ApiResponse<typeof flag> = { success: true, data: flag, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapFlagError(err, next); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:delete', requestId: req.requestId });
    try {
      const { flagKey } = req.params;
      log.info('Admin delete feature flag', { flagKey });
      await deleteFeatureFlag(flagKey);
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: 'Feature flag deleted' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapFlagError(err, next); }
  },
};
