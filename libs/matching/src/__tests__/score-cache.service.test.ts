import { getMatchScore, setMatchScoreCache, deleteMatchScoreCache } from '../score-cache.service.js';
import { CACHE_KEYS, CACHE_TTL } from '@abroad-matrimony/shared';
import type { MatchScoreDto } from '@abroad-matrimony/shared';

// ── Cache mock ────────────────────────────────────────────────────────────────

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();

jest.mock('@abroad-matrimony/cache', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockMatchScoreFindUnique = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    matchScore: {
      findUnique: (...args: unknown[]) => mockMatchScoreFindUnique(...args),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPUTED_AT = new Date('2026-05-28T10:00:00.000Z');

const DB_MATCH_SCORE_ROW = {
  userAId:    'user-a',
  userBId:    'user-b',
  totalScore: 0.85,
  breakdown: {
    verification: 1.0, settlementIntent: 0.8, realLifeAnswers: 0.9,
    profileCompleteness: 0.8, checkInRecency: 1.0, ageCompatibility: 0.8,
    groupMembership: 1.0, languageMatch: 1.0, faithAlignment: 1.0,
  },
  algorithmV: 'v1',
  computedAt: COMPUTED_AT,
};

const MATCH_SCORE_DTO: MatchScoreDto = {
  userAId:    'user-a',
  userBId:    'user-b',
  totalScore: 0.85,
  breakdown:  DB_MATCH_SCORE_ROW.breakdown as MatchScoreDto['breakdown'],
  computedAt: COMPUTED_AT,
};

/** The canonical cache key for the (user-a, user-b) pair. */
const PAIR_CACHE_KEY = CACHE_KEYS.MATCH_SCORE_PAIR('user-a', 'user-b');

// ── getMatchScore() ───────────────────────────────────────────────────────────

describe('getMatchScore()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);           // default: cache miss
    mockCacheSet.mockResolvedValue('OK');
    mockMatchScoreFindUnique.mockResolvedValue(DB_MATCH_SCORE_ROW);
  });

  // ── Cache hit ───────────────────────────────────────────────────────────────

  it('returns the cached DTO on a cache hit without querying the DB', async () => {
    mockCacheGet.mockResolvedValueOnce({
      ...MATCH_SCORE_DTO,
      computedAt: COMPUTED_AT.toISOString(), // stored as string in Redis
    });

    const result = await getMatchScore('user-a', 'user-b');

    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(0.85);
    expect(mockMatchScoreFindUnique).not.toHaveBeenCalled();
  });

  it('re-hydrates computedAt from an ISO string back to a Date on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({
      ...MATCH_SCORE_DTO,
      computedAt: COMPUTED_AT.toISOString(),
    });

    const result = await getMatchScore('user-a', 'user-b');

    expect(result!.computedAt).toBeInstanceOf(Date);
    expect(result!.computedAt.getTime()).toBe(COMPUTED_AT.getTime());
  });

  it('uses the canonical pair key (smaller UUID first) for the Redis lookup', async () => {
    mockCacheGet.mockResolvedValueOnce({
      ...MATCH_SCORE_DTO,
      computedAt: COMPUTED_AT.toISOString(),
    });

    // Call with reversed pair order
    await getMatchScore('user-b', 'user-a');

    expect(mockCacheGet).toHaveBeenCalledWith(PAIR_CACHE_KEY);
  });

  // ── Cache miss → DB fallback ────────────────────────────────────────────────

  it('falls back to the DB on a cache miss and returns a MatchScoreDto', async () => {
    const result = await getMatchScore('user-a', 'user-b');

    expect(result).not.toBeNull();
    expect(result!.userAId).toBe('user-a');
    expect(result!.userBId).toBe('user-b');
    expect(result!.totalScore).toBe(0.85);
    expect(mockMatchScoreFindUnique).toHaveBeenCalledTimes(1);
  });

  it('populates the cache after a DB hit', async () => {
    await getMatchScore('user-a', 'user-b');

    expect(mockCacheSet).toHaveBeenCalledWith(
      PAIR_CACHE_KEY,
      expect.objectContaining({ totalScore: 0.85 }),
      CACHE_TTL.MATCH_SCORES_SECONDS,
    );
  });

  it('returns null when neither the cache nor the DB has the score', async () => {
    mockMatchScoreFindUnique.mockResolvedValueOnce(null);

    const result = await getMatchScore('user-a', 'user-b');

    expect(result).toBeNull();
  });

  it('does not populate the cache when the DB returns null', async () => {
    mockMatchScoreFindUnique.mockResolvedValueOnce(null);

    await getMatchScore('user-a', 'user-b');

    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  // ── Redis error resilience ──────────────────────────────────────────────────

  it('falls through to the DB when Redis read throws', async () => {
    mockCacheGet.mockRejectedValueOnce(new Error('Redis timeout'));

    const result = await getMatchScore('user-a', 'user-b');

    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(0.85);
    expect(mockMatchScoreFindUnique).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the cache-write after a DB hit fails', async () => {
    mockCacheSet.mockRejectedValueOnce(new Error('Redis write failed'));

    await expect(getMatchScore('user-a', 'user-b')).resolves.not.toBeNull();
  });

  // ── Canonicalization ────────────────────────────────────────────────────────

  it('produces the same result regardless of the order arguments are passed', async () => {
    const [resultAB, resultBA] = await Promise.all([
      getMatchScore('user-a', 'user-b'),
      getMatchScore('user-a', 'user-b'),
    ]);

    // Both should use the same canonical DB query key
    const calls = mockMatchScoreFindUnique.mock.calls;
    const keyAB = calls[0][0].where.userAId_userBId_algorithmV;
    const keyBA = calls[1][0].where.userAId_userBId_algorithmV;

    expect(keyAB.userAId).toBe(keyBA.userAId);
    expect(keyAB.userBId).toBe(keyBA.userBId);
    expect(resultAB).toEqual(resultBA);
  });
});

// ── setMatchScoreCache() ──────────────────────────────────────────────────────

describe('setMatchScoreCache()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheSet.mockResolvedValue('OK');
  });

  it('stores the DTO under the canonical pair key with the configured TTL', async () => {
    await setMatchScoreCache(MATCH_SCORE_DTO);

    expect(mockCacheSet).toHaveBeenCalledWith(
      PAIR_CACHE_KEY,
      MATCH_SCORE_DTO,
      CACHE_TTL.MATCH_SCORES_SECONDS,
    );
  });

  it('uses the canonical key even when userBId < userAId', async () => {
    const reversedDto: MatchScoreDto = {
      ...MATCH_SCORE_DTO,
      userAId: 'user-b',
      userBId: 'user-a',
    };

    await setMatchScoreCache(reversedDto);

    // Key should still be user-a:user-b (canonical order)
    expect(mockCacheSet).toHaveBeenCalledWith(
      PAIR_CACHE_KEY,
      expect.any(Object),
      expect.any(Number),
    );
  });

  it('does not throw when Redis write fails', async () => {
    mockCacheSet.mockRejectedValueOnce(new Error('Redis down'));

    await expect(setMatchScoreCache(MATCH_SCORE_DTO)).resolves.toBeUndefined();
  });
});

// ── deleteMatchScoreCache() ───────────────────────────────────────────────────

describe('deleteMatchScoreCache()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheDel.mockResolvedValue(1);
  });

  it('deletes the canonical pair key from Redis', async () => {
    await deleteMatchScoreCache('user-a', 'user-b');

    expect(mockCacheDel).toHaveBeenCalledWith(PAIR_CACHE_KEY);
  });

  it('uses the canonical key when called with reversed pair order', async () => {
    await deleteMatchScoreCache('user-b', 'user-a');

    expect(mockCacheDel).toHaveBeenCalledWith(PAIR_CACHE_KEY);
  });

  it('does not throw when Redis delete fails', async () => {
    mockCacheDel.mockRejectedValueOnce(new Error('Redis down'));

    await expect(
      deleteMatchScoreCache('user-a', 'user-b'),
    ).resolves.toBeUndefined();
  });
});
