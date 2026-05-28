import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { createFirebaseToken, FirebaseNotConfiguredError } from '@abroad-matrimony/messaging';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { MESSAGING_ERRORS, MESSAGING_MESSAGES } from '../../constants/messaging.constants.js';

export const firebaseTokenController = {
  /**
   * GET /api/v1/auth/firebase-token
   *
   * Issues a Firebase custom auth token for the authenticated user.
   * Flutter clients exchange this for a Firebase ID token via
   * `signInWithCustomToken()` to authenticate direct Firestore reads.
   *
   * 503 when Firebase credentials are not configured on this server.
   */
  async getToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:auth:firebase-token', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Firebase token requested', { userId });

      const token = await createFirebaseToken(userId);

      const body: ApiResponse<{ token: string }> = {
        success: true,
        data: { token },
        meta: { message: MESSAGING_MESSAGES.FIREBASE_TOKEN_ISSUED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof FirebaseNotConfiguredError) {
        next(
          new AppError(
            HTTP_STATUS.SERVICE_UNAVAILABLE,
            ERROR_CODES.INTERNAL,
            MESSAGING_ERRORS.FIREBASE_NOT_CONFIGURED,
          ),
        );
        return;
      }
      next(err);
    }
  },
};
