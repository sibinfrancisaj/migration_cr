import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { exportUserData, deleteAccount, AccountAlreadyDeletedError } from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

export const gdprController = {
  /**
   * POST /api/v1/profile/export-data
   * Compiles a data export summary for the authenticated user (GDPR Art. 15).
   * Full Firestore message export is queued separately (future F-039).
   */
  async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:gdpr:export', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Data export requested', { userId });

      const summary = await exportUserData(userId);

      const body: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
        meta: { message: 'Your data export summary is ready. A full export will be emailed within 30 days.' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/v1/profile
   * Soft-deletes and anonymises the authenticated user's account (GDPR Art. 17).
   */
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:gdpr:delete', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Account deletion requested', { userId });

      await deleteAccount(userId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: 'Your account has been deleted. PII has been anonymised.' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof AccountAlreadyDeletedError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, 'Account is already deleted.'));
        return;
      }
      next(err);
    }
  },
};
