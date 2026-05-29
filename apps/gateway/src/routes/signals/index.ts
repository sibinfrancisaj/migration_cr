import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { signalsController } from '../../controllers/signals/signals.controller.js';

export const signalsRouter = Router();

signalsRouter.use(requireAuth);

/** GET /api/v1/signals — engagement metrics for the authenticated user */
signalsRouter.get('/', signalsController.get);
