import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import {
  habitKeyParamSchema,
  logHabitSchema,
  deleteHabitLogParamSchema,
  habitReflectionSchema,
} from '../../schemas/habits/habits.schema.js';
import { habitsController } from '../../controllers/habits/habits.controller.js';

export const habitsRouter = Router();

habitsRouter.use(requireAuth);

/** GET /api/v1/habits — list all habits with streaks */
habitsRouter.get('/', habitsController.list);

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

/** GET /api/v1/habits/:habitKey/streak — get habit streak */
habitsRouter.get(
  '/:habitKey/streak',
  validateParams(habitKeyParamSchema),
  habitsController.getStreak,
);

/** POST /api/v1/habits/reflection — add a reflection */
habitsRouter.post(
  '/reflection',
  validateBody(habitReflectionSchema),
  habitsController.addReflection,
);
