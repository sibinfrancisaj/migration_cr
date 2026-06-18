import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { signalsController } from '../../controllers/signals/signals.controller.js';

export const signalsRouter = Router();

signalsRouter.use(requireAuth);

// Static sub-routes registered before parameterised paths
signalsRouter.get('/week',         signalsController.getWeek);
signalsRouter.get('/action-queue', signalsController.getActionQueue);
signalsRouter.get('/momentum',     signalsController.getMomentum);

/** GET /api/v1/signals — legacy engagement metrics */
signalsRouter.get('/', signalsController.get);
