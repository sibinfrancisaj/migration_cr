/**
 * SEED-004 — Seeder gateway auth bypass middleware.
 *
 * If `Authorization: Bearer <token>` matches `SEEDER_SECRET` env var AND
 * `NODE_ENV !== 'production'`, the payload `{ userId, role }` embedded
 * in the token (as a Base64-encoded JSON string after the secret) is decoded
 * and set on `req.user`, bypassing normal JWT auth entirely.
 *
 * Token format: `<SEEDER_SECRET>.<base64(JSON { userId, role })>`
 *
 * In production this middleware is a strict no-op — the header is ignored and
 * the request falls through to normal JWT requireAuth.
 *
 * ADR-014: SEEDER_SECRET Gateway Auth Bypass
 */
import type { Request, Response, NextFunction } from 'express';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { AppError } from './error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../constants/index.js';

const log = createChildLogger({ module: 'gateway:seeder-auth' });

export interface SeederUserPayload {
  userId: string;
  role: string;
  deviceId?: string;
}

/**
 * Parses and validates a seeder token.
 * Token: `<secret>.<base64url-encoded-JSON-payload>`
 * Returns the payload on success, null on any mismatch or invalid format.
 */
function parseSeederToken(
  token: string,
  secret: string,
): SeederUserPayload | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;

  const tokenSecret = token.slice(0, dotIdx);
  if (tokenSecret !== secret) return null;

  try {
    const payloadRaw = Buffer.from(token.slice(dotIdx + 1), 'base64url').toString('utf8');
    const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    if (typeof payload.userId !== 'string' || typeof payload.role !== 'string') return null;
    return {
      userId: payload.userId,
      role: payload.role,
      deviceId: typeof payload.deviceId === 'string' ? payload.deviceId : 'seeder-device',
    };
  } catch {
    return null;
  }
}

/**
 * Builds a seeder token for a given payload.
 * Used by the seeder service to construct Authorization headers.
 */
export function buildSeederToken(secret: string, payload: SeederUserPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${secret}.${encoded}`;
}

export function seederAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const env = getEnv();

  // In production: strict no-op — seeder token never accepted
  if (env.NODE_ENV === 'production') {
    next();
    return;
  }

  const seederSecret = env.SEEDER_SECRET;
  if (!seederSecret) {
    // SEEDER_SECRET not configured — skip silently, fall through to requireAuth
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const payload = parseSeederToken(token, seederSecret);

  if (!payload) {
    // Token present but not a valid seeder token — could be a JWT; pass through
    next();
    return;
  }

  // Valid seeder token — set req.user and skip requireAuth
  log.debug('Seeder auth bypass accepted', { userId: payload.userId, role: payload.role });
  req.user = { id: payload.userId, role: payload.role as any, deviceId: payload.deviceId ?? 'seeder-device' };
  next();
}

/**
 * Middleware that blocks requests where SEEDER_SECRET has already set req.user
 * from proceeding further — prevents seeder tokens from reaching admin-only routes.
 * Not needed in normal flow but available for extra hardening.
 */
export function blockSeederOnAdminRoutes(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // If req.user was set by seeder bypass and role is not an admin role, block
  const seederDeviceId = req.user?.deviceId === 'seeder-device';
  if (seederDeviceId && !['SUPERADMIN', 'ADMIN', 'MODERATOR'].includes(req.user?.role ?? '')) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, 'Seeder tokens cannot access admin routes'));
    return;
  }
  next();
}
