import { createHash } from 'crypto';
import { prisma } from '@abroad-matrimony/db';
import { cacheSet, cacheDel, cacheGet } from '@abroad-matrimony/cache';
import { CACHE_KEYS, CACHE_TTL } from '@abroad-matrimony/shared';

export interface StoredRefreshToken {
  userId: string;
  deviceId: string;
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function storeRefreshToken(
  tokenId: string,
  userId: string,
  deviceId: string,
  rawToken: string,
  expiresAt: Date,
): Promise<void> {
  const tokenHash = hashToken(rawToken);

  await Promise.all([
    cacheSet(
      CACHE_KEYS.REFRESH_TOKEN(tokenId),
      { userId, deviceId } satisfies StoredRefreshToken,
      CACHE_TTL.REFRESH_TOKEN_SECONDS,
    ),
    prisma.refreshToken.create({
      data: { id: tokenId, userId, deviceId, tokenHash, expiresAt },
    }),
  ]);
}

export async function getStoredRefreshToken(tokenId: string): Promise<StoredRefreshToken | null> {
  const cached = await cacheGet<StoredRefreshToken>(CACHE_KEYS.REFRESH_TOKEN(tokenId));
  if (cached) return cached;

  const record = await prisma.refreshToken.findUnique({ where: { id: tokenId } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

  return { userId: record.userId, deviceId: record.deviceId };
}

export async function revokeToken(tokenId: string): Promise<void> {
  await Promise.all([
    cacheDel(CACHE_KEYS.REFRESH_TOKEN(tokenId)),
    prisma.refreshToken.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function revokeForDevice(userId: string, deviceId: string): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, deviceId, revokedAt: null },
    select: { id: true },
  });

  await Promise.all([
    ...tokens.map((t) => cacheDel(CACHE_KEYS.REFRESH_TOKEN(t.id))),
    prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function revokeAllForUser(userId: string): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });

  await Promise.all([
    ...tokens.map((t) => cacheDel(CACHE_KEYS.REFRESH_TOKEN(t.id))),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
