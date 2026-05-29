import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listHabits,
  logHabit,
  deleteHabitLog,
  getHabitStreak,
  addHabitReflection,
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
};
