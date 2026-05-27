import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  checkAndIncrOtpRateLimit,
  getOtpAdapter,
  otpVerifyService,
  OtpInvalidError,
  DeviceLimitError,
} from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { AUTH_ERRORS, AUTH_MESSAGES, OTP_EXPIRY_SECONDS } from '../../constants/auth.constants.js';
import type { OtpRequestBody } from '../../schemas/auth/otp-request.schema.js';
import type { OtpVerifyBody } from '../../schemas/auth/otp-verify.schema.js';

export const otpController = {
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:otp-request', requestId: req.requestId });
    try {
      const { phone } = req.body as OtpRequestBody;

      const { allowed, retryAfterSeconds } = await checkAndIncrOtpRateLimit(phone);
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSeconds ?? 3600));
        throw new AppError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          ERROR_CODES.RATE_LIMITED,
          AUTH_ERRORS.OTP_RATE_LIMITED,
          { retryAfterSeconds },
        );
      }

      await getOtpAdapter().send(phone);

      log.info('OTP requested', { phone: phone.slice(0, 5) + '***' });

      const body: ApiResponse<{ message: string; expiresInSeconds: number }> = {
        success: true,
        data: { message: AUTH_MESSAGES.OTP_SENT, expiresInSeconds: OTP_EXPIRY_SECONDS },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:otp-verify', requestId: req.requestId });
    try {
      const input = req.body as OtpVerifyBody;

      const result = await otpVerifyService(input);

      log.info('OTP verified', { userId: result.user.id });

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof OtpInvalidError) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, AUTH_ERRORS.OTP_INVALID));
        return;
      }
      if (err instanceof DeviceLimitError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, AUTH_ERRORS.DEVICE_LIMIT_EXCEEDED));
        return;
      }
      next(err);
    }
  },
};
