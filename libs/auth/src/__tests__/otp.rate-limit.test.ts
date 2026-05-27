import { checkAndIncrOtpRateLimit } from '../otp.rate-limit.js';

const mockIncrBy = jest.fn();
const mockExpire = jest.fn();
const mockTtl = jest.fn();

jest.mock('@abroad-matrimony/cache', () => ({
  cacheIncrBy: (...args: unknown[]) => mockIncrBy(...args),
  cacheExpire: (...args: unknown[]) => mockExpire(...args),
  getRedisClient: () => ({ ttl: (...args: unknown[]) => mockTtl(...args) }),
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    OTP_RATE_LIMIT_MAX: 3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

const PHONE = '+919876543210';

describe('checkAndIncrOtpRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExpire.mockResolvedValue(undefined);
    mockTtl.mockResolvedValue(3500);
  });

  it('allows the first request and sets expiry window', async () => {
    mockIncrBy.mockResolvedValueOnce(1);

    const result = await checkAndIncrOtpRateLimit(PHONE);

    expect(result.allowed).toBe(true);
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining(PHONE),
      3600,
    );
  });

  it('allows up to the configured max (3rd request)', async () => {
    mockIncrBy.mockResolvedValueOnce(3);

    const result = await checkAndIncrOtpRateLimit(PHONE);

    expect(result.allowed).toBe(true);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('blocks the 4th request and returns retryAfterSeconds from TTL', async () => {
    mockIncrBy.mockResolvedValueOnce(4);
    mockTtl.mockResolvedValueOnce(2700);

    const result = await checkAndIncrOtpRateLimit(PHONE);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(2700);
  });

  it('falls back to window seconds when TTL is -1 (no expiry set)', async () => {
    mockIncrBy.mockResolvedValueOnce(5);
    mockTtl.mockResolvedValueOnce(-1);

    const result = await checkAndIncrOtpRateLimit(PHONE);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(3600);
  });

  it('does not set expiry on second or later increments within a window', async () => {
    mockIncrBy.mockResolvedValueOnce(2);

    await checkAndIncrOtpRateLimit(PHONE);

    expect(mockExpire).not.toHaveBeenCalled();
  });
});
