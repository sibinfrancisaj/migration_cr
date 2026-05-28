import { upsertStoryPrompt } from '../story-prompt.service.js';
import { ProfileNotFoundError } from '../real-life-answer.service.js';
import { StoryPromptKey } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpsert     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    storyPromptAnswer: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
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

const USER_ID   = 'user-uuid-1';
const PROMPT_KEY = StoryPromptKey.DEAL_BREAKER;
const ANSWER    = 'Dishonesty is my biggest deal breaker in a relationship.';

const DB_PROFILE_ROW = { id: 'profile-uuid-1', userId: USER_ID };

const DB_STORY_ANSWER_ROW = {
  id:        'story-uuid-1',
  userId:    USER_ID,
  promptKey: StoryPromptKey.DEAL_BREAKER,
  answer:    ANSWER,
  updatedAt: new Date('2026-05-27T10:00:00.000Z'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('upsertStoryPrompt()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(DB_PROFILE_ROW);
    mockUpsert.mockResolvedValue(DB_STORY_ANSWER_ROW);
    mockRecalculateCompletionScore.mockResolvedValue(47);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a StoryPromptAnswerDto with the correct promptKey and answer', async () => {
    const result = await upsertStoryPrompt({
      userId:    USER_ID,
      promptKey: PROMPT_KEY,
      answer:    ANSWER,
    });

    expect(result.promptKey).toBe(StoryPromptKey.DEAL_BREAKER);
    expect(result.answer).toBe(ANSWER);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('works for each of the 3 valid StoryPromptKey values', async () => {
    for (const key of Object.values(StoryPromptKey)) {
      mockUpsert.mockResolvedValueOnce({ ...DB_STORY_ANSWER_ROW, promptKey: key });

      const result = await upsertStoryPrompt({ userId: USER_ID, promptKey: key, answer: ANSWER });

      expect(result.promptKey).toBe(key);
    }
  });

  // ── Profile guard ─────────────────────────────────────────────────────────

  it('throws ProfileNotFoundError when the user has no profile', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it('does not call prisma.storyPromptAnswer.upsert when profile is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER }),
    ).rejects.toThrow();

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // ── Upsert params ─────────────────────────────────────────────────────────

  it('calls upsert with the correct composite where clause', async () => {
    await upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_promptKey: { userId: USER_ID, promptKey: PROMPT_KEY } },
      }),
    );
  });

  it('passes userId, promptKey, and answer to the create clause', async () => {
    await upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId:    USER_ID,
          promptKey: PROMPT_KEY,
          answer:    ANSWER,
        }),
      }),
    );
  });

  it('passes the updated answer to the update clause', async () => {
    const updatedAnswer = 'Lack of ambition is my deal breaker.';
    mockUpsert.mockResolvedValueOnce({ ...DB_STORY_ANSWER_ROW, answer: updatedAnswer });

    await upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: updatedAnswer });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ answer: updatedAnswer }),
      }),
    );
  });

  // ── Score recalculation ───────────────────────────────────────────────────

  it('calls recalculateCompletionScore with the correct userId after a successful upsert', async () => {
    await upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER });

    expect(mockRecalculateCompletionScore).toHaveBeenCalledWith(USER_ID);
    expect(mockRecalculateCompletionScore).toHaveBeenCalledTimes(1);
  });

  it('does not call recalculateCompletionScore when the profile is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER }),
    ).rejects.toThrow();

    expect(mockRecalculateCompletionScore).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from prisma.profile.findUnique', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER }),
    ).rejects.toThrow('DB connection lost');
  });

  it('re-throws unexpected errors from prisma.storyPromptAnswer.upsert', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('Constraint violation'));

    await expect(
      upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER }),
    ).rejects.toThrow('Constraint violation');
  });

  it('re-throws unexpected errors from recalculateCompletionScore', async () => {
    mockRecalculateCompletionScore.mockRejectedValueOnce(new Error('Score calc failed'));

    await expect(
      upsertStoryPrompt({ userId: USER_ID, promptKey: PROMPT_KEY, answer: ANSWER }),
    ).rejects.toThrow('Score calc failed');
  });
});
