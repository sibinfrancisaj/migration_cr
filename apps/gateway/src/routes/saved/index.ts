import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  saveProfileSchema,
  savedUserIdParamSchema,
  updateSavedProfileSchema,
  listSavedQuerySchema,
} from '../../schemas/saved/saved.schema.js';
import { savedController } from '../../controllers/saved/saved.controller.js';

export const savedRouter = Router();

savedRouter.use(requireAuth);

/** GET /api/v1/saved?label=INTERESTED|MAYBE|NOT_NOW */
savedRouter.get('/', validateQuery(listSavedQuerySchema), savedController.list);

/** POST /api/v1/saved */
savedRouter.post('/', validateBody(saveProfileSchema), savedController.save);

/** PATCH /api/v1/saved/:savedUserId */
savedRouter.patch(
  '/:savedUserId',
  validateParams(savedUserIdParamSchema),
  validateBody(updateSavedProfileSchema),
  savedController.update,
);

/** DELETE /api/v1/saved/:savedUserId */
savedRouter.delete(
  '/:savedUserId',
  validateParams(savedUserIdParamSchema),
  savedController.unsave,
);
