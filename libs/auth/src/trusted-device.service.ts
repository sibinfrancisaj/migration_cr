import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { UserRole, CACHE_KEYS } from '@abroad-matrimony/shared';
import { CACHE_TTL } from '@abroad-matrimony/shared';
import { cacheIncrBy, cacheExpire, getRedisClient } from '@abroad-matrimony/cache';
import type { RateLimitResult } from './otp.rate-limit.js';
import { issueTokenPair } from './jwt.service.js';
import { storeRefreshToken } from './refresh-token.service.js';
import type { OtpVerifyResult } from './otp-verify.service.js';

const log = createChildLogger({ module: 'auth:trusted-device' });

/** Max trusted-device bypass attempts per phone per hour. */
const TRUSTED_DEVICE_RATE_LIMIT_MAX     = 10;
const TRUSTED_DEVICE_RATE_LIMIT_WINDOW  = 3600; // seconds

// ── Error classes ─────────────────────────────────────────────────────────────

/**
 * Thrown when a device is unknown, not trusted, or trust has expired.
 * Always map to HTTP 401 — never expose which condition triggered it.
 */
export class DeviceNotTrustedError extends Error {
  constructor() {
    super('DEVICE_NOT_TRUSTED');
    this.name = 'DeviceNotTrustedError';
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

/**
 * Rate-limits the trusted-device endpoint to 10 attempts per phone per hour.
 * More lenient than OTP (10 vs 3) because no SMS cost, but still blocks
 * fingerprint enumeration attacks.
 */
export async function checkTrustedDeviceRateLimit(phone: string): Promise<RateLimitResult> {
  const key = CACHE_KEYS.TRUSTED_DEVICE_ATTEMPTS(phone);

  const current = await cacheIncrBy(key, 1);

  if (current === 1) {
    await cacheExpire(key, TRUSTED_DEVICE_RATE_LIMIT_WINDOW);
  }

  if (current > TRUSTED_DEVICE_RATE_LIMIT_MAX) {
    const ttl = await getRedisClient().ttl(key);
    return {
      allowed:           false,
      retryAfterSeconds: ttl > 0 ? ttl : TRUSTED_DEVICE_RATE_LIMIT_WINDOW,
    };
  }

  return { allowed: true };
}

// ── Service ───────────────────────────────────────────────────────────────────

export interface TrustedDeviceLoginInput {
  phone:             string;
  deviceFingerprint: string;
}

/**
 * Issues a new JWT pair for a returning user on a previously-trusted device,
 * without requiring an OTP challenge.
 *
 * Security invariants:
 * - Phone number must match a verified user row.
 * - deviceFingerprint must match a device row owned by that user.
 * - isTrusted must be true AND trustedExpiresAt must be in the future.
 * - All failure cases throw DeviceNotTrustedError (same error, no oracle).
 *
 * Callers must apply checkTrustedDeviceRateLimit() before calling this function.
 */
export async function trustedDeviceLoginService(
  input: TrustedDeviceLoginInput,
): Promise<OtpVerifyResult> {
  const { phone, deviceFingerprint } = input;

  // ── 1. Resolve user ────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isPhoneVerified) {
    log.warn('Trusted device attempt — user not found or not verified', {
      phone: phone.slice(0, 5) + '***',
    });
    throw new DeviceNotTrustedError();
  }

  // ── 2. Resolve device ──────────────────────────────────────────────────────
  const device = await prisma.device.findUnique({
    where: { userId_fingerprint: { userId: user.id, fingerprint: deviceFingerprint } },
  });

  if (!device) {
    log.warn('Trusted device attempt — device not found', { userId: user.id });
    throw new DeviceNotTrustedError();
  }

  // ── 3. Validate trust window ───────────────────────────────────────────────
  const now = new Date();
  const trusted =
    device.isTrusted &&
    device.trustedExpiresAt !== null &&
    device.trustedExpiresAt > now;

  if (!trusted) {
    log.info('Trusted device attempt — trust absent or expired', {
      userId:          user.id,
      deviceId:        device.id,
      isTrusted:       device.isTrusted,
      trustedExpiresAt: device.trustedExpiresAt?.toISOString() ?? 'null',
    });
    throw new DeviceNotTrustedError();
  }

  // ── 4. Issue JWT pair ──────────────────────────────────────────────────────
  const { accessToken, refreshToken, tokenId, expiresIn } = issueTokenPair(
    user.id,
    user.role as UserRole,
    device.id,
  );

  // ── 5. Persist refresh token ───────────────────────────────────────────────
  const expiresAt = new Date(now.getTime() + CACHE_TTL.REFRESH_TOKEN_SECONDS * 1000);
  await storeRefreshToken(tokenId, user.id, device.id, refreshToken, expiresAt);

  // ── 6. Bump lastSeenAt ─────────────────────────────────────────────────────
  await prisma.device.update({
    where: { id: device.id },
    data:  { lastSeenAt: now },
  });

  log.info('Trusted device login issued', { userId: user.id, deviceId: device.id });

  return {
    accessToken,
    refreshToken,
    expiresIn,
    user: {
      id:              user.id,
      phone:           user.phone,
      email:           user.email ?? undefined,
      role:            user.role as UserRole,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
      createdAt:       user.createdAt,
    },
  };
}
