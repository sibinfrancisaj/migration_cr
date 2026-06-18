import { Router } from 'express';
import { requireSeederKey } from '../middleware/seeder-key.middleware.js';
import { seedController } from '../controllers/seed.controller.js';

export const seedRouter = Router();

// All seeder control endpoints require the seeder key header
seedRouter.use(requireSeederKey);

seedRouter.get('/status',  seedController.getStatus);
seedRouter.post('/run',    seedController.triggerRun);
seedRouter.post('/groups', seedController.seedGroups);   // GRP-R-007: idempotent group seed
seedRouter.post('/flush',  seedController.flush);
seedRouter.post('/pause',  seedController.pause);
seedRouter.post('/resume', seedController.resume);
