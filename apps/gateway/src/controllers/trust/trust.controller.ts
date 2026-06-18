import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  blockUser,
  unblockUser,
  listBlocks,
  reportUser,
  getTrustCenter,
  setPrivacyControls,
  pauseVisibility,
  resumeVisibility,
  getAccessLevelDefinitions,
  AlreadyBlockedError,
  BlockNotFoundError,
  BlockSelfError,
  ReportSelfError,
  TrustCenterNotFoundError,
  PrivacyProfileNotFoundError,
  PauseProfileNotFoundError,
} from '@abroad-matrimony/trust';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { FlagReason } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { TRUST_ERRORS, TRUST_MESSAGES } from '../../constants/trust.constants.js';
import type {
  BlockUserBody,
  UserIdParams,
  ReportUserBody,
  PrivacyControlsBody,
} from '../../schemas/trust/trust.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapTrustError(err: unknown, next: NextFunction): void {
  if (err instanceof AlreadyBlockedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, TRUST_ERRORS.ALREADY_BLOCKED));
    return;
  }
  if (err instanceof BlockNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, TRUST_ERRORS.BLOCK_NOT_FOUND));
    return;
  }
  if (err instanceof BlockSelfError) {
    next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, TRUST_ERRORS.BLOCK_SELF));
    return;
  }
  if (err instanceof ReportSelfError) {
    next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, TRUST_ERRORS.REPORT_SELF));
    return;
  }
  if (
    err instanceof TrustCenterNotFoundError ||
    err instanceof PrivacyProfileNotFoundError ||
    err instanceof PauseProfileNotFoundError
  ) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, TRUST_ERRORS.PROFILE_NOT_FOUND));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const trustController = {
  async block(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:block', requestId: req.requestId });
    try {
      const blockerId = req.user!.id;
      const { userId: blockedId, reason } = req.body as BlockUserBody;

      log.info('Block user', { blockerId, blockedId });

      const dto = await blockUser(blockerId, blockedId, reason);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: TRUST_MESSAGES.BLOCKED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:unblock', requestId: req.requestId });
    try {
      const blockerId = req.user!.id;
      const { userId: blockedId } = req.params as unknown as UserIdParams;

      log.info('Unblock user', { blockerId, blockedId });

      await unblockUser(blockerId, blockedId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: TRUST_MESSAGES.UNBLOCKED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async listBlocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:list-blocks', requestId: req.requestId });
    try {
      const userId = req.user!.id;

      log.info('List blocks', { userId });

      const blocks = await listBlocks(userId);

      const body: ApiResponse<typeof blocks> = {
        success: true,
        data: blocks,
        meta: { total: blocks.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  async report(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:report', requestId: req.requestId });
    try {
      const reporterId = req.user!.id;
      const { targetUserId, reason, description } = req.body as ReportUserBody;

      log.info('Report user', { reporterId, targetUserId, reason });

      const dto = await reportUser(reporterId, targetUserId, reason as FlagReason, description);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: TRUST_MESSAGES.REPORT_SUBMITTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async getTrustCenter(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:center', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get trust center', { userId });

      const dto = await getTrustCenter(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async setPrivacyControls(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:privacy', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const settings = req.body as PrivacyControlsBody;

      log.info('Set privacy controls', { userId });

      const dto = await setPrivacyControls(userId, settings);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: TRUST_MESSAGES.PRIVACY_UPDATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async pauseVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:pause', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Pause visibility', { userId });

      const dto = await pauseVisibility(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: TRUST_MESSAGES.VISIBILITY_PAUSED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async resumeVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:trust:resume', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Resume visibility', { userId });

      const dto = await resumeVisibility(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: TRUST_MESSAGES.VISIBILITY_RESUMED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapTrustError(err, next);
    }
  },

  async getAccessLevels(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const levels = getAccessLevelDefinitions();

      const body: ApiResponse<typeof levels> = {
        success: true,
        data: levels,
        meta: { total: levels.length },
        requestId: _req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },
};
