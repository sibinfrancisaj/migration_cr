import {
  storeRefreshToken,
  getStoredRefreshToken,
  revokeToken,
  revokeForDevice,
  revokeAllForUser,
  hashToken,
} from '../refresh-token.service.js';

const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();
const mockCacheGet = jest.fn();
const mockPrismaRefreshTokenCreate = jest.fn();
const mockPrismaRefreshTokenFindUnique = jest.fn();
const mockPrismaRefreshTokenUpdateMany = jest.fn();
const mockPrismaRefreshTokenFindMany = jest.fn();

jest.mock('@abroad-matrimony/cache', () => ({
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
}));

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    refreshToken: {
      create: (...args: unknown[]) => mockPrismaRefreshTokenCreate(...args),
      findUnique: (...args: unknown[]) => mockPrismaRefreshTokenFindUnique(...args),
      updateMany: (...args: unknown[]) => mockPrismaRefreshTokenUpdateMany(...args),
      findMany: (...args: unknown[]) => mockPrismaRefreshTokenFindMany(...args),
    },
  },
}));

jest.mock('@abroad-matrimony/shared', () => ({
  CACHE_KEYS: {
    REFRESH_TOKEN: (id: string) => `am:rt:${id}`,
  },
  CACHE_TTL: {
    REFRESH_TOKEN_SECONDS: 2592000,
  },
}));

const TOKEN_ID = 'token-uuid-123';
const USER_ID = 'user-uuid-456';
const DEVICE_ID = 'device-uuid-789';
const RAW_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
const EXPIRES_AT = new Date(Date.now() + 2592000 * 1000);

describe('hashToken', () => {
  it('returns a 64-char hex SHA-256 hash', () => {
    const hash = hashToken(RAW_TOKEN);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashToken(RAW_TOKEN)).toBe(hashToken(RAW_TOKEN));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken(RAW_TOKEN)).not.toBe(hashToken(RAW_TOKEN + 'x'));
  });
});

describe('storeRefreshToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue(undefined);
    mockPrismaRefreshTokenCreate.mockResolvedValue({});
  });

  it('writes to Redis with correct key and TTL', async () => {
    await storeRefreshToken(TOKEN_ID, USER_ID, DEVICE_ID, RAW_TOKEN, EXPIRES_AT);

    expect(mockCacheSet).toHaveBeenCalledWith(
      `am:rt:${TOKEN_ID}`,
      { userId: USER_ID, deviceId: DEVICE_ID },
      2592000,
    );
  });

  it('writes to DB with hashed token', async () => {
    await storeRefreshToken(TOKEN_ID, USER_ID, DEVICE_ID, RAW_TOKEN, EXPIRES_AT);

    expect(mockPrismaRefreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: TOKEN_ID,
        userId: USER_ID,
        deviceId: DEVICE_ID,
        tokenHash: hashToken(RAW_TOKEN),
        expiresAt: EXPIRES_AT,
      }),
    });
  });
});

describe('getStoredRefreshToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns from Redis on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ userId: USER_ID, deviceId: DEVICE_ID });

    const result = await getStoredRefreshToken(TOKEN_ID);

    expect(result).toEqual({ userId: USER_ID, deviceId: DEVICE_ID });
    expect(mockPrismaRefreshTokenFindUnique).not.toHaveBeenCalled();
  });

  it('falls back to DB on Redis miss', async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockPrismaRefreshTokenFindUnique.mockResolvedValueOnce({
      id: TOKEN_ID,
      userId: USER_ID,
      deviceId: DEVICE_ID,
      revokedAt: null,
      expiresAt: EXPIRES_AT,
    });

    const result = await getStoredRefreshToken(TOKEN_ID);
    expect(result).toEqual({ userId: USER_ID, deviceId: DEVICE_ID });
  });

  it('returns null for a revoked token (DB fallback)', async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockPrismaRefreshTokenFindUnique.mockResolvedValueOnce({
      revokedAt: new Date(),
      expiresAt: EXPIRES_AT,
    });

    expect(await getStoredRefreshToken(TOKEN_ID)).toBeNull();
  });

  it('returns null for an expired token (DB fallback)', async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockPrismaRefreshTokenFindUnique.mockResolvedValueOnce({
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await getStoredRefreshToken(TOKEN_ID)).toBeNull();
  });
});

describe('revokeToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheDel.mockResolvedValue(undefined);
    mockPrismaRefreshTokenUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('deletes from Redis and marks revoked in DB', async () => {
    await revokeToken(TOKEN_ID);

    expect(mockCacheDel).toHaveBeenCalledWith(`am:rt:${TOKEN_ID}`);
    expect(mockPrismaRefreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: TOKEN_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('revokeAllForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheDel.mockResolvedValue(undefined);
    mockPrismaRefreshTokenUpdateMany.mockResolvedValue({ count: 2 });
  });

  it('deletes all Redis keys and marks all DB tokens revoked', async () => {
    mockPrismaRefreshTokenFindMany.mockResolvedValueOnce([
      { id: 'token-1' },
      { id: 'token-2' },
    ]);

    await revokeAllForUser(USER_ID);

    expect(mockCacheDel).toHaveBeenCalledWith('am:rt:token-1');
    expect(mockCacheDel).toHaveBeenCalledWith('am:rt:token-2');
    expect(mockPrismaRefreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('revokeForDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheDel.mockResolvedValue(undefined);
    mockPrismaRefreshTokenUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('deletes only the Redis keys for the given device', async () => {
    mockPrismaRefreshTokenFindMany.mockResolvedValueOnce([{ id: 'token-device-1' }]);

    await revokeForDevice(USER_ID, DEVICE_ID);

    expect(mockCacheDel).toHaveBeenCalledWith(`am:rt:token-device-1`);
    expect(mockCacheDel).toHaveBeenCalledTimes(1);
  });

  it('marks only device tokens as revoked in DB (scoped by userId + deviceId)', async () => {
    mockPrismaRefreshTokenFindMany.mockResolvedValueOnce([{ id: 'token-device-1' }]);

    await revokeForDevice(USER_ID, DEVICE_ID);

    expect(mockPrismaRefreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, deviceId: DEVICE_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('does nothing when no active tokens exist for the device', async () => {
    mockPrismaRefreshTokenFindMany.mockResolvedValueOnce([]);

    await revokeForDevice(USER_ID, DEVICE_ID);

    expect(mockCacheDel).not.toHaveBeenCalled();
    // updateMany still runs — it's a no-op on the DB side when no rows match
    expect(mockPrismaRefreshTokenUpdateMany).toHaveBeenCalledTimes(1);
  });
});
