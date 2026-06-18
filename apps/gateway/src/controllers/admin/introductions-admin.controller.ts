import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listAllDrops,
  getDropAdmin,
  approveDrop,
  updateDropMembers,
  scheduleDropRelease,
  proposeNewDrop,
  IntroductionDropNotFoundError,
  DropNotDraftError,
  DropNotEditableError,
  DropMemberPoolTooSmallError,
} from '@abroad-matrimony/introductions';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { INTRO_ADMIN_ERRORS, INTRO_ADMIN_MESSAGES } from '../../constants/introductions-admin.constants.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapDropAdminError(err: unknown, next: NextFunction): void {
  if (err instanceof IntroductionDropNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, INTRO_ADMIN_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof DropNotDraftError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, INTRO_ADMIN_ERRORS.NOT_DRAFT));
    return;
  }
  if (err instanceof DropNotEditableError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, INTRO_ADMIN_ERRORS.NOT_EDITABLE));
    return;
  }
  if (err instanceof DropMemberPoolTooSmallError) {
    next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, INTRO_ADMIN_ERRORS.POOL_TOO_SMALL));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const introductionsAdminController = {

  /**
   * GET /admin/introductions/drops?status=
   * List all drops with optional status filter.
   */
  async listDrops(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:drops:list', requestId: req.requestId });
    try {
      const status = req.query['status'] as string | undefined;
      log.info('Admin list drops', { status });

      const drops = await listAllDrops({ status });

      const body: ApiResponse<typeof drops> = {
        success: true,
        data: drops,
        meta: { total: drops.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropAdminError(err, next);
    }
  },

  /**
   * GET /admin/introductions/drops/:dropId
   * Get full admin detail for a single drop.
   */
  async getDropDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:drops:detail', requestId: req.requestId });
    try {
      const { dropId } = req.params;
      log.info('Admin get drop detail', { dropId });

      const detail = await getDropAdmin(dropId);

      const body: ApiResponse<typeof detail> = {
        success: true,
        data: detail,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropAdminError(err, next);
    }
  },

  /**
   * POST /admin/introductions/drops/propose
   * Manually create a new DRAFT drop (without AI curation).
   */
  async proposeDrop(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:drops:propose', requestId: req.requestId });
    try {
      log.info('Admin propose new drop');

      const drop = await proposeNewDrop(req.body);

      const body: ApiResponse<typeof drop> = {
        success: true,
        data: drop,
        meta: { message: INTRO_ADMIN_MESSAGES.DROP_PROPOSED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapDropAdminError(err, next);
    }
  },

  /**
   * PATCH /admin/introductions/drops/:dropId/approve
   * Approve a DRAFT drop — transitions to PENDING_APPROVAL + fires pairing generation.
   */
  async approveDrop(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:drops:approve', requestId: req.requestId });
    try {
      const { dropId } = req.params;
      log.info('Admin approve drop', { dropId });

      const drop = await approveDrop(dropId);

      const body: ApiResponse<typeof drop> = {
        success: true,
        data: drop,
        meta: { message: INTRO_ADMIN_MESSAGES.DROP_APPROVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropAdminError(err, next);
    }
  },

  /**
   * PATCH /admin/introductions/drops/:dropId/members
   * Update the member pool of an editable drop.
   */
  async updateMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:drops:members', requestId: req.requestId });
    try {
      const { dropId } = req.params;
      const { memberPool } = req.body as { memberPool: string[] };
      log.info('Admin update drop members', { dropId, poolSize: memberPool?.length });

      const drop = await updateDropMembers(dropId, memberPool);

      const body: ApiResponse<typeof drop> = {
        success: true,
        data: drop,
        meta: { message: INTRO_ADMIN_MESSAGES.MEMBERS_UPDATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropAdminError(err, next);
    }
  },

  /**
   * PATCH /admin/introductions/drops/:dropId/schedule
   * Set or update the releaseAt timestamp for an editable drop.
   */
  async scheduleDrop(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:drops:schedule', requestId: req.requestId });
    try {
      const { dropId } = req.params;
      const { releaseAt } = req.body as { releaseAt: string };
      log.info('Admin schedule drop release', { dropId, releaseAt });

      const drop = await scheduleDropRelease(dropId, new Date(releaseAt));

      const body: ApiResponse<typeof drop> = {
        success: true,
        data: drop,
        meta: { message: INTRO_ADMIN_MESSAGES.DROP_SCHEDULED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapDropAdminError(err, next);
    }
  },
};
