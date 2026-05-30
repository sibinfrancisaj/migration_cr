/**
 * GRP-R-006 — Admin group management controller.
 *
 * Exposes:
 *   GET  /admin/groups/proposals?status=   — list group proposals
 *   POST /admin/groups/proposals/:id/approve  — approve a pending proposal
 *   POST /admin/groups/proposals/:id/reject   — reject a pending proposal
 *   POST /admin/groups/:groupId/posts/:postId/pin   — pin a post
 *   DELETE /admin/groups/:groupId/posts/:postId/pin — unpin a post
 */
import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getGroupProposals,
  approveGroupProposal,
  rejectGroupProposal,
  pinPost,
  unpinPost,
  GroupProposalNotFoundError,
  ProposalNotPendingError,
  PostNotFoundError,
} from '@abroad-matrimony/groups';
import type { GroupProposalDto } from '@abroad-matrimony/groups';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { GROUP_ERRORS, GROUP_MESSAGES } from '../../constants/groups.constants.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapAdminGroupError(err: unknown, next: NextFunction): void {
  if (err instanceof GroupProposalNotFoundError) {
    return void next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUP_ERRORS.PROPOSAL_NOT_FOUND));
  }
  if (err instanceof ProposalNotPendingError) {
    return void next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, GROUP_ERRORS.PROPOSAL_NOT_PENDING));
  }
  if (err instanceof PostNotFoundError) {
    return void next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, GROUP_ERRORS.POST_NOT_FOUND));
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const groupsAdminController = {

  async listProposals(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'admin:groups:listProposals', requestId: req.requestId });
    try {
      const { status } = req.query as { status?: string };
      log.info('List group proposals', { adminId: req.user?.id, status });
      const proposals = await getGroupProposals(status);
      const body: ApiResponse<GroupProposalDto[]> = {
        success: true,
        data: proposals,
        meta: { total: proposals.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAdminGroupError(err, next); }
  },

  async approveProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'admin:groups:approveProposal', requestId: req.requestId });
    try {
      const adminId = req.user!.id;
      const { proposalId } = req.params as { proposalId: string };
      log.info('Approve group proposal', { adminId, proposalId });
      const result = await approveGroupProposal(adminId, proposalId);
      const body: ApiResponse<GroupProposalDto> = {
        success: true,
        data: result,
        meta: { message: GROUP_MESSAGES.PROPOSAL_APPROVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAdminGroupError(err, next); }
  },

  async rejectProposal(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'admin:groups:rejectProposal', requestId: req.requestId });
    try {
      const adminId = req.user!.id;
      const { proposalId } = req.params as { proposalId: string };
      const { reason } = req.body as { reason?: string };
      log.info('Reject group proposal', { adminId, proposalId });
      const result = await rejectGroupProposal(adminId, proposalId, reason);
      const body: ApiResponse<GroupProposalDto> = {
        success: true,
        data: result,
        meta: { message: GROUP_MESSAGES.PROPOSAL_REJECTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAdminGroupError(err, next); }
  },

  async pinPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'admin:groups:pinPost', requestId: req.requestId });
    try {
      const adminId = req.user!.id;
      const { postId } = req.params as { postId: string };
      log.info('Pin group post', { adminId, postId });
      await pinPost(adminId, postId);
      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: GROUP_MESSAGES.PINNED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAdminGroupError(err, next); }
  },

  async unpinPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'admin:groups:unpinPost', requestId: req.requestId });
    try {
      const adminId = req.user!.id;
      const { postId } = req.params as { postId: string };
      log.info('Unpin group post', { adminId, postId });
      await unpinPost(adminId, postId);
      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: GROUP_MESSAGES.UNPINNED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapAdminGroupError(err, next); }
  },
};
