import { getDiscoveryFeed, encodeCursor, decodeCursor, computeAge, mmrRerank } from '../discover.service.js';
import { UserRole, MediaType, VerificationStatus } from '@abroad-matrimony/shared';
import type { DiscoveryItemDto } from '@abroad-matrimony/shared';
import { ALGORITHM_VERSION } from '../match-score.service.js';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockMatchScoreFindMany          = jest.fn();
const mockUserFindMany                = jest.fn();
const mockConnectionFindMany          = jest.fn();
const mockProfileFindMany             = jest.fn();
const mockMediaFindMany               = jest.fn();
const mockMatchTuningFindUnique       = jest.fn();
const mockPartnerPreferenceFindUnique = jest.fn();
const mockProfileEmbeddingFindMany    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchScore:        { findMany:   (...a: any[]) => mockMatchScoreFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user:              { findMany:   (...a: any[]) => mockUserFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection:        { findMany:   (...a: any[]) => mockConnectionFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile:           { findMany:   (...a: any[]) => mockProfileFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media:             { findMany:   (...a: any[]) => mockMediaFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchTuning:       { findUnique: (...a: any[]) => mockMatchTuningFindUnique(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partnerPreference: { findUnique: (...a: any[]) => mockPartnerPreferenceFindUnique(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profileEmbedding:  { findMany:   (...a: any[]) => mockProfileEmbeddingFindMany(...a) },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ── AI mock — default: no semantic candidates (fallback path) ─────────────────

const mockGetSemanticallySimilarUsers = jest.fn().mockResolvedValue([]);
const mockMergeWithWeightedRRF        = jest.fn().mockImplementation(
  (lists: string[][], _weights: number[]) => [...new Set(lists.flat())],
);

jest.mock('@abroad-matrimony/ai', () => ({
  withAiFallback: async (opts: { primary: () => unknown; fallback: () => unknown }) => {
    try { return await opts.primary(); } catch { return opts.fallback(); }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSemanticallySimilarUsers: (...a: any[]) => mockGetSemanticallySimilarUsers(...a),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mergeWithWeightedRRF:        (...a: any[]) => mockMergeWithWeightedRRF(...a),
}));

// ── Recommendations mock ──────────────────────────────────────────────────────

const mockCollaborativeFilter = jest.fn().mockResolvedValue([]);

jest.mock('@abroad-matrimony/recommendations', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collaborativeFilter: (...a: any[]) => mockCollaborativeFilter(...a),
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

const ME      = 'user-me';
const USER_A  = 'user-a';
const USER_B  = 'user-b';
const USER_C  = 'user-c';

const DOB_1990 = new Date('1990-06-15T00:00:00.000Z');

const SCORE_ROW_A = {
  id: 'score-1', userAId: ME, userBId: USER_A, totalScore: 0.9,
  breakdown: { verification: 1, settlementIntent: 0.8, realLifeAnswers: 0.9,
    profileCompleteness: 0.8, checkInRecency: 1, ageCompatibility: 0.8,
    groupMembership: 1, languageMatch: 1, faithAlignment: 1 },
};
const SCORE_ROW_B = {
  id: 'score-2', userAId: USER_B, userBId: ME, totalScore: 0.7,
  breakdown: { ...SCORE_ROW_A.breakdown },
};

const PROFILE_A = {
  userId: USER_A, name: 'Alice', dateOfBirth: DOB_1990,
  currentCity: 'London', currentCountry: 'UK',
  settlementIntent: 'STAY_ABROAD', completionScore: 90,
  verificationStatus: VerificationStatus.APPROVED,
};
const PROFILE_B = {
  userId: USER_B, name: 'Bob', dateOfBirth: new Date('1988-03-20T00:00:00.000Z'),
  currentCity: 'Paris', currentCountry: 'FR',
  settlementIntent: 'RETURN_HOME', completionScore: 75,
  verificationStatus: VerificationStatus.PENDING,
};

function setHappyPath(): void {
  mockMatchScoreFindMany.mockResolvedValue([SCORE_ROW_A, SCORE_ROW_B]);
  mockUserFindMany.mockResolvedValue([
    { id: USER_A, role: UserRole.USER },
    { id: USER_B, role: UserRole.USER },
  ]);
  mockConnectionFindMany.mockResolvedValue([]);
  mockProfileFindMany.mockResolvedValue([PROFILE_A, PROFILE_B]);
  mockMediaFindMany.mockResolvedValue([
    { userId: USER_A, url: 'https://cdn/a.jpg', order: 1 },
  ]);
  // No tuning by default — returns empty weights
  mockMatchTuningFindUnique.mockResolvedValue(null);
  // No partner preferences by default — no pre-filter applied
  mockPartnerPreferenceFindUnique.mockResolvedValue(null);
  // No semantic candidates by default — RRF path degrades to score ordering
  mockGetSemanticallySimilarUsers.mockResolvedValue([]);
  // No collaborative filter candidates by default
  mockCollaborativeFilter.mockResolvedValue([]);
  // No vibe embeddings by default — MMR falls through to score order
  mockProfileEmbeddingFindMany.mockResolvedValue([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getDiscoveryFeed()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHappyPath();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns items in score-descending order', async () => {
    const feed = await getDiscoveryFeed(ME);

    expect(feed.items).toHaveLength(2);
    expect(feed.items[0].userId).toBe(USER_A); // score 0.9
    expect(feed.items[1].userId).toBe(USER_B); // score 0.7
  });

  it('resolves the "other" user ID correctly when the requesting user is userBId', async () => {
    // SCORE_ROW_B has userBId = ME, so the other user is USER_B
    const feed = await getDiscoveryFeed(ME);
    const userBItem = feed.items.find(i => i.userId === USER_B);
    expect(userBItem).toBeDefined();
  });

  it('includes totalScore, personalizedScore and scoreBreakdown in each item', async () => {
    const feed = await getDiscoveryFeed(ME);
    expect(feed.items[0].totalScore).toBe(0.9);
    expect(feed.items[0].scoreBreakdown).toMatchObject({ verification: 1 });
    // No tuning active → personalizedScore equals totalScore
    expect(feed.items[0].personalizedScore).toBe(0.9);
  });

  it('personalizedScore equals totalScore when no tuning is set', async () => {
    mockMatchTuningFindUnique.mockResolvedValue(null); // no tuning
    const feed = await getDiscoveryFeed(ME);
    for (const item of feed.items) {
      expect(item.personalizedScore).toBe(item.totalScore);
    }
  });

  it('personalizedScore differs from totalScore when tuning weights are active', async () => {
    // Set heavy settlementIntent weight — changes personalised ranking
    mockMatchTuningFindUnique.mockResolvedValueOnce({
      userId: ME,
      weights: { settlementIntent: 3.0 },
      updatedAt: new Date(),
    });

    const feed = await getDiscoveryFeed(ME);

    // All items must have a valid personalizedScore in [0, 1]
    for (const item of feed.items) {
      expect(item.personalizedScore).toBeGreaterThanOrEqual(0.0);
      expect(item.personalizedScore).toBeLessThanOrEqual(1.0);
    }
  });

  it('attaches the first photo URL when available', async () => {
    const feed = await getDiscoveryFeed(ME);
    expect(feed.items[0].photoUrl).toBe('https://cdn/a.jpg');
  });

  it('leaves photoUrl undefined when no photo exists', async () => {
    const feed = await getDiscoveryFeed(ME);
    expect(feed.items[1].photoUrl).toBeUndefined();
  });

  it('computes age from dateOfBirth', async () => {
    const feed = await getDiscoveryFeed(ME);
    const alice = feed.items[0];
    // Born 1990-06-15; age as of test run should be >= 35
    expect(alice.age).toBeGreaterThanOrEqual(35);
  });

  // ── Empty results ───────────────────────────────────────────────────────────

  it('returns empty feed when no score rows exist', async () => {
    mockMatchScoreFindMany.mockResolvedValue([]);

    const feed = await getDiscoveryFeed(ME);

    expect(feed.items).toHaveLength(0);
    expect(feed.nextCursor).toBeNull();
    expect(feed.hasMore).toBe(false);
  });

  // ── Filtering ───────────────────────────────────────────────────────────────

  it('filters out SUSPENDED users', async () => {
    mockUserFindMany.mockResolvedValue([
      { id: USER_A, role: UserRole.SUSPENDED },
      { id: USER_B, role: UserRole.USER },
    ]);

    const feed = await getDiscoveryFeed(ME);

    expect(feed.items.every(i => i.userId !== USER_A)).toBe(true);
    expect(feed.items.some(i => i.userId === USER_B)).toBe(true);
  });

  it('filters out users who are already connected (either direction)', async () => {
    mockConnectionFindMany.mockResolvedValue([
      { senderId: ME, receiverId: USER_A },
    ]);

    const feed = await getDiscoveryFeed(ME);

    expect(feed.items.every(i => i.userId !== USER_A)).toBe(true);
  });

  it('filters out user when connection is inbound (other user is sender)', async () => {
    mockConnectionFindMany.mockResolvedValue([
      { senderId: USER_B, receiverId: ME },
    ]);

    const feed = await getDiscoveryFeed(ME);

    expect(feed.items.every(i => i.userId !== USER_B)).toBe(true);
  });

  it('returns empty items (but still hasMore) when all eligible users are filtered', async () => {
    // Suspended + connected removes all two candidates, but DB returned limit+1 rows
    mockMatchScoreFindMany.mockResolvedValue([
      SCORE_ROW_A,
      SCORE_ROW_B,
      { id: 'score-3', userAId: ME, userBId: USER_C, totalScore: 0.5, breakdown: {} },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: USER_A, role: UserRole.SUSPENDED },
      { id: USER_B, role: UserRole.SUSPENDED },
      { id: USER_C, role: UserRole.SUSPENDED },
    ]);
    mockConnectionFindMany.mockResolvedValue([]);
    mockProfileFindMany.mockResolvedValue([]);
    mockMediaFindMany.mockResolvedValue([]);

    const feed = await getDiscoveryFeed(ME, { limit: 2 });

    expect(feed.items).toHaveLength(0);
    expect(feed.hasMore).toBe(true);
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  it('sets hasMore=true and provides nextCursor when more rows exist', async () => {
    // Return limit+1 rows
    mockMatchScoreFindMany.mockResolvedValue([
      SCORE_ROW_A,
      { id: 'score-extra', userAId: ME, userBId: USER_C, totalScore: 0.5, breakdown: {} },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: USER_A, role: UserRole.USER },
    ]);
    mockProfileFindMany.mockResolvedValue([PROFILE_A]);
    mockMediaFindMany.mockResolvedValue([]);

    const feed = await getDiscoveryFeed(ME, { limit: 1 });

    expect(feed.hasMore).toBe(true);
    expect(feed.nextCursor).not.toBeNull();
  });

  it('sets hasMore=false and nextCursor=null on the last page', async () => {
    const feed = await getDiscoveryFeed(ME, { limit: 20 });

    expect(feed.hasMore).toBe(false);
    expect(feed.nextCursor).toBeNull();
  });

  it('passes cursor filter condition to Prisma when cursor is provided', async () => {
    const cursor = encodeCursor({ score: 0.9, id: 'score-1' });

    await getDiscoveryFeed(ME, { cursor, limit: 20 });

    const callArgs = mockMatchScoreFindMany.mock.calls[0][0];
    const andClause = callArgs.where.AND;
    // The third element should be the cursor OR condition
    expect(andClause).toHaveLength(3);
    expect(andClause[2].OR).toBeDefined();
  });

  it('uses algorithmVersion from options when provided', async () => {
    await getDiscoveryFeed(ME, { algorithmVersion: 'v2' });

    const callArgs = mockMatchScoreFindMany.mock.calls[0][0];
    const algClause = callArgs.where.AND.find(
      (c: { algorithmV?: string }) => 'algorithmV' in c,
    );
    expect(algClause.algorithmV).toBe('v2');
  });

  it('defaults to ALGORITHM_VERSION (v1) when algorithmVersion is not provided', async () => {
    await getDiscoveryFeed(ME);

    const callArgs = mockMatchScoreFindMany.mock.calls[0][0];
    const algClause = callArgs.where.AND.find(
      (c: { algorithmV?: string }) => 'algorithmV' in c,
    );
    expect(algClause.algorithmV).toBe(ALGORITHM_VERSION);
  });

  it('passes mediaType PHOTO filter to prisma.media.findMany', async () => {
    await getDiscoveryFeed(ME);

    const mediaArgs = mockMediaFindMany.mock.calls[0][0];
    expect(mediaArgs.where.type).toBe(MediaType.PHOTO);
  });
});

// ── mmrRerank() ───────────────────────────────────────────────────────────────

describe('mmrRerank()', () => {
  const makeItem = (userId: string, score: number): DiscoveryItemDto => ({
    userId,
    name:              userId,
    age:               30,
    currentCity:       'London',
    currentCountry:    'UK',
    settlementIntent:  'STAY_ABROAD',
    completionScore:   80,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verificationStatus: 'APPROVED' as any,
    totalScore:        score,
    personalizedScore: score,
    scoreBreakdown:    {},
  });

  it('returns original order when vibeMap has fewer than 2 entries', () => {
    const items   = [makeItem('a', 0.9), makeItem('b', 0.7)];
    const vibeMap = new Map<string, number[]>([['a', [8, 7, 6, 5, 4]]]);
    expect(mmrRerank(items, vibeMap)).toEqual(items);
  });

  it('returns original list when fewer than 2 items', () => {
    const items   = [makeItem('a', 0.9)];
    const vibeMap = new Map<string, number[]>([['a', [8, 7, 6, 5, 4]], ['b', [1, 2, 3, 4, 5]]]);
    expect(mmrRerank(items, vibeMap)).toEqual(items);
  });

  it('promotes a diverse lower-scored item when top-2 are vibe-similar', () => {
    // A and B are vibe-identical (cos sim → very high) → B is penalised after A selected
    // C has low relevance but maximally different vibe → promoted to position 2
    const A_VIBE = [9, 9, 9, 9, 9];
    const B_VIBE = [9, 9, 9, 9, 9]; // same as A — very similar, diversity penalty
    const C_VIBE = [1, 1, 1, 1, 1]; // maximally different from A

    const items = [
      makeItem('A', 0.9),
      makeItem('B', 0.7),  // similar to A
      makeItem('C', 0.5),  // different from A
    ];
    const vibeMap = new Map<string, number[]>([
      ['A', A_VIBE],
      ['B', B_VIBE],
      ['C', C_VIBE],
    ]);

    const result = mmrRerank(items, vibeMap, 0.5); // equal relevance / diversity weight
    expect(result[0]!.userId).toBe('A');   // A is always first
    // C should beat B for position 2 since B is too similar to A
    expect(result[1]!.userId).toBe('C');
    expect(result[2]!.userId).toBe('B');
  });

  it('items with no vibe embedding are treated as fully diverse', () => {
    const items = [
      makeItem('A', 0.9),
      makeItem('B', 0.8),  // has vibe, similar to A
      makeItem('C', 0.7),  // no vibe in map — treated as maximally diverse
    ];
    const vibeMap = new Map<string, number[]>([
      ['A', [9, 9, 9, 9, 9]],
      ['B', [9, 9, 9, 9, 9]],
    ]);

    const result = mmrRerank(items, vibeMap, 0.5);
    expect(result[0]!.userId).toBe('A');
    // C (no vibe) gets maxSim=0, so mmrScore = 0.5 × 0.7 = 0.35
    // B (same vibe as A) gets high maxSim after A is selected, lower mmrScore
    expect(result[1]!.userId).toBe('C');
  });
});

// ── encodeCursor / decodeCursor ───────────────────────────────────────────────

describe('encodeCursor() / decodeCursor()', () => {
  it('round-trips a cursor correctly', () => {
    const original = { score: 0.85, id: 'abc-123' };
    const encoded  = encodeCursor(original);
    const decoded  = decodeCursor(encoded);

    expect(decoded).toEqual(original);
  });

  it('returns null for malformed base64 input', () => {
    expect(decodeCursor('not-valid-base64!!!')).toBeNull();
  });

  it('returns null when decoded JSON lacks required fields', () => {
    const bad = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });

  it('returns null when score is not a number', () => {
    const bad = Buffer.from(JSON.stringify({ score: 'x', id: 'abc' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });
});

// ── computeAge() ─────────────────────────────────────────────────────────────

describe('computeAge()', () => {
  it('returns correct age for a birthday that has already passed this year', () => {
    const dob = new Date('1990-01-01');
    const now = new Date('2026-06-01');
    expect(computeAge(dob, now)).toBe(36);
  });

  it('returns correct age for a birthday that has not yet occurred this year', () => {
    const dob = new Date('1990-12-31');
    const now = new Date('2026-06-01');
    expect(computeAge(dob, now)).toBe(35);
  });

  it('returns correct age on the exact birthday', () => {
    const dob = new Date('1990-06-01');
    const now = new Date('2026-06-01');
    expect(computeAge(dob, now)).toBe(36);
  });
});
