import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupEvents,
  listSuggestedGroups,
  getSuggestedGroupsForOnboarding,
  GroupNotFoundError,
  AlreadyInGroupError,
  AlreadyGroupMemberError,
  NotInGroupError,
  NotGroupMemberError,
  GroupFullError,
  GroupAccessDeniedError,
  // Feed
  createPost,
  listPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  listComments,
  pinPost,
  unpinPost,
  PostNotFoundError,
  PostForbiddenError,
  // Proposals
  proposeGroup,
  approveGroupProposal,
  rejectGroupProposal,
  GroupProposalNotFoundError,
  AlreadyProposedError,
  ProposalNotPendingError,
} from '@abroad-matrimony/groups';
import type {
  GroupDto,
  GroupMemberDto,
  GroupEventDto,
  GroupPostDto,
  GroupPostCommentDto,
  GroupProposalDto,
} from '@abroad-matrimony/groups';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { GROUP_ERRORS, GROUP_MESSAGES } from '../../constants/groups.constants.js';
import type {
  GroupIdParams,
  GroupAndPostParams,
  ListGroupsQuery,
  PaginationQuery,
  CreatePostBody,
  AddCommentBody,
  ProposeGroupBody,
  SuggestedGroupsQuery,
} from '../../schemas/groups/groups.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapGroupError(err: unknown, next: NextFunction): void {
  if (err instanceof GroupNotFoundError) {
    return void next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUP_ERRORS.NOT_FOUND));
  }
  if (err instanceof AlreadyInGroupError || err instanceof AlreadyGroupMemberError) {
    return void next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.ALREADY_MEMBER));
  }
  if (err instanceof NotInGroupError || err instanceof NotGroupMemberError) {
    return void next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, GROUP_ERRORS.NOT_MEMBER));
  }
  if (err instanceof GroupFullError) {
    return void next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.GROUP_FULL));
  }
  if (err instanceof GroupAccessDeniedError) {
    return void next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, GROUP_ERRORS.ACCESS_DENIED));
  }
  if (err instanceof PostNotFoundError) {
    return void next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUP_ERRORS.POST_NOT_FOUND));
  }
  if (err instanceof PostForbiddenError) {
    return void next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, GROUP_ERRORS.POST_FORBIDDEN));
  }
  if (err instanceof GroupProposalNotFoundError) {
    return void next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUP_ERRORS.PROPOSAL_NOT_FOUND));
  }
  if (err instanceof AlreadyProposedError) {
    return void next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.ALREADY_PROPOSED));
  }
  if (err instanceof ProposalNotPendingError) {
    return void next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.PROPOSAL_NOT_PENDING));
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const groupsController = {
  // ── Browse ──────────────────────────────────────────────────────────────────

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { country, region } = req.query as unknown as ListGroupsQuery;
      log.info('List groups', { userId, country, region });
      const groups = await listGroups(userId, country, region);
      const body: ApiResponse<GroupDto[]> = { success: true, data: groups, meta: { total: groups.length }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:getOne', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;
      const group = await getGroup(groupId, userId);
      const body: ApiResponse<GroupDto> = { success: true, data: group, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async suggested(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:suggested', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { limit } = req.query as unknown as SuggestedGroupsQuery;
      log.info('Suggested groups', { userId, limit });
      const groups = await listSuggestedGroups(userId, limit);
      const body: ApiResponse<GroupDto[]> = { success: true, data: groups, meta: { total: groups.length }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async onboardingSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:onboarding', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Onboarding group suggestions', { userId });
      const groups = await getSuggestedGroupsForOnboarding(userId);
      const body: ApiResponse<GroupDto[]> = { success: true, data: groups, meta: { total: groups.length }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  // ── Membership ───────────────────────────────────────────────────────────────

  async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:join', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;
      log.info('Join group', { userId, groupId });
      await joinGroup(userId, groupId, 'MANUAL');
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: GROUP_MESSAGES.JOINED }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async leave(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:leave', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;
      log.info('Leave group', { userId, groupId });
      await leaveGroup(userId, groupId);
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: GROUP_MESSAGES.LEFT }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async members(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:members', requestId: req.requestId });
    try {
      const { groupId } = req.params as unknown as GroupIdParams;
      const { page, limit } = req.query as unknown as PaginationQuery;
      log.info('Get group members', { groupId, page, limit });
      const result = await getGroupMembers(groupId, page, limit);
      const body: ApiResponse<GroupMemberDto[]> = {
        success: true,
        data: result.members,
        meta: { total: result.total, page: result.page, limit: result.limit },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async events(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:events', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;
      const events = await getGroupEvents(groupId, userId);
      const body: ApiResponse<GroupEventDto[]> = { success: true, data: events, meta: { total: events.length }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  // ── Social Feed ──────────────────────────────────────────────────────────────

  async getFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:feed', requestId: req.requestId });
    try {
      const { groupId } = req.params as unknown as GroupIdParams;
      const { page, limit } = req.query as unknown as PaginationQuery;
      log.info('Get group feed', { groupId, page, limit });
      const result = await listPosts(groupId, page, limit);
      const body: ApiResponse<GroupPostDto[]> = {
        success: true,
        data: result.posts,
        meta: { total: result.total, page: result.page, limit: result.limit },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:createPost', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;
      const data = req.body as CreatePostBody;
      log.info('Create post', { userId, groupId });
      const post = await createPost(userId, groupId, data);
      const body: ApiResponse<GroupPostDto> = { success: true, data: post, meta: { message: GROUP_MESSAGES.POST_CREATED }, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:deletePost', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { postId } = req.params as unknown as { postId: string };
      log.info('Delete post', { userId, postId });
      await deletePost(userId, postId);
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: GROUP_MESSAGES.POST_DELETED }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async likePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { postId } = req.params as unknown as { postId: string };
      await likePost(userId, postId);
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: GROUP_MESSAGES.LIKED }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async unlikePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { postId } = req.params as unknown as { postId: string };
      await unlikePost(userId, postId);
      const body: ApiResponse<null> = { success: true, data: null, meta: { message: GROUP_MESSAGES.UNLIKED }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:addComment', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { postId } = req.params as unknown as { postId: string };
      const { text } = req.body as AddCommentBody;
      log.info('Add comment', { userId, postId });
      const comment = await addComment(userId, postId, text);
      const body: ApiResponse<GroupPostCommentDto> = { success: true, data: comment, meta: { message: GROUP_MESSAGES.COMMENT_ADDED }, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async listComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { postId } = req.params as unknown as { postId: string };
      const { page, limit } = req.query as unknown as PaginationQuery;
      const result = await listComments(postId, page, limit);
      const body: ApiResponse<GroupPostCommentDto[]> = {
        success: true,
        data: result.comments,
        meta: { total: result.total, page: result.page, limit: result.limit },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  // ── Proposals ────────────────────────────────────────────────────────────────

  async proposeGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:propose', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const data = req.body as ProposeGroupBody;
      log.info('Propose group', { userId, name: data.name });
      const proposal = await proposeGroup(userId, data);
      const body: ApiResponse<GroupProposalDto> = { success: true, data: proposal, meta: { message: GROUP_MESSAGES.PROPOSAL_CREATED }, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  // Admin handlers (used by admin-api routes)
  async approveProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:approveProposal', requestId: req.requestId });
    try {
      const adminId = req.user!.id;
      const { proposalId } = req.params as unknown as { proposalId: string };
      log.info('Approve group proposal', { adminId, proposalId });
      const result = await approveGroupProposal(adminId, proposalId);
      const body: ApiResponse<GroupProposalDto> = { success: true, data: result, meta: { message: GROUP_MESSAGES.PROPOSAL_APPROVED }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },

  async rejectProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:rejectProposal', requestId: req.requestId });
    try {
      const adminId = req.user!.id;
      const { proposalId } = req.params as unknown as { proposalId: string };
      const { reason } = req.body as { reason?: string };
      log.info('Reject group proposal', { adminId, proposalId });
      const result = await rejectGroupProposal(adminId, proposalId, reason);
      const body: ApiResponse<GroupProposalDto> = { success: true, data: result, meta: { message: GROUP_MESSAGES.PROPOSAL_REJECTED }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapGroupError(err, next); }
  },
};
