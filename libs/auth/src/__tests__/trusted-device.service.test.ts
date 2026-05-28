import { trustedDeviceLoginService, checkTrustedDeviceRateLimit, DeviceNotTrustedError } from '../trusted-device.service.js';

// ── Mock dependencies ─────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@abroad-matrimony/db', () => ({ prisma: { user: {}, device: {} } }));
jest.mock('@abroad-matrimony/cache', () => ({
  cacheIncrBy:    jest.fn(),
  cacheExpire:    jest.fn(),
  getRedisClient: jest.fn(),
}));
jest.mock('../jwt.service.js', () => ({
  issueTokenPair: jest.fn(),
}));
jest.mock('../refresh-token.service.js', () => ({
  storeRefreshToken: jest.fn(),
}));

const { prisma }           = jest.requireMock('@abroad-matrimony/db') as { prisma: any };
const { cacheIncrBy, cacheExpire, getRedisClient } =
  jest.requireMock('@abroad-matrimony/cache') as {
    cacheIncrBy:    jest.Mock;
    cacheExpire:    jest.Mock;
    getRedisClient: jest.Mock;
  };
const { issueTokenPair }   = jest.requireMock('../jwt.service.js') as { issueTokenPair: jest.Mock };
const { storeRefreshToken } = jest.requireMock('../refresh-token.service.js') as { storeRefreshToken: jest.Mock };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PHONE   = '+919876543210';
const FINGER  = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-uuid-1';

const mockUser = {
  id:              USER_ID,
  phone:           PHONE,
  email:           null,
  role:            'USER',
  isPhoneVerified: true,
  isEmailVerified: false,
  createdAt:       new Date('2026-01-01'),
};

const futureTrust = new Date(Date.now() + 90 * 24 * 3600 * 1000);
const pastTrust   = new Date(Date.now() - 1);

const mockDevice = (overrides: Record<string, unknown> = {}) => ({
  id:              'device-uuid-1',
  userId:          USER_ID,
  fingerprint:     FINGER,
  isTrusted:       true,
  trustedAt:       new Date(),
  trustedExpiresAt: futureTrust,
  lastSeenAt:      new Date(),
  ...overrides,
});

// ── checkTrustedDeviceRateLimit ───────────────────────────────────────────────

describe('checkTrustedDeviceRateLimit()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns allowed:true when under limit', async () => {
    cacheIncrBy.mockResolvedValue(1);
    cacheExpire.mockResolvedValue(undefined);

    const result = await checkTrustedDeviceRateLimit(PHONE);

    expect(result.allowed).toBe(true);
    expect(cacheExpire).toHaveBeenCalledWith(expect.any(String), 3600);
  });

  it('sets expiry only on the first increment', async () => {
    cacheIncrBy.mockResolvedValue(5); // not the first call
    cacheExpire.mockResolvedValue(undefined);

    await checkTrustedDeviceRateLimit(PHONE);

    expect(cacheExpire).not.toHaveBeenCalled();
  });

  it('returns allowed:false with retryAfterSeconds when limit exceeded', async () => {
    cacheIncrBy.mockResolvedValue(11);
    getRedisClient.mockReturnValue({ ttl: jest.fn().mockResolvedValue(1800) });

    const result = await checkTrustedDeviceRateLimit(PHONE);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(1800);
  });

  it('falls back to window seconds when TTL is negative', async () => {
    cacheIncrBy.mockResolvedValue(11);
    getRedisClient.mockReturnValue({ ttl: jest.fn().mockResolvedValue(-1) });

    const result = await checkTrustedDeviceRateLimit(PHONE);

    expect(result.retryAfterSeconds).toBe(3600);
  });
});

// ── trustedDeviceLoginService ─────────────────────────────────────────────────

describe('trustedDeviceLoginService()', () => {
  const TOKEN_RESULT = {
    accessToken:  'access-token',
    refreshToken: 'refresh-token',
    tokenId:      'token-id-1',
    expiresIn:    900,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user   = { findUnique: jest.fn() };
    prisma.device = { findUnique: jest.fn(), update: jest.fn() };
    issueTokenPair.mockReturnValue(TOKEN_RESULT);
    storeRefreshToken.mockResolvedValue(undefined);
    prisma.device.update.mockResolvedValue({});
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('issues tokens when device is trusted and within expiry', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.device.findUnique.mockResolvedValue(mockDevice());

    const result = await trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER });

    expect(result.accessToken).toBe('access-token');
    expect(result.user.id).toBe(USER_ID);
    expect(issueTokenPair).toHaveBeenCalledWith(USER_ID, 'USER', 'device-uuid-1');
    expect(storeRefreshToken).toHaveBeenCalled();
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSeenAt: expect.any(Date) }) }),
    );
  });

  // ── User not found / not verified ──────────────────────────────────────────

  it('throws DeviceNotTrustedError when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER }))
      .rejects.toThrow(DeviceNotTrustedError);
  });

  it('throws DeviceNotTrustedError when user phone is not verified', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, isPhoneVerified: false });

    await expect(trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER }))
      .rejects.toThrow(DeviceNotTrustedError);
  });

  // ── Device not found ───────────────────────────────────────────────────────

  it('throws DeviceNotTrustedError when device fingerprint is unknown', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.device.findUnique.mockResolvedValue(null);

    await expect(trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER }))
      .rejects.toThrow(DeviceNotTrustedError);
  });

  // ── Trust not set ──────────────────────────────────────────────────────────

  it('throws DeviceNotTrustedError when isTrusted is false', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.device.findUnique.mockResolvedValue(mockDevice({ isTrusted: false }));

    await expect(trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER }))
      .rejects.toThrow(DeviceNotTrustedError);
  });

  it('throws DeviceNotTrustedError when trustedExpiresAt is null', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.device.findUnique.mockResolvedValue(mockDevice({ trustedExpiresAt: null }));

    await expect(trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER }))
      .rejects.toThrow(DeviceNotTrustedError);
  });

  it('throws DeviceNotTrustedError when trust has expired', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.device.findUnique.mockResolvedValue(mockDevice({ trustedExpiresAt: pastTrust }));

    await expect(trustedDeviceLoginService({ phone: PHONE, deviceFingerprint: FINGER }))
      .rejects.toThrow(DeviceNotTrustedError);
  });

  // ── Error class shape ──────────────────────────────────────────────────────

  it('DeviceNotTrustedError has the right name and message', () => {
    const err = new DeviceNotTrustedError();
    expect(err.name).toBe('DeviceNotTrustedError');
    expect(err.message).toBe('DEVICE_NOT_TRUSTED');
    expect(err).toBeInstanceOf(Error);
  });
});
