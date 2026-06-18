import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  submitVerification,
  getVerificationStatus,
  getTrustScore,
  getVerificationUploadUrl,
  VerificationAlreadySubmittedError,
} from '@abroad-matrimony/verification';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { VERIFICATION_ERRORS, VERIFICATION_MESSAGES } from '../../constants/verification.constants.js';
import type { SubmitVerificationBody, VerificationUploadUrlQuery } from '../../schemas/verification/verification.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapVerificationError(err: unknown, next: NextFunction): void {
  if (err instanceof VerificationAlreadySubmittedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, VERIFICATION_ERRORS.ALREADY_SUBMITTED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const verificationController = {
  /**
   * GET /api/v1/verification/upload-url?fileType=id_document|selfie&mimeType=...
   * Get a pre-signed upload URL for a verification document.
   */
  async getUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:verification:upload-url', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { fileType, mimeType } = req.query as unknown as VerificationUploadUrlQuery;

      log.info('Verification upload URL requested', { userId, fileType });

      const result = await getVerificationUploadUrl(userId, fileType, mimeType);

      const body: ApiResponse<{ uploadUrl: string; s3Key: string }> = {
        success: true,
        data: result,
        meta: { message: VERIFICATION_MESSAGES.UPLOAD_URL_GENERATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapVerificationError(err, next);
    }
  },

  /**
   * POST /api/v1/verification
   * Submit identity verification documents.
   */
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:verification:submit', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { idDocType, idDocS3Key, selfieS3Key } = req.body as SubmitVerificationBody;

      log.info('Verification submission', { userId, idDocType });

      const dto = await submitVerification(userId, idDocType, idDocS3Key, selfieS3Key);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: VERIFICATION_MESSAGES.SUBMITTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapVerificationError(err, next);
    }
  },

  /**
   * GET /api/v1/verification/status
   * Get the user's current verification status.
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:verification:status', requestId: req.requestId });
    try {
      const userId = req.user!.id;

      log.info('Verification status requested', { userId });

      const dto = await getVerificationStatus(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/verification/trust-score
   * Get the user's trust score breakdown.
   */
  async getTrustScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:verification:trust-score', requestId: req.requestId });
    try {
      const userId = req.user!.id;

      log.info('Trust score requested', { userId });

      const dto = await getTrustScore(userId);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },
};
