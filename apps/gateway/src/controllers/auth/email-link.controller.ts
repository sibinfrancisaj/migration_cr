import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  sendMagicLink,
  verifyMagicLink,
  MagicLinkUserNotFoundError,
  MagicLinkInvalidError,
} from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import type {
  SendEmailLinkBody,
  VerifyEmailLinkBody,
} from '../../schemas/auth/email-link.schema.js';

export const emailLinkController = {
  /**
   * POST /api/v1/auth/email/link
   *
   * Send a magic login link to the given email address.
   * Always returns 200 to prevent email enumeration.
   */
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:auth:email-link:send', requestId: req.requestId });
    try {
      const { email } = req.body as SendEmailLinkBody;

      log.info('Send magic link', { email: email.slice(0, 4) + '***' });

      let devToken: string | undefined;
      try {
        const result = await sendMagicLink(email);
        devToken = result.devToken;
      } catch (err) {
        if (err instanceof MagicLinkUserNotFoundError) {
          // Return 200 regardless to prevent enumeration
          const body: ApiResponse<null> = {
            success: true,
            data: null,
            meta: { message: 'If a verified account exists for that email, a magic link has been sent.' },
            requestId: req.requestId,
          };
          res.status(HTTP_STATUS.OK).json(body);
          return;
        }
        throw err;
      }

      const body: ApiResponse<{ devToken?: string }> = {
        success: true,
        data: devToken ? { devToken } : {},
        meta: { message: 'If a verified account exists for that email, a magic link has been sent.' },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/email/verify
   *
   * Verify the magic link token and issue a JWT pair.
   * 401 if token is invalid, expired, or already used.
   */
  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:auth:email-link:verify', requestId: req.requestId });
    try {
      const { token, deviceId } = req.body as VerifyEmailLinkBody;

      log.info('Verify magic link token');

      const result = await verifyMagicLink(token, deviceId);

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof MagicLinkInvalidError) {
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired magic link'));
        return;
      }
      next(err);
    }
  },
};
