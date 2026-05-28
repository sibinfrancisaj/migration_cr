import { recalculateCompletionScore } from '../score.service.js';
import { VerificationStatus } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockProfileFindUnique = jest.fn();
const mockProfileUpdate     = jest.fn();
const mockRlCount           = jest.fn();
const mockStoryCount        = jest.fn();
const mockMediaCount        = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
      update:     (...args: unknown[]) => mockProfileUpdate(...args),
    },
    realLifeAnswer: {
      count: (...args: unknown[]) => mockRlCount(...args),
    },
    storyPromptAnswer: {
      count: (...args: unknown[]) => mockStoryCount(...args),
    },
    media: {
      count: (...args: unknown[]) => mockMediaCount(...args),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupMocks({
  profile = { verificationStatus: VerificationStatus.PENDING } as { verificationStatus: VerificationStatus } | null,
  rlCount    = 0,
  storyCount = 0,
  photoCount = 0,
}: {
  profile?:    { verificationStatus: VerificationStatus } | null;
  rlCount?:    number;
  storyCount?: number;
  photoCount?: number;
} = {}) {
  mockProfileFindUnique.mockResolvedValue(profile);
  mockRlCount.mockResolvedValue(rlCount);
  mockStoryCount.mockResolvedValue(storyCount);
  mockMediaCount.mockResolvedValue(photoCount);
  mockProfileUpdate.mockResolvedValue({ completionScore: 0 });
}

const USER_ID = 'user-uuid-1';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('recalculateCompletionScore()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── No profile guard ──────────────────────────────────────────────────────

  it('returns 0 when the user has no profile', async () => {
    setupMocks({ profile: null });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(0);
  });

  it('does not call prisma.profile.update when the user has no profile', async () => {
    setupMocks({ profile: null });

    await recalculateCompletionScore(USER_ID);

    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });

  // ── Score calculations ────────────────────────────────────────────────────

  it('returns 20 (basics only) with no answers, no photos, not verified', async () => {
    setupMocks();

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(20);
  });

  it('returns 60 when all 12 real-life answers are provided (20 + 40)', async () => {
    setupMocks({ rlCount: 12 });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(60);
  });

  it('returns 80 when all 12 RL answers and all 3 story prompts are provided (20 + 40 + 20)', async () => {
    setupMocks({ rlCount: 12, storyCount: 3 });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(80);
  });

  it('returns 90 when all RL + all story + at least 1 photo (20 + 40 + 20 + 10)', async () => {
    setupMocks({ rlCount: 12, storyCount: 3, photoCount: 1 });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(90);
  });

  it('returns 100 when fully complete and identity verified', async () => {
    setupMocks({
      rlCount: 12,
      storyCount: 3,
      photoCount: 1,
      profile: { verificationStatus: VerificationStatus.APPROVED },
    });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(100);
  });

  it('pro-rates RL answers — 6/12 yields 20 pts from RL, total 40', async () => {
    setupMocks({ rlCount: 6 });

    const score = await recalculateCompletionScore(USER_ID);

    // 20 + (6/12)*40 = 20 + 20 = 40
    expect(score).toBe(40);
  });

  it('pro-rates story prompts — 1/3 yields ~7 pts from story, total 27', async () => {
    setupMocks({ storyCount: 1 });

    const score = await recalculateCompletionScore(USER_ID);

    // 20 + (1/3)*20 = 20 + 6.666… → Math.round = 27
    expect(score).toBe(27);
  });

  it('does not award photo points when photoCount is 0', async () => {
    setupMocks({ rlCount: 12, storyCount: 3, photoCount: 0 });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(80);
  });

  it('awards the same 10 photo points for multiple photos (count > 1)', async () => {
    setupMocks({ rlCount: 12, storyCount: 3, photoCount: 5 });

    // Extra photos beyond the first still only award 10 pts
    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(90);
  });

  it('does not award verification points when status is PENDING', async () => {
    setupMocks({ profile: { verificationStatus: VerificationStatus.PENDING } });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(20);
  });

  it('awards 10 verification points when status is APPROVED, total 30', async () => {
    setupMocks({ profile: { verificationStatus: VerificationStatus.APPROVED } });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(30);
  });

  it('does not award verification points when status is UNDER_REVIEW', async () => {
    setupMocks({ profile: { verificationStatus: VerificationStatus.UNDER_REVIEW } });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(20);
  });

  it('does not award verification points when status is REJECTED', async () => {
    setupMocks({ profile: { verificationStatus: VerificationStatus.REJECTED } });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(20);
  });

  // ── DB write ──────────────────────────────────────────────────────────────

  it('calls prisma.profile.update with the computed score', async () => {
    setupMocks({ rlCount: 12 });

    await recalculateCompletionScore(USER_ID);

    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data:  { completionScore: 60 },
    });
  });

  it('returns the computed score as the function result', async () => {
    setupMocks({ rlCount: 12, storyCount: 3, photoCount: 1 });

    const score = await recalculateCompletionScore(USER_ID);

    expect(score).toBe(90);
  });

  it('passes userId to prisma.profile.findUnique', async () => {
    setupMocks();

    await recalculateCompletionScore(USER_ID);

    expect(mockProfileFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from realLifeAnswer.count inside Promise.all', async () => {
    mockProfileFindUnique.mockResolvedValue({ verificationStatus: VerificationStatus.PENDING });
    mockRlCount.mockRejectedValueOnce(new Error('DB connection lost'));
    mockStoryCount.mockResolvedValue(0);
    mockMediaCount.mockResolvedValue(0);

    await expect(recalculateCompletionScore(USER_ID)).rejects.toThrow('DB connection lost');
  });

  it('re-throws unexpected errors from profile.update', async () => {
    setupMocks();
    mockProfileUpdate.mockRejectedValueOnce(new Error('Update failed'));

    await expect(recalculateCompletionScore(USER_ID)).rejects.toThrow('Update failed');
  });
});
