import { computeAndSaveScore, getUserScoringData, UserProfileMissingError } from '../match-score.service.js';
import { RealLifeQuestionKey, VerificationStatus } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockProfileFindUnique     = jest.fn();
const mockRLAnswerFindMany      = jest.fn();
const mockCheckInFindFirst      = jest.fn();
const mockGroupMemberFindMany   = jest.fn();
const mockMatchScoreUpsert      = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    },
    realLifeAnswer: {
      findMany: (...args: unknown[]) => mockRLAnswerFindMany(...args),
    },
    checkIn: {
      findFirst: (...args: unknown[]) => mockCheckInFindFirst(...args),
    },
    groupMember: {
      findMany: (...args: unknown[]) => mockGroupMemberFindMany(...args),
    },
    matchScore: {
      upsert: (...args: unknown[]) => mockMatchScoreUpsert(...args),
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

// ── Cache mock (score-cache.service is a dependency of match-score.service) ──

const mockSetMatchScoreCache = jest.fn();
jest.mock('../score-cache.service.js', () => ({
  setMatchScoreCache: (...args: unknown[]) => mockSetMatchScoreCache(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DB_PROFILE = {
  dateOfBirth:        new Date('1992-06-15'),
  settlementIntent:   'UK or Canada',
  completionScore:    80,
  verificationStatus: VerificationStatus.APPROVED,
};

const DB_ANSWERS = [
  { questionKey: RealLifeQuestionKey.DIET,              value: 'Vegetarian' },
  { questionKey: RealLifeQuestionKey.FAITH_IN_PRACTICE, value: 'Hindu' },
  { questionKey: RealLifeQuestionKey.LANGUAGE_AT_HOME,  value: 'Tamil' },
];

const DB_CHECK_IN = { submittedAt: new Date('2026-05-25T10:00:00.000Z') };

const DB_GROUP_MEMBERSHIPS = [{ groupId: 'group-london' }];

const DB_MATCH_SCORE = {
  id:         'score-uuid-1',
  userAId:    'user-a',
  userBId:    'user-b',
  totalScore: 1.0,
  breakdown: {
    verification: 1.0, settlementIntent: 1.0, realLifeAnswers: 1.0,
    profileCompleteness: 0.8, checkInRecency: 1.0, ageCompatibility: 1.0,
    groupMembership: 1.0, languageMatch: 1.0, faithAlignment: 1.0,
  },
  algorithmV: 'v1',
  computedAt: new Date('2026-05-27T12:00:00.000Z'),
};

function setHappyPathMocks(): void {
  mockProfileFindUnique.mockResolvedValue(DB_PROFILE);
  mockRLAnswerFindMany.mockResolvedValue(DB_ANSWERS);
  mockCheckInFindFirst.mockResolvedValue(DB_CHECK_IN);
  mockGroupMemberFindMany.mockResolvedValue(DB_GROUP_MEMBERSHIPS);
  mockMatchScoreUpsert.mockResolvedValue(DB_MATCH_SCORE);
  mockSetMatchScoreCache.mockResolvedValue(undefined);
}

// ── getUserScoringData() ──────────────────────────────────────────────────────

describe('getUserScoringData()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHappyPathMocks();
  });

  it('returns UserScoringData with profile fields', async () => {
    const data = await getUserScoringData('user-a');

    expect(data.userId).toBe('user-a');
    expect(data.profile.settlementIntent).toBe('UK or Canada');
    expect(data.profile.completionScore).toBe(80);
    expect(data.profile.verificationStatus).toBe(VerificationStatus.APPROVED);
  });

  it('maps real-life answers into a Map keyed by RealLifeQuestionKey', async () => {
    const data = await getUserScoringData('user-a');

    expect(data.realLifeAnswers.get(RealLifeQuestionKey.DIET)).toBe('Vegetarian');
    expect(data.realLifeAnswers.get(RealLifeQuestionKey.FAITH_IN_PRACTICE)).toBe('Hindu');
    expect(data.realLifeAnswers.size).toBe(3);
  });

  it('sets latestCheckIn from the most recent check-in row', async () => {
    const data = await getUserScoringData('user-a');

    expect(data.latestCheckIn).toEqual(DB_CHECK_IN.submittedAt);
  });

  it('sets latestCheckIn to null when the user has never checked in', async () => {
    mockCheckInFindFirst.mockResolvedValueOnce(null);

    const data = await getUserScoringData('user-a');

    expect(data.latestCheckIn).toBeNull();
  });

  it('builds groupIds as a Set of active group IDs', async () => {
    const data = await getUserScoringData('user-a');

    expect(data.groupIds).toEqual(new Set(['group-london']));
  });

  it('builds an empty groupIds Set when user has no group memberships', async () => {
    mockGroupMemberFindMany.mockResolvedValueOnce([]);

    const data = await getUserScoringData('user-a');

    expect(data.groupIds.size).toBe(0);
  });

  it('throws UserProfileMissingError when the user has no profile', async () => {
    mockProfileFindUnique.mockResolvedValueOnce(null);

    await expect(getUserScoringData('user-a')).rejects.toThrow(UserProfileMissingError);
  });

  it('re-throws unexpected DB errors from the parallel fetch', async () => {
    mockRLAnswerFindMany.mockRejectedValueOnce(new Error('DB timeout'));

    await expect(getUserScoringData('user-a')).rejects.toThrow('DB timeout');
  });
});

// ── computeAndSaveScore() ─────────────────────────────────────────────────────

describe('computeAndSaveScore()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHappyPathMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a MatchScoreDto with userAId, userBId, totalScore, breakdown, computedAt', async () => {
    const result = await computeAndSaveScore('user-a', 'user-b');

    expect(result.userAId).toBe('user-a');
    expect(result.userBId).toBe('user-b');
    expect(typeof result.totalScore).toBe('number');
    expect(result.breakdown).toBeDefined();
    expect(result.computedAt).toBeInstanceOf(Date);
  });

  it('calls prisma.matchScore.upsert with the computed score', async () => {
    await computeAndSaveScore('user-a', 'user-b');

    expect(mockMatchScoreUpsert).toHaveBeenCalledTimes(1);
    const call = mockMatchScoreUpsert.mock.calls[0][0];
    expect(call.create).toEqual(
      expect.objectContaining({
        algorithmV: 'v1',
        totalScore: expect.any(Number),
        breakdown:  expect.any(Object),
      }),
    );
  });

  it('canonicalizes the pair — smaller UUID is always userAId', async () => {
    // 'user-a' < 'user-b' lexicographically
    await computeAndSaveScore('user-b', 'user-a'); // reversed order

    const call = mockMatchScoreUpsert.mock.calls[0][0];
    expect(call.where.userAId_userBId_algorithmV.userAId).toBe('user-a');
    expect(call.where.userAId_userBId_algorithmV.userBId).toBe('user-b');
  });

  it('fetches scoring data for both users in parallel (two findUnique calls)', async () => {
    await computeAndSaveScore('user-a', 'user-b');

    // profileFindUnique is called once per user
    expect(mockProfileFindUnique).toHaveBeenCalledTimes(2);
  });

  // ── Guard: same user ──────────────────────────────────────────────────────

  it('throws when userAId === userBId', async () => {
    await expect(computeAndSaveScore('user-a', 'user-a')).rejects.toThrow(
      'Cannot compute score between a user and themselves',
    );
    expect(mockMatchScoreUpsert).not.toHaveBeenCalled();
  });

  // ── UserProfileMissingError ───────────────────────────────────────────────

  it('throws UserProfileMissingError when user A has no profile', async () => {
    mockProfileFindUnique.mockResolvedValueOnce(null); // user A → no profile

    await expect(computeAndSaveScore('user-a', 'user-b')).rejects.toThrow(UserProfileMissingError);
    expect(mockMatchScoreUpsert).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from matchScore.upsert', async () => {
    mockMatchScoreUpsert.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(computeAndSaveScore('user-a', 'user-b')).rejects.toThrow('DB write failed');
  });

  // ── Cache integration ─────────────────────────────────────────────────────

  it('calls setMatchScoreCache with the saved MatchScoreDto after upsert', async () => {
    const result = await computeAndSaveScore('user-a', 'user-b');

    expect(mockSetMatchScoreCache).toHaveBeenCalledTimes(1);
    expect(mockSetMatchScoreCache).toHaveBeenCalledWith(
      expect.objectContaining({
        userAId:    result.userAId,
        userBId:    result.userBId,
        totalScore: result.totalScore,
      }),
    );
  });

  it('does not call setMatchScoreCache when upsert throws', async () => {
    mockMatchScoreUpsert.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(computeAndSaveScore('user-a', 'user-b')).rejects.toThrow();

    expect(mockSetMatchScoreCache).not.toHaveBeenCalled();
  });
});
