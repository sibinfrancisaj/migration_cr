import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import {
  groupIdParamSchema,
  groupAndPostParamSchema,
  listGroupsQuerySchema,
  paginationQuerySchema,
  createPostSchema,
  addCommentSchema,
  proposeGroupSchema,
  suggestedGroupsQuerySchema,
} from '../../schemas/groups/groups.schema.js';
import { groupsController } from '../../controllers/groups/groups.controller.js';

export const groupsRouter = Router();

// All group routes require authentication
groupsRouter.use(requireAuth);

// ── Browse & Discovery ────────────────────────────────────────────────────────

/**
 * GET /api/v1/groups?country=&region=
 * List active groups filtered by geography.
 */
groupsRouter.get('/', validateQuery(listGroupsQuerySchema), groupsController.list);

/**
 * GET /api/v1/groups/suggested?limit=
 * Suggested groups for current user (not yet joined, ranked by relevance).
 */
groupsRouter.get('/suggested', validateQuery(suggestedGroupsQuerySchema), groupsController.suggested);

/**
 * GET /api/v1/groups/onboarding-suggestions
 * Suggested groups for onboarding (limit from SystemConfig.SUGGESTED_GROUPS_MAX).
 */
groupsRouter.get('/onboarding-suggestions', groupsController.onboardingSuggestions);

/**
 * POST /api/v1/groups/proposals
 * Propose a new INTEREST group.
 */
groupsRouter.post('/proposals', validateBody(proposeGroupSchema), groupsController.proposeGroup);

/**
 * GET /api/v1/groups/:groupId
 * Get details for a single group.
 */
groupsRouter.get('/:groupId', validateParams(groupIdParamSchema), groupsController.getOne);

// ── Membership ────────────────────────────────────────────────────────────────

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
 * GET /api/v1/groups/:groupId/members?page=&limit=
 * Paginated member list — all authenticated users can view.
 */
groupsRouter.get(
  '/:groupId/members',
  validateParams(groupIdParamSchema),
  validateQuery(paginationQuerySchema),
  groupsController.members,
);

/**
 * GET /api/v1/groups/:groupId/events
 * List upcoming events for a group.
 */
groupsRouter.get('/:groupId/events', validateParams(groupIdParamSchema), groupsController.events);

// ── Social Feed ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/groups/:groupId/feed?page=&limit=
 * Paginated group post feed (pinned first, then chronological).
 */
groupsRouter.get(
  '/:groupId/feed',
  validateParams(groupIdParamSchema),
  validateQuery(paginationQuerySchema),
  groupsController.getFeed,
);

/**
 * POST /api/v1/groups/:groupId/posts
 * Create a post in a group. Caller must be an active member.
 */
groupsRouter.post(
  '/:groupId/posts',
  validateParams(groupIdParamSchema),
  validateBody(createPostSchema),
  groupsController.createPost,
);

/**
 * DELETE /api/v1/groups/:groupId/posts/:postId
 * Delete a post. Only the author may delete their own post.
 */
groupsRouter.delete(
  '/:groupId/posts/:postId',
  validateParams(groupAndPostParamSchema),
  groupsController.deletePost,
);

/**
 * POST /api/v1/groups/:groupId/posts/:postId/like
 * Like a post (idempotent).
 */
groupsRouter.post(
  '/:groupId/posts/:postId/like',
  validateParams(groupAndPostParamSchema),
  groupsController.likePost,
);

/**
 * DELETE /api/v1/groups/:groupId/posts/:postId/like
 * Unlike a post (idempotent).
 */
groupsRouter.delete(
  '/:groupId/posts/:postId/like',
  validateParams(groupAndPostParamSchema),
  groupsController.unlikePost,
);

/**
 * POST /api/v1/groups/:groupId/posts/:postId/comments
 * Add a comment. Caller must be an active group member.
 */
groupsRouter.post(
  '/:groupId/posts/:postId/comments',
  validateParams(groupAndPostParamSchema),
  validateBody(addCommentSchema),
  groupsController.addComment,
);

/**
 * GET /api/v1/groups/:groupId/posts/:postId/comments?page=&limit=
 * List comments on a post (flat, chronological).
 */
groupsRouter.get(
  '/:groupId/posts/:postId/comments',
  validateParams(groupAndPostParamSchema),
  validateQuery(paginationQuerySchema),
  groupsController.listComments,
);
