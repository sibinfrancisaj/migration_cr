import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody } from '../../middleware/validate.middleware.js';
import { setMatchTuningSchema } from '../../schemas/matches/matches.schema.js';
import { matchTuningController } from '../../controllers/matches/tuning.controller.js';

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

/** GET /api/v1/matches/tuning — get current weight preferences */
matchesRouter.get('/tuning', matchTuningController.get);

/** PUT /api/v1/matches/tuning — set weight preferences */
matchesRouter.put('/tuning', validateBody(setMatchTuningSchema), matchTuningController.set);
