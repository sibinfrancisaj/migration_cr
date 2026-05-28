import { createChildLogger } from '@abroad-matrimony/logger';
import { prisma } from '@abroad-matrimony/db';
import { publish } from '@abroad-matrimony/event-bus';
import { CLOUD_EVENT_TYPES, MAX_DEVICES_PER_USER } from '@abroad-matrimony/shared';
import type { UserDto } from '@abroad-matrimony/shared';
import { UserRole } from '@abroad-matrimony/shared';
import { getEnv } from '@abroad-matrimony/config';
import { verifyOtp } from './otp.service.js';
import { issueTokenPair } from './jwt.service.js';
import { storeRefreshToken } from './refresh-token.service.js';
import { CACHE_TTL } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'auth:otp-verify' });

export class OtpInvalidError extends Error {
  constructor() {
    super('OTP_INVALID');
    this.name = 'OtpInvalidError';
  }
}

export class DeviceLimitError extends Error {
  constructor() {
    super('DEVICE_LIMIT_EXCEEDED');
    this.name = 'DeviceLimitError';
  }
}

export interface OtpVerifyInput {
  phone: string;
  code: string;
  deviceFingerprint: string;
  deviceName?: string;
  platform?: string;
}

export interface OtpVerifyResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}

export async function otpVerifyService(input: OtpVerifyInput): Promise<OtpVerifyResult> {
  const { phone, code, deviceFingerprint, deviceName, platform } = input;

  // 1. Verify OTP code — fail fast before any DB work
  const isValid = await verifyOtp(phone, code);
  if (!isValid) throw new OtpInvalidError();

  // 2. Upsert user — find existing or create new
  let wasCreated = false;
  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    user = await prisma.user.create({
      data: { phone, isPhoneVerified: true },
    });
    wasCreated = true;
    log.info('New user created', { userId: user.id });
  } else if (!user.isPhoneVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isPhoneVerified: true },
    });
  }

  // 3. Upsert device — check limit only when it's a new fingerprint.
  //    Mark / renew device trust on every successful OTP so the TTL window slides forward.
  const now = new Date();
  const ttlDays = getEnv().TRUSTED_DEVICE_TTL_DAYS;
  const trustedExpiresAt = new Date(now.getTime() + ttlDays * 24 * 3600 * 1000);

  let device = await prisma.device.findUnique({
    where: { userId_fingerprint: { userId: user.id, fingerprint: deviceFingerprint } },
  });

  if (!device) {
    const deviceCount = await prisma.device.count({ where: { userId: user.id } });
    if (deviceCount >= MAX_DEVICES_PER_USER) throw new DeviceLimitError();

    device = await prisma.device.create({
      data: {
        userId:          user.id,
        fingerprint:     deviceFingerprint,
        name:            deviceName,
        platform,
        isTrusted:       true,
        trustedAt:       now,
        trustedExpiresAt,
      },
    });
  } else {
    // Renew trust window on every successful OTP on a known device
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt:      now,
        isTrusted:       true,
        trustedAt:       now,
        trustedExpiresAt,
        ...(deviceName && { name: deviceName }),
        ...(platform && { platform }),
      },
    });
  }

  // 4. Issue JWT pair
  const { accessToken, refreshToken, tokenId, expiresIn } = issueTokenPair(
    user.id,
    user.role as UserRole,
    device.id,
  );

  // 5. Store refresh token (Redis + DB)
  const expiresAt = new Date(Date.now() + CACHE_TTL.REFRESH_TOKEN_SECONDS * 1000);
  await storeRefreshToken(tokenId, user.id, device.id, refreshToken, expiresAt);

  // 6. Publish USER_REGISTERED only after DB write confirms a new user row (ADR-008)
  if (wasCreated) {
    await publish(
      CLOUD_EVENT_TYPES.USER_REGISTERED,
      { userId: user.id, phone: phone.slice(0, 5) + '***' },
      `user:${user.id}`,
    );
    log.info('USER_REGISTERED event published', { userId: user.id });
  }

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
