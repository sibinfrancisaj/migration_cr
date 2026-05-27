import { checkAdminLoginRateLimit } from '../admin.rate-limit.js';

const mockIncrBy = jest.fn();
const mockExpire = jest.fn();
const mockTtl    = jest.fn();

jest.mock('@abroad-matrimony/cache', () => ({
  cacheIncrBy:    (...args: unknown[]) => mockIncrBy(...args),
  cacheExpire:    (...args: unknown[]) => mockExpire(...args),
  getRedisClient: () => ({ ttl: (...args: unknown[]) => mockTtl(...args) }),
}));

const EMAIL = 'admin@abroadmatrimony.com';

describe('checkAdminLoginRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExpire.mockResolvedValue(undefined);
    mockTtl.mockResolvedValue(800);
  });

  it('allows the first request and sets the TTL window', async () => {
    mockIncrBy.mockResolvedValueOnce(1);

    const result = await checkAdminLoginRateLimit(EMAIL);

    expect(result.allowed).toBe(true);
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining(EMAIL),
      900,
    );
  });

  it('allows requests up to the max (10th attempt)', async () => {
    mockIncrBy.mockResolvedValueOnce(10);

    const result = await checkAdminLoginRateLimit(EMAIL);

    expect(result.allowed).toBe(true);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('blocks the 11th attempt and returns retryAfterSeconds from TTL', async () => {
    mockIncrBy.mockResolvedValueOnce(11);
    mockTtl.mockResolvedValueOnce(600);

    const result = await checkAdminLoginRateLimit(EMAIL);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(600);
  });

  it('falls back to window (900s) when TTL returns -1', async () => {
    mockIncrBy.mockResolvedValueOnce(12);
    mockTtl.mockResolvedValueOnce(-1);

    const result = await checkAdminLoginRateLimit(EMAIL);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(900);
  });

  it('does not set TTL on subsequent increments within the same window', async () => {
    mockIncrBy.mockResolvedValueOnce(5);

    await checkAdminLoginRateLimit(EMAIL);

    expect(mockExpire).not.toHaveBeenCalled();
  });
});
