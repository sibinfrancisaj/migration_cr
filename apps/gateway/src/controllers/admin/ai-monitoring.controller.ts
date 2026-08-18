import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getEmbeddingStatus,
  listEmbeddings,
  recomputeEmbedding,
  recomputeAllStaleEmbeddings,
  generateGroupEmbedding,
  generateAllGroupEmbeddings,
  GroupNotFoundError,
  UserEmbeddingNotFoundError,
} from '@abroad-matrimony/ai';
import { prisma } from '@abroad-matrimony/db';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const AI_MONITORING_ERRORS = {
  USER_NOT_FOUND: 'User not found for embedding recompute',
} as const;

const AI_MONITORING_GROUP_ERRORS = {
  GROUP_NOT_FOUND: 'Group not found for embedding',
} as const;

function mapAiMonitoringError(err: unknown, next: NextFunction): void {
  if (err instanceof UserEmbeddingNotFoundError) { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, AI_MONITORING_ERRORS.USER_NOT_FOUND)); return; }
  if (err instanceof GroupNotFoundError) { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, AI_MONITORING_GROUP_ERRORS.GROUP_NOT_FOUND)); return; }
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

  async embedGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:embed-group', requestId: req.requestId });
    try {
      const { groupId } = req.params;
      log.info('Admin embed group', { groupId });
      const data = await generateGroupEmbedding(groupId);
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: data ? 'Group embedding generated' : 'AI not configured — skipped' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },

  async embedAllGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:embed-groups-all', requestId: req.requestId });
    try {
      log.info('Admin bulk embed all groups');
      const data = await generateAllGroupEmbeddings();
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: 'Bulk group embedding complete' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },

  async findSimilarUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:ai:similar', requestId: req.requestId });
    try {
      const { userId } = req.params;
      const topN = Math.min(Number(req.query['limit'] ?? 10), 50);

      log.info('Admin find similar users', { userId, topN });

      type SimilarRow = { user_id: string; similarity: number };
      const rows = await prisma.$queryRaw<SimilarRow[]>`
        SELECT pe.user_id,
               ROUND(CAST(1 - (pe.embedding <=> (
                 SELECT embedding FROM profile_embeddings WHERE user_id = ${userId}
               )) AS numeric), 4) AS similarity
        FROM profile_embeddings pe
        WHERE pe.user_id != ${userId}
          AND pe.embedding IS NOT NULL
          AND (SELECT embedding FROM profile_embeddings WHERE user_id = ${userId}) IS NOT NULL
        ORDER BY pe.embedding <=> (
          SELECT embedding FROM profile_embeddings WHERE user_id = ${userId}
        )
        LIMIT ${topN}
      `;

      if (rows.length === 0) {
        throw new UserEmbeddingNotFoundError(userId);
      }

      const data = { userId, similar: rows.map(r => ({ userId: r.user_id, similarity: Number(r.similarity) })) };
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAiMonitoringError(err, next); }
  },
};
