import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  habitKeyParamSchema,
  logHabitSchema,
  deleteHabitLogParamSchema,
  habitReflectionSchema,
  habitHistoryQuerySchema,
  summaryVisibilitySchema,
} from '../../schemas/habits/habits.schema.js';
import { habitsController } from '../../controllers/habits/habits.controller.js';

export const habitsRouter = Router();

habitsRouter.use(requireAuth);

// ─── Static-path routes first (must be registered BEFORE /:habitKey/* routes) ─

/** GET /api/v1/habits — list all 10 habits with streaks */
habitsRouter.get('/', habitsController.list);

/** GET /api/v1/habits/streaks — HABIT-004: all habits + thisWeekDots */
habitsRouter.get('/streaks', habitsController.getAllStreaks);

/** GET /api/v1/habits/weekly-reflection — HABIT-005: rule-based weekly insight */
habitsRouter.get('/weekly-reflection', habitsController.getWeeklyReflection);

/** PUT /api/v1/habits/summary-visibility — HABIT-006: toggle profile visibility */
habitsRouter.put(
  '/summary-visibility',
  validateBody(summaryVisibilitySchema),
  habitsController.updateVisibility,
);

/** POST /api/v1/habits/reflection — add a reflection note to today's log */
habitsRouter.post(
  '/reflection',
  validateBody(habitReflectionSchema),
  habitsController.addReflection,
);

// ─── Parameterised routes ──────────────────────────────────────────────────────

/** POST /api/v1/habits/:habitKey/log — log a habit */
habitsRouter.post(
  '/:habitKey/log',
  validateParams(habitKeyParamSchema),
  validateBody(logHabitSchema),
  habitsController.log,
);

/** DELETE /api/v1/habits/:habitKey/log/:date — delete a habit log */
habitsRouter.delete(
  '/:habitKey/log/:date',
  validateParams(deleteHabitLogParamSchema),
  habitsController.deleteLog,
);

/** GET /api/v1/habits/:habitKey/streak — get streak for one habit */
habitsRouter.get(
  '/:habitKey/streak',
  validateParams(habitKeyParamSchema),
  habitsController.getStreak,
);

/** GET /api/v1/habits/:habitKey/history — HABIT-007: per-habit chart data */
habitsRouter.get(
  '/:habitKey/history',
  validateParams(habitKeyParamSchema),
  validateQuery(habitHistoryQuerySchema),
  habitsController.getHistory,
);
