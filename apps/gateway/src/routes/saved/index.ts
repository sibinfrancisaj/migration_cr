import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  saveProfileSchema,
  savedUserIdParamSchema,
  updateSavedProfileSchema,
  listSavedQuerySchema,
  addNoteSchema,
  compareQuerySchema,
} from '../../schemas/saved/saved.schema.js';
import { savedController } from '../../controllers/saved/saved.controller.js';

export const savedRouter = Router();

savedRouter.use(requireAuth);

// Static routes BEFORE /:savedUserId to prevent shadowing

/** GET /api/v1/saved/compare?ids=uuid1,uuid2 */
savedRouter.get('/compare', validateQuery(compareQuerySchema), savedController.compare);

/** GET /api/v1/saved?label=INTERESTED|MAYBE|NOT_NOW */
savedRouter.get('/', validateQuery(listSavedQuerySchema), savedController.list);

/** POST /api/v1/saved */
savedRouter.post('/', validateBody(saveProfileSchema), savedController.save);

/** POST /api/v1/saved/:savedUserId/note */
savedRouter.post(
  '/:savedUserId/note',
  validateParams(savedUserIdParamSchema),
  validateBody(addNoteSchema),
  savedController.addNote,
);

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
