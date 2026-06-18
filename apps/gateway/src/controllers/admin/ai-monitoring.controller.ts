import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getEmbeddingStatus,
  listEmbeddings,
  recomputeEmbedding,
  recomputeAllStaleEmbeddings,
  UserEmbeddingNotFoundError,
} from '@abroad-matrimony/ai';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const AI_MONITORING_ERRORS = {
  USER_NOT_FOUND: 'User not found for embedding recompute',
} as const;

function mapAiMonitoringError(err: unknown, next: NextFunction): void {
  if (err instanceof UserEmbeddingNotFoundError) { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, AI_MONITORING_ERRORS.USER_NOT_FOUND)); return; }
  next(err);
}

export const aiMonitoringController = {

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:status', requestId: req.requestId });
    try {
      log.info('Admin get AI embedding status');
      const data = await getEmbeddingStatus();
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },

  async listEmbeddings(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:list', requestId: req.requestId });
    try {
      const { status, limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list embeddings', { status });
      const data = await listEmbeddings({
        status: status as 'complete' | 'pending' | 'stale' | undefined,
        limit: limit ? Number(limit) : undefined,
        cursor,
      });
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },

  async recomputeOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:recompute', requestId: req.requestId });
    try {
      const { userId } = req.params;
      log.info('Admin recompute embedding', { userId });
      const data = await recomputeEmbedding(userId);
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: 'Profile intelligence job enqueued' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },

  async recomputeAllStale(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:recompute-all', requestId: req.requestId });
    try {
      log.info('Admin bulk recompute stale embeddings');
      const data = await recomputeAllStaleEmbeddings();
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: 'Bulk recompute enqueued' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },
};
