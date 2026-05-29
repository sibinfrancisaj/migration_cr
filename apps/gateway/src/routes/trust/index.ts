import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import {
  blockUserSchema,
  userIdParamSchema,
  reportUserSchema,
} from '../../schemas/trust/trust.schema.js';
import { trustController } from '../../controllers/trust/trust.controller.js';

export const trustRouter = Router();

trustRouter.use(requireAuth);

/** POST /api/v1/trust/block */
trustRouter.post('/block', validateBody(blockUserSchema), trustController.block);

/** DELETE /api/v1/trust/block/:userId */
trustRouter.delete('/block/:userId', validateParams(userIdParamSchema), trustController.unblock);

/** GET /api/v1/trust/blocks */
trustRouter.get('/blocks', trustController.listBlocks);

/** POST /api/v1/trust/report */
trustRouter.post('/report', validateBody(reportUserSchema), trustController.report);
