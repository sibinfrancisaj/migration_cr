import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listVerifications,
  getVerificationAdmin,
  approveVerification,
  rejectVerification,
  VerificationRequestNotFoundError,
  VerificationAlreadyReviewedError,
} from '@abroad-matrimony/verification';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const VERIFICATION_ADMIN_ERRORS = {
  NOT_FOUND:       'Verification request not found',
  ALREADY_REVIEWED: 'Verification request has already been reviewed',
} as const;

function mapVerificationError(err: unknown, next: NextFunction): void {
  if (err instanceof VerificationRequestNotFoundError) { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, VERIFICATION_ADMIN_ERRORS.NOT_FOUND)); return; }
  if (err instanceof VerificationAlreadyReviewedError) { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  VERIFICATION_ADMIN_ERRORS.ALREADY_REVIEWED)); return; }
  next(err);
}

export const verificationAdminController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:verification:list', requestId: req.requestId });
    try {
      const { status, limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list verifications', { status });
      const result = await listVerifications({ status, limit: limit ? Number(limit) : undefined, cursor });
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapVerificationError(err, next); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:verification:get', requestId: req.requestId });
    try {
      const { requestId } = req.params;
      log.info('Admin get verification', { requestId });
      const data = await getVerificationAdmin(requestId);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapVerificationError(err, next); }
  },

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:verification:approve', requestId: req.requestId });
    try {
      const { requestId } = req.params;
      log.info('Admin approve verification', { requestId });
      const data = await approveVerification(requestId, req.admin!.id, req.ip ?? '');
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: 'Verification approved' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapVerificationError(err, next); }
  },

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:verification:reject', requestId: req.requestId });
    try {
      const { requestId } = req.params;
      const { reason } = req.body as { reason: string };
      log.info('Admin reject verification', { requestId });
      const data = await rejectVerification(requestId, reason, req.admin!.id, req.ip ?? '');
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: 'Verification rejected' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapVerificationError(err, next); }
  },
};
