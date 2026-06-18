import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  toggleProfilePause,
  getVoiceIntroUploadUrl,
  saveVoiceIntro,
  ProfileNotFoundError,
} from '@abroad-matrimony/profile';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PROFILE_ERRORS } from '../../constants/profile.constants.js';
import type { VoiceIntroUploadBody, SaveVoiceIntroBody } from '../../schemas/profile/voice-intro.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapProfileError(err: unknown, next: NextFunction): void {
  if (err instanceof ProfileNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROFILE_ERRORS.NOT_FOUND));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const profileExtensionsController = {
  /**
   * PUT /api/v1/profile/pause
   * Toggle the isPaused flag. Paused profiles don't appear in discovery.
   */
  async togglePause(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:pause', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Toggle profile pause', { userId });

      const result = await toggleProfilePause(userId);

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: { message: result.isPaused ? 'Profile paused' : 'Profile unpaused' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapProfileError(err, next);
    }
  },

  /**
   * POST /api/v1/profile/voice-intro/upload-url
   * Get a pre-signed S3 URL to upload a voice intro.
   */
  async getVoiceUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:voice-intro:upload-url', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { mimeType } = req.body as VoiceIntroUploadBody;

      log.info('Get voice intro upload URL', { userId, mimeType });

      const result = await getVoiceIntroUploadUrl(userId, mimeType);

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: { message: 'Upload URL generated' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapProfileError(err, next);
    }
  },

  /**
   * POST /api/v1/profile/voice-intro
   * Register an uploaded voice intro S3 key.
   * Replaces any existing voice intro.
   */
  async saveVoiceIntro(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:voice-intro:save', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { s3Key } = req.body as SaveVoiceIntroBody;

      log.info('Save voice intro', { userId, s3Key });

      const result = await saveVoiceIntro(userId, s3Key);

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: { message: 'Voice intro saved' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapProfileError(err, next);
    }
  },
};
