import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { UserRole } from '@abroad-matrimony/shared';
import { verifyAccessToken } from '../jwt.service.js';

const log = createChildLogger({ module: 'auth:require-auth' });

/**
 * Express middleware that enforces a valid JWT access token.
 *
 * On success: attaches `req.user = { id, role, deviceId }` and calls next().
 * On failure: passes an AppError-compatible plain error to next() so the
 *   gateway error middleware renders the correct HTTP status.
 *
 * Errors raised here are plain objects (not AppError) so libs/auth stays
 * decoupled from the gateway's AppError class. The gateway error middleware
 * already handles objects with `statusCode` + `code` + `message`.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.requestId;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log.warn('Missing or malformed Authorization header', { requestId });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      requestId,
    });
    return;
  }

  const token = authHeader.slice(7); // strip 'Bearer '
  const payload = verifyAccessToken(token);

  if (!payload) {
    log.warn('Invalid or expired access token', { requestId });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      requestId,
    });
    return;
  }

  if (payload.role === UserRole.SUSPENDED) {
    log.warn('Suspended user attempted access', { requestId, userId: payload.sub });
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Account suspended.' },
      requestId,
    });
    return;
  }

  req.user = { id: payload.sub, role: payload.role, deviceId: payload.deviceId };
  next();
}
