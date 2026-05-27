import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { tokenRefreshService, TokenInvalidError, TokenReuseError } from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { AUTH_ERRORS } from '../../constants/auth.constants.js';
import type { TokenRefreshBody } from '../../schemas/auth/token-refresh.schema.js';

export const tokenController = {
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:token-refresh', requestId: req.requestId });
    try {
      const { refreshToken } = req.body as TokenRefreshBody;

      const result = await tokenRefreshService({ refreshToken });

      log.info('Token pair rotated successfully');

      const body: ApiResponse<typeof result> = {
        success: true,
        data: result,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof TokenReuseError) {
        // Log at warn level — this is a security event worth monitoring
        log.warn('Token reuse detected during refresh', { err: err.message });
        // Return the same 401 response as an invalid token — do not leak reuse information
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, AUTH_ERRORS.TOKEN_INVALID));
        return;
      }
      if (err instanceof TokenInvalidError) {
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, AUTH_ERRORS.TOKEN_INVALID));
        return;
      }
      next(err);
    }
  },
};
