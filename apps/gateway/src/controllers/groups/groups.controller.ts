import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupEvents,
  GroupNotFoundError,
  AlreadyGroupMemberError,
  NotGroupMemberError,
  GroupFullError,
  GroupAccessDeniedError,
} from '@abroad-matrimony/groups';
import type { ApiResponse } from '@abroad-matrimony/shared';
import type { GroupDto, GroupMemberDto, GroupEventDto } from '@abroad-matrimony/groups';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { GROUP_ERRORS, GROUP_MESSAGES } from '../../constants/groups.constants.js';
import type { GroupIdParams, ListGroupsQuery } from '../../schemas/groups/groups.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapGroupError(err: unknown, next: NextFunction): void {
  if (err instanceof GroupNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUP_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof AlreadyGroupMemberError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.ALREADY_MEMBER));
    return;
  }
  if (err instanceof NotGroupMemberError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, GROUP_ERRORS.NOT_MEMBER));
    return;
  }
  if (err instanceof GroupFullError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.GROUP_FULL));
    return;
  }
  if (err instanceof GroupAccessDeniedError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, GROUP_ERRORS.ACCESS_DENIED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const groupsController = {
  /**
   * GET /api/v1/groups?country=&region=
   *
   * Lists FORMING and ACTIVE groups. Filters by country/region if provided.
   * Each group includes isMember flag for the caller.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { country, region } = req.query as unknown as ListGroupsQuery;

      log.info('List groups', { userId, country, region });

      const groups = await listGroups(userId, country, region);

      const body: ApiResponse<GroupDto[]> = {
        success: true,
        data: groups,
        meta: { total: groups.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapGroupError(err, next);
    }
  },

  /**
   * GET /api/v1/groups/:groupId
   *
   * Get a single group by ID.
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:getOne', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;

      log.info('Get group', { userId, groupId });

      const group = await getGroup(groupId, userId);

      const body: ApiResponse<GroupDto> = {
        success: true,
        data: group,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapGroupError(err, next);
    }
  },

  /**
   * POST /api/v1/groups/:groupId/join
   *
   * Join a group. 409 if already a member or group is full.
   * 403 if the group is invite-only.
   */
  async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:join', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;

      log.info('Join group', { userId, groupId });

      await joinGroup(groupId, userId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: GROUP_MESSAGES.JOINED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapGroupError(err, next);
    }
  },

  /**
   * DELETE /api/v1/groups/:groupId/leave
   *
   * Leave a group. 403 if not a member.
   */
  async leave(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:leave', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;

      log.info('Leave group', { userId, groupId });

      await leaveGroup(groupId, userId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: GROUP_MESSAGES.LEFT },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapGroupError(err, next);
    }
  },

  /**
   * GET /api/v1/groups/:groupId/members
   *
   * List active members of a group. Caller must be a member.
   */
  async members(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:members', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;

      log.info('Get group members', { userId, groupId });

      const members = await getGroupMembers(groupId, userId);

      const body: ApiResponse<GroupMemberDto[]> = {
        success: true,
        data: members,
        meta: { total: members.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapGroupError(err, next);
    }
  },

  /**
   * GET /api/v1/groups/:groupId/events
   *
   * List upcoming events for a group.
   */
  async events(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:groups:events', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { groupId } = req.params as unknown as GroupIdParams;

      log.info('Get group events', { userId, groupId });

      const events = await getGroupEvents(groupId, userId);

      const body: ApiResponse<GroupEventDto[]> = {
        success: true,
        data: events,
        meta: { total: events.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapGroupError(err, next);
    }
  },
};
