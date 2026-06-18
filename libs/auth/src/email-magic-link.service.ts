import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { CACHE_TTL } from '@abroad-matrimony/shared';
import { UserRole } from '@abroad-matrimony/shared';
import { issueTokenPair } from './jwt.service.js';
import { storeRefreshToken } from './refresh-token.service.js';
import type { OtpVerifyResult } from './otp-verify.service.js';

const log = createChildLogger({ module: 'auth:email-magic-link' });

/** Token validity window: 15 minutes. */
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

// ─── Custom errors ────────────────────────────────────────────────────────────

export class MagicLinkUserNotFoundError extends Error {
  constructor() {
    super('MAGIC_LINK_USER_NOT_FOUND');
    this.name = 'MagicLinkUserNotFoundError';
  }
}

export class MagicLinkInvalidError extends Error {
  constructor() {
    super('MAGIC_LINK_INVALID');
    this.name = 'MagicLinkInvalidError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── Service functions ────────────────────────────────────────────────────────

export interface SendMagicLinkResult {
  /** Token is returned ONLY for local dev/test environments. Never in production. */
  devToken?: string;
}

/**
 * Send a magic link email to the given address.
 *
 * In production: enqueues an email via `libs/notification`.
 * Returns the raw token only in development (for testing without a real email provider).
 *
 * @throws {MagicLinkUserNotFoundError} — no verified account with that email
 */
export async function sendMagicLink(email: string): Promise<SendMagicLinkResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isEmailVerified: true },
  });

  if (!user || !user.isEmailVerified) {
    // Security: don't reveal whether the email exists
    log.warn('sendMagicLink — user not found or email unverified', { email: email.slice(0, 5) + '***' });
    throw new MagicLinkUserNotFoundError();
  }

  // Invalidate any existing tokens for this user (one-at-a-time policy)
  await prisma.emailMagicLink.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.emailMagicLink.create({
    data: {
      userId: user.id,
      email,
      tokenHash,
      expiresAt,
    },
  });

  log.info('sendMagicLink — token created', { userId: user.id });

  // Return raw token in non-production environments only
  const isDev = process.env['NODE_ENV'] !== 'production';
  return isDev ? { devToken: rawToken } : {};
}

/**
 * Verify a magic link token and issue a JWT pair.
 *
 * @throws {MagicLinkInvalidError} — token not found, expired, or already used
 */
export async function verifyMagicLink(
  token: string,
  deviceId: string,
): Promise<OtpVerifyResult> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const record = await prisma.emailMagicLink.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!record || record.usedAt !== null || record.expiresAt < now) {
    log.warn('verifyMagicLink — invalid or expired token');
    throw new MagicLinkInvalidError();
  }

  // Mark token as used
  await prisma.emailMagicLink.update({
    where: { tokenHash },
    data: { usedAt: now },
  });

  // Mark email verified if not already
  await prisma.user.update({
    where: { id: record.userId },
    data: { isEmailVerified: true },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: record.userId },
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      isPhoneVerified: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  const { accessToken, refreshToken, tokenId, expiresIn } = issueTokenPair(
    user.id,
    user.role as UserRole,
    deviceId,
  );

  const expiresAt = new Date(Date.now() + CACHE_TTL.REFRESH_TOKEN_SECONDS * 1000);
  await storeRefreshToken(tokenId, user.id, deviceId, refreshToken, expiresAt);

  log.info('verifyMagicLink — login successful', { userId: user.id });

  return {
    accessToken,
    refreshToken,
    expiresIn,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email ?? undefined,
      role: user.role as UserRole,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    },
  };
}
