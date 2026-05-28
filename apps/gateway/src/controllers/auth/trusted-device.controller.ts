import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  trustedDeviceLoginService,
  checkTrustedDeviceRateLimit,
  DeviceNotTrustedError,
} from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import type { OtpVerifyResult } from '@abroad-matrimony/auth';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { AUTH_ERRORS, AUTH_MESSAGES } from '../../constants/auth.constants.js';

export const trustedDeviceController = {
  /**
   * POST /api/v1/auth/trusted-device
   *
   * Issues a fresh JWT pair for a returning user whose device is still within
   * its trust window — no Twilio OTP challenge required.
   *
   * The Flutter client sends the UUID it generated on first install and stored
   * in Keychain (iOS) or SharedPreferences (Android). If the device is unknown
   * or trust has expired, the client must fall back to the full OTP flow.
   *
   * Responses:
   *  200 — new { accessToken, refreshToken, expiresIn, user }
   *  401 — device unknown, not trusted, or trust expired (client → start OTP)
   *  429 — rate limit exceeded (10 attempts / phone / hour)
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:auth:trusted-device', requestId: req.requestId });

    try {
      const { phone, deviceFingerprint } = req.body as { phone: string; deviceFingerprint: string };

      log.info('Trusted device login attempt', { phone: phone.slice(0, 5) + '***' });

      // ── Rate limit check ──────────────────────────────────────────────────
      const rl = await checkTrustedDeviceRateLimit(phone);
      if (!rl.allowed) {
        next(
          new AppError(
            HTTP_STATUS.TOO_MANY_REQUESTS,
            ERROR_CODES.RATE_LIMITED,
            AUTH_ERRORS.TRUSTED_DEVICE_RATE_LIMITED,
            { retryAfterSeconds: rl.retryAfterSeconds },
          ),
        );
        return;
      }

      // ── Service call ──────────────────────────────────────────────────────
      const result = await trustedDeviceLoginService({ phone, deviceFingerprint });

      const body: ApiResponse<OtpVerifyResult> = {
        success:   true,
        data:      result,
        meta:      { message: AUTH_MESSAGES.TRUSTED_DEVICE_LOGIN },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof DeviceNotTrustedError) {
        next(
          new AppError(
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.UNAUTHORIZED,
            AUTH_ERRORS.DEVICE_NOT_TRUSTED,
          ),
        );
        return;
      }
      next(err);
    }
  },
};
