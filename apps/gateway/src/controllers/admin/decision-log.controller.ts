import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  queryDecisionLogs,
  getMatchStory,
  getUserTimeline,
} from '@abroad-matrimony/decision-log';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { AppError } from '../../middleware/error.middleware.js';
import { DECISION_LOG_ERRORS, DECISION_LOG_MESSAGES } from '../../constants/decision-log.constants.js';

const listQuerySchema = z.object({
  actorUserId:  z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(),
  eventType:    z.string().optional(),
  sessionId:    z.string().optional(),
  from:         z.string().datetime().optional(),
  to:           z.string().datetime().optional(),
  limit:        z.coerce.number().int().min(1).max(200).default(50),
  page:         z.coerce.number().int().min(1).default(1),
});

const matchStorySchema = z.object({
  userA: z.string().uuid(),
  userB: z.string().uuid(),
});

const timelineSchema = z.object({
  userId: z.string().uuid(),
  from:   z.string().datetime().optional(),
  to:     z.string().datetime().optional(),
  limit:  z.coerce.number().int().min(1).max(500).default(100),
});

export const decisionLogController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, parsed.error.errors[0]?.message ?? 'Invalid query'));
        return;
      }

      const q = parsed.data;
      const result = await queryDecisionLogs({
        actorUserId:  q.actorUserId,
        targetUserId: q.targetUserId,
        eventType:    q.eventType as Parameters<typeof queryDecisionLogs>[0]['eventType'],
        sessionId:    q.sessionId,
        from:         q.from ? new Date(q.from) : undefined,
        to:           q.to   ? new Date(q.to)   : undefined,
        limit:        q.limit,
        page:         q.page,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data:    result.items,
        meta:    { total: result.total, page: q.page, limit: q.limit, hasMore: result.total > q.page * q.limit },
        message: DECISION_LOG_MESSAGES.LIST_OK,
      });
    } catch (err) {
      next(err);
    }
  },

  async matchStory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = matchStorySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, DECISION_LOG_ERRORS.MISSING_USER_PARAM));
        return;
      }

      const story = await getMatchStory(parsed.data.userA, parsed.data.userB);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data:    story,
        message: DECISION_LOG_MESSAGES.MATCH_STORY_OK,
      });
    } catch (err) {
      next(err);
    }
  },

  async userTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = timelineSchema.safeParse(req.query);
      if (!parsed.success) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, DECISION_LOG_ERRORS.MISSING_USER_ID));
        return;
      }

      const q = parsed.data;
      const entries = await getUserTimeline(
        q.userId,
        q.from ? new Date(q.from) : undefined,
        q.to   ? new Date(q.to)   : undefined,
        q.limit,
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data:    entries,
        meta:    { total: entries.length },
        message: DECISION_LOG_MESSAGES.TIMELINE_OK,
      });
    } catch (err) {
      next(err);
    }
  },
};
