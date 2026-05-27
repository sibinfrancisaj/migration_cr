import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getEnv } from '@abroad-matrimony/config';
import type { JwtPayload } from '@abroad-matrimony/shared';
import { UserRole } from '@abroad-matrimony/shared';

const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 900s — matches JWT_ACCESS_EXPIRES_IN default '15m'

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
