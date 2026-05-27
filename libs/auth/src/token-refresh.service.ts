import { createChildLogger } from '@abroad-matrimony/logger';
import { prisma } from '@abroad-matrimony/db';
import { CACHE_TTL } from '@abroad-matrimony/shared';
import type { UserRole } from '@abroad-matrimony/shared';
import { verifyRefreshToken } from './jwt.service.js';
import { issueTokenPair } from './jwt.service.js';
import { getStoredRefreshToken, revokeToken, revokeAllForUser, storeRefreshToken } from './refresh-token.service.js';

const log = createChildLogger({ module: 'auth:token-refresh' });

export class TokenInvalidError extends Error {
  constructor() {
    super('TOKEN_INVALID');
    this.name = 'TokenInvalidError';
  }
}

export class TokenReuseError extends Error {
  constructor() {
    super('TOKEN_REUSE_DETECTED');
    this.name = 'TokenReuseError';
  }
}

export interface TokenRefreshInput {
  refreshToken: string;
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function tokenRefreshService(input: TokenRefreshInput): Promise<TokenRefreshResult> {
  const { refreshToken } = input;

  // 1. Verify JWT signature and expiry — fast-fail before any DB work
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw new TokenInvalidError();

  const { sub: userId, jti: tokenId, deviceId } = payload;

  // 2. Check if token is still valid in Redis / DB
  //    getStoredRefreshToken returns null when the token has already been revoked
  //    or is not found — either case is a reuse attempt (token was already consumed)
  const stored = await getStoredRefreshToken(tokenId);
  if (!stored) {
    // Reuse detected: the caller presented a revoked token.
    // Revoke ALL sessions for this user immediately to contain potential breach.
    log.warn('Refresh token reuse detected — revoking all user sessions', { userId });
    await revokeAllForUser(userId);
    throw new TokenReuseError();
  }

  // 3. Atomically revoke the old token before issuing a new pair (one-time-use guarantee)
  await revokeToken(tokenId);

  // 4. Fetch user's current role from DB — role may have changed since the token was issued
  //    (e.g. user upgraded to FOUNDING_MEMBER, or was suspended by admin)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) {
    // Account deleted after token was issued — treat as invalid token
    throw new TokenInvalidError();
  }

  // 5. Issue a new token pair
  const { accessToken, refreshToken: newRefreshToken, tokenId: newTokenId, expiresIn } = issueTokenPair(
    userId,
    user.role as UserRole,
    deviceId,
  );

  // 6. Store new refresh token (Redis + DB)
  const expiresAt = new Date(Date.now() + CACHE_TTL.REFRESH_TOKEN_SECONDS * 1000);
  await storeRefreshToken(newTokenId, userId, deviceId, newRefreshToken, expiresAt);

  log.info('Refresh token rotated', { userId, deviceId });

  return { accessToken, refreshToken: newRefreshToken, expiresIn };
}
