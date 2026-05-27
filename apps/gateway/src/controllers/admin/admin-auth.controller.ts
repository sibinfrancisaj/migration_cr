import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  checkAdminLoginRateLimit,
  adminLoginService,
  AdminCredentialsError,
  AdminTotpRequiredError,
  AdminTotpInvalidError,
} from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { ADMIN_ERRORS } from '../../constants/admin.constants.js';
import type { AdminLoginBody } from '../../schemas/admin/admin-login.schema.js';
import type { AdminLoginResult } from '@abroad-matrimony/auth';

export const adminAuthController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin-login', requestId: req.requestId });
    try {
      const { email, password, totpCode } = req.body as AdminLoginBody;

      // Rate-limit check — before any credential work
      const { allowed, retryAfterSeconds } = await checkAdminLoginRateLimit(email);
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSeconds ?? 900));
        throw new AppError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          ERROR_CODES.RATE_LIMITED,
          ADMIN_ERRORS.RATE_LIMITED,
          { retryAfterSeconds },
        );
      }

      const result = await adminLoginService({ email, password, totpCode });

      log.info('Admin login successful', { adminId: result.admin.id, role: result.admin.role });

      const body: ApiResponse<AdminLoginResult> = {
        success: true,
        data: result,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof AdminCredentialsError) {
        // Same 401 for wrong email or wrong password — prevents enumeration
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, ADMIN_ERRORS.INVALID_CREDENTIALS));
        return;
      }
      if (err instanceof AdminTotpRequiredError) {
        next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, ADMIN_ERRORS.TOTP_REQUIRED));
        return;
      }
      if (err instanceof AdminTotpInvalidError) {
        next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, ADMIN_ERRORS.TOTP_INVALID));
        return;
      }
      next(err);
    }
  },
};
