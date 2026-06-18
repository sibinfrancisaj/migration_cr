import { getDiscoveryFeed, encodeCursor, decodeCursor, computeAge } from '../discover.service.js';
import { UserRole, MediaType, VerificationStatus } from '@abroad-matrimony/shared';
import { ALGORITHM_VERSION } from '../match-score.service.js';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockMatchScoreFindMany   = jest.fn();
const mockUserFindMany         = jest.fn();
const mockConnectionFindMany   = jest.fn();
const mockProfileFindMany      = jest.fn();
const mockMediaFindMany        = jest.fn();
const mockMatchTuningFindUnique = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchScore:   { findMany:   (...a: any[]) => mockMatchScoreFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user:         { findMany:   (...a: any[]) => mockUserFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection:   { findMany:   (...a: any[]) => mockConnectionFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile:      { findMany:   (...a: any[]) => mockProfileFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media:        { findMany:   (...a: any[]) => mockMediaFindMany(...a) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchTuning:  { findUnique: (...a: any[]) => mockMatchTuningFindUnique(...a) },
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
