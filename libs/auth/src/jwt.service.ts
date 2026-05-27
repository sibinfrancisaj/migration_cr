import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getEnv } from '@abroad-matrimony/config';
import type { JwtPayload, AdminJwtPayload } from '@abroad-matrimony/shared';
import { UserRole, AdminRole } from '@abroad-matrimony/shared';

const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;    // 900s  — matches JWT_ACCESS_EXPIRES_IN default '15m'
const ADMIN_TOKEN_EXPIRY_SECONDS  = 8 * 60 * 60; // 28800s — matches ADMIN_JWT_EXPIRES_IN default '8h'

export interface TokenPairResult {
  accessToken: string;
  refreshToken: string;
  tokenId: string;
  expiresIn: number;
}

export function issueTokenPair(userId: string, role: UserRole, deviceId: string): TokenPairResult {
  const env = getEnv();
  const tokenId = randomUUID();

  const accessToken = jwt.sign(
    { sub: userId, role, deviceId } as object,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  const refreshToken = jwt.sign(
    { sub: userId, jti: tokenId, deviceId } as object,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  return { accessToken, refreshToken, tokenId, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const env = getEnv();
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { sub: string; jti: string; deviceId: string } | null {
  try {
    const env = getEnv();
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; jti: string; deviceId: string };
  } catch {
    return null;
  }
}

// ── Admin JWT ─────────────────────────────────────────────────────────────────

export interface AdminTokenResult {
  accessToken: string;
  expiresIn: number; // seconds (28800 = 8h)
}

/**
 * Issues a single-use admin access token (no refresh token — admins re-auth each session).
 * Signed with ADMIN_JWT_SECRET, expires in 8h.
 */
export function issueAdminToken(adminId: string, role: AdminRole, email: string): AdminTokenResult {
  const env = getEnv();

  const accessToken = jwt.sign(
    { sub: adminId, role, email } as object,
    env.ADMIN_JWT_SECRET,
    { expiresIn: env.ADMIN_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  return { accessToken, expiresIn: ADMIN_TOKEN_EXPIRY_SECONDS };
}

/**
 * Verifies an admin JWT signed with ADMIN_JWT_SECRET.
 * Returns the payload or null if invalid / expired.
 */
export function verifyAdminToken(token: string): AdminJwtPayload | null {
  try {
    const env = getEnv();
    return jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminJwtPayload;
  } catch {
    return null;
  }
}
