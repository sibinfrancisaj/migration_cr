import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  groupIdParamSchema,
  listGroupsQuerySchema,
} from '../../schemas/groups/groups.schema.js';
import { groupsController } from '../../controllers/groups/groups.controller.js';

export const groupsRouter = Router();

// All group routes require authentication
groupsRouter.use(requireAuth);

/**
 * GET /api/v1/groups?country=&region=
 * List active groups filtered by geography.
 */
groupsRouter.get('/', validateQuery(listGroupsQuerySchema), groupsController.list);

/**
 * GET /api/v1/groups/:groupId
 * Get details for a single group.
 */
groupsRouter.get('/:groupId', validateParams(groupIdParamSchema), groupsController.getOne);

/**
 * POST /api/v1/groups/:groupId/join
 * Join a group.
 */
groupsRouter.post('/:groupId/join', validateParams(groupIdParamSchema), groupsController.join);

/**
 * DELETE /api/v1/groups/:groupId/leave
 * Leave a group.
 */
groupsRouter.delete('/:groupId/leave', validateParams(groupIdParamSchema), groupsController.leave);

/**
 * GET /api/v1/groups/:groupId/members
 * List members of a group (caller must be a member).
 */
groupsRouter.get('/:groupId/members', validateParams(groupIdParamSchema), groupsController.members);

/**
 * GET /api/v1/groups/:groupId/events
 * List upcoming events for a group.
 */
groupsRouter.get('/:groupId/events', validateParams(groupIdParamSchema), groupsController.events);
