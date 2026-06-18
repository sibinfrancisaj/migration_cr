import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listHabits,
  logHabit,
  deleteHabitLog,
  getHabitStreak,
  addHabitReflection,
  getAllHabitsWithStreaks,
  getHabitHistory,
  getWeeklyReflection,
  updateSummaryVisibility,
  HabitLogNotFoundError,
  HabitAlreadyLoggedError,
} from '@abroad-matrimony/habits';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HabitKey } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { HABIT_ERRORS, HABIT_MESSAGES } from '../../constants/habits.constants.js';
import type {
  HabitKeyParams,
  LogHabitBody,
  DeleteHabitLogParams,
  HabitReflectionBody,
  HabitHistoryQuery,
  SummaryVisibilityBody,
} from '../../schemas/habits/habits.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapHabitError(err: unknown, next: NextFunction): void {
  if (err instanceof HabitLogNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, HABIT_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof HabitAlreadyLoggedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, HABIT_ERRORS.ALREADY_LOGGED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const habitsController = {
  /**
   * GET /api/v1/habits
   * List all habits with streak stats for the authenticated user.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('List habits', { userId });

      const habits = await listHabits(userId);

      const body: ApiResponse<typeof habits> = {
        success: true,
        data: habits,
        meta: { total: habits.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * POST /api/v1/habits/:habitKey/log
   * Log a habit for today (or a specified date).
   */
  async log(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:log', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { habitKey } = req.params as unknown as HabitKeyParams;
      const { logDate, notes, reflection } = req.body as LogHabitBody;

      const date = logDate ? new Date(logDate) : new Date();
      date.setHours(0, 0, 0, 0);

      log.info('Log habit', { userId, habitKey, logDate });

      const dto = await logHabit(userId, habitKey as HabitKey, date, notes, reflection);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: HABIT_MESSAGES.LOGGED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * DELETE /api/v1/habits/:habitKey/log/:date
   * Delete a specific habit log entry.
   */
  async deleteLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:delete-log', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { habitKey, date } = req.params as unknown as DeleteHabitLogParams;

      const logDate = new Date(date);
      logDate.setHours(0, 0, 0, 0);

      log.info('Delete habit log', { userId, habitKey, date });

      await deleteHabitLog(userId, habitKey as HabitKey, logDate);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: HABIT_MESSAGES.DELETED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * GET /api/v1/habits/:habitKey/streak
   * Get streak info for a specific habit.
   */
  async getStreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:streak', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { habitKey } = req.params as unknown as HabitKeyParams;

      log.info('Get habit streak', { userId, habitKey });

      const dto = await getHabitStreak(userId, habitKey as HabitKey);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * POST /api/v1/habits/reflection
   * Add a reflection note to today's habit log.
   */
  async addReflection(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:reflection', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { habitKey, reflection } = req.body as HabitReflectionBody;

      log.info('Add habit reflection', { userId, habitKey });

      const dto = await addHabitReflection(userId, habitKey as HabitKey, reflection);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: HABIT_MESSAGES.REFLECTION_SAVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  // ─── Phase 9 new handlers ────────────────────────────────────────────────────

  /**
   * GET /api/v1/habits/streaks
   * HABIT-004: All 10 habits with currentStreak, longestStreak, thisWeekDots.
   */
  async getAllStreaks(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:all-streaks', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get all habits with streaks', { userId });

      const habits = await getAllHabitsWithStreaks(userId);

      const body: ApiResponse<typeof habits> = {
        success: true,
        data: habits,
        meta: { total: habits.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * GET /api/v1/habits/:habitKey/history
   * HABIT-007: Per-habit weekly history for chart rendering.
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:history', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { habitKey } = req.params as unknown as HabitKeyParams;
      const { weeks } = req.query as unknown as HabitHistoryQuery;

      log.info('Get habit history', { userId, habitKey, weeks });

      const history = await getHabitHistory(userId, habitKey as HabitKey, weeks ?? 8);

      const body: ApiResponse<typeof history> = {
        success: true,
        data: history,
        meta: { total: history.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * GET /api/v1/habits/weekly-reflection
   * HABIT-005: Rule-based weekly insight, Redis-cached 7 days.
   */
  async getWeeklyReflection(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:weekly-reflection', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get weekly reflection', { userId });

      const dto = await getWeeklyReflection(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },

  /**
   * PUT /api/v1/habits/summary-visibility
   * HABIT-006: Toggle Profile.habitSummaryVisible.
   */
  async updateVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:habits:visibility', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { visible } = req.body as SummaryVisibilityBody;

      log.info('Update habit summary visibility', { userId, visible });

      await updateSummaryVisibility(userId, visible);

      const body: ApiResponse<{ visible: boolean }> = {
        success: true,
        data: { visible },
        meta: { message: HABIT_MESSAGES.VISIBILITY_UPDATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapHabitError(err, next);
    }
  },
};
