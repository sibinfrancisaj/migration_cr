import { upsertRealLifeAnswer, ProfileNotFoundError } from '../real-life-answer.service.js';
import { RealLifeQuestionKey } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpsert     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    realLifeAnswer: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
  Prisma: {},
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  }),
}));

// ── Score service mock ────────────────────────────────────────────────────────

const mockRecalculateCompletionScore = jest.fn();

jest.mock('../score.service.js', () => ({
  recalculateCompletionScore: (...args: unknown[]) =>
    mockRecalculateCompletionScore(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID      = 'user-uuid-1';
const QUESTION_KEY = RealLifeQuestionKey.DIET;
const STRING_VALUE = 'Vegetarian';
const ARRAY_VALUE  = ['Vegetarian', 'Vegan'];

const DB_PROFILE_ROW = { id: 'profile-uuid-1', userId: USER_ID };

const DB_ANSWER_ROW_STRING = {
  id:          'answer-uuid-1',
  userId:      USER_ID,
  questionKey: RealLifeQuestionKey.DIET,
  value:       'Vegetarian',
  createdAt:   new Date('2026-05-27T10:00:00.000Z'),
  updatedAt:   new Date('2026-05-27T10:00:00.000Z'),
};

const DB_ANSWER_ROW_ARRAY = {
  ...DB_ANSWER_ROW_STRING,
  value: ['Vegetarian', 'Vegan'],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('upsertRealLifeAnswer()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(DB_PROFILE_ROW);
    mockUpsert.mockResolvedValue(DB_ANSWER_ROW_STRING);
    mockRecalculateCompletionScore.mockResolvedValue(25);
  });

  // ── Happy path — string value ─────────────────────────────────────────────

  it('returns a RealLifeAnswerDto with the correct questionKey for a string value', async () => {
    const result = await upsertRealLifeAnswer({
      userId: USER_ID,
      questionKey: QUESTION_KEY,
      value: STRING_VALUE,
    });

    expect(result.questionKey).toBe(RealLifeQuestionKey.DIET);
    expect(result.value).toBe('Vegetarian');
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  // ── Happy path — array value ──────────────────────────────────────────────

  it('returns a RealLifeAnswerDto with array value when value is an array', async () => {
    mockUpsert.mockResolvedValueOnce(DB_ANSWER_ROW_ARRAY);

    const result = await upsertRealLifeAnswer({
      userId: USER_ID,
      questionKey: QUESTION_KEY,
      value: ARRAY_VALUE,
    });

    expect(result.value).toEqual(['Vegetarian', 'Vegan']);
  });

  // ── Profile guard ─────────────────────────────────────────────────────────

  it('throws ProfileNotFoundError when the user has no profile', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      upsertRealLifeAnswer({ userId: USER_ID, questionKey: QUESTION_KEY, value: STRING_VALUE }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it('does not call prisma.realLifeAnswer.upsert when profile is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      upsertRealLifeAnswer({ userId: USER_ID, questionKey: QUESTION_KEY, value: STRING_VALUE }),
    ).rejects.toThrow();

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // ── Upsert params ─────────────────────────────────────────────────────────

  it('calls upsert with the correct composite where clause', async () => {
    await upsertRealLifeAnswer({
      userId: USER_ID,
      questionKey: QUESTION_KEY,
      value: STRING_VALUE,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_questionKey: { userId: USER_ID, questionKey: QUESTION_KEY } },
      }),
    );
  });

  it('passes userId, questionKey, and value to the create clause', async () => {
    await upsertRealLifeAnswer({
      userId: USER_ID,
      questionKey: QUESTION_KEY,
      value: STRING_VALUE,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId:      USER_ID,
          questionKey: QUESTION_KEY,
          value:       STRING_VALUE,
        }),
      }),
    );
  });

  it('passes value to the update clause', async () => {
    await upsertRealLifeAnswer({
      userId: USER_ID,
      questionKey: QUESTION_KEY,
      value: STRING_VALUE,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ value: STRING_VALUE }),
      }),
    );
  });

  // ── Score recalculation ───────────────────────────────────────────────────

  it('calls recalculateCompletionScore with the correct userId after a successful upsert', async () => {
    await upsertRealLifeAnswer({
      userId: USER_ID,
      questionKey: QUESTION_KEY,
      value: STRING_VALUE,
    });

    expect(mockRecalculateCompletionScore).toHaveBeenCalledWith(USER_ID);
    expect(mockRecalculateCompletionScore).toHaveBeenCalledTimes(1);
  });

  it('does not call recalculateCompletionScore when the profile is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      upsertRealLifeAnswer({ userId: USER_ID, questionKey: QUESTION_KEY, value: STRING_VALUE }),
    ).rejects.toThrow();

    expect(mockRecalculateCompletionScore).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from prisma.profile.findUnique', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      upsertRealLifeAnswer({ userId: USER_ID, questionKey: QUESTION_KEY, value: STRING_VALUE }),
    ).rejects.toThrow('DB connection lost');
  });

  it('re-throws unexpected errors from prisma.realLifeAnswer.upsert', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('Constraint violation'));

    await expect(
      upsertRealLifeAnswer({ userId: USER_ID, questionKey: QUESTION_KEY, value: STRING_VALUE }),
    ).rejects.toThrow('Constraint violation');
  });

  it('re-throws unexpected errors from recalculateCompletionScore', async () => {
    mockRecalculateCompletionScore.mockRejectedValueOnce(new Error('Score calc failed'));

    await expect(
      upsertRealLifeAnswer({ userId: USER_ID, questionKey: QUESTION_KEY, value: STRING_VALUE }),
    ).rejects.toThrow('Score calc failed');
  });
});
