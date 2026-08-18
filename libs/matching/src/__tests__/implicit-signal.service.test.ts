import { applyImplicitSignal } from '../implicit-signal.service.js';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockMatchScoreFindFirst = jest.fn();
const mockMatchScoreUpdate    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    matchScore: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: (...a: any[]) => mockMatchScoreFindFirst(...a),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update:    (...a: any[]) => mockMatchScoreUpdate(...a),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyImplicitSignal()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchScoreFindFirst.mockResolvedValue({ id: 'score-1', implicitBoost: 0 });
    mockMatchScoreUpdate.mockResolvedValue({});
  });

  it('adds PROFILE_VIEW delta (+0.02) to existing boost of 0', async () => {
    await applyImplicitSignal('user-a', 'user-b', 'PROFILE_VIEW');

    expect(mockMatchScoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'score-1' },
        data:  { implicitBoost: 0.02 },
      }),
    );
  });

  it('adds PROFILE_SAVE delta (+0.04) to an existing boost', async () => {
    mockMatchScoreFindFirst.mockResolvedValue({ id: 'score-1', implicitBoost: 0.10 });

    await applyImplicitSignal('user-a', 'user-b', 'PROFILE_SAVE');

    expect(mockMatchScoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { implicitBoost: 0.14 } }),
    );
  });

  it('clamps boost to +0.30 when accumulated signals exceed cap', async () => {
    mockMatchScoreFindFirst.mockResolvedValue({ id: 'score-1', implicitBoost: 0.28 });

    await applyImplicitSignal('user-a', 'user-b', 'CONNECTION_ACCEPT');

    expect(mockMatchScoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { implicitBoost: 0.30 } }),
    );
  });

  it('applies negative delta for BLOCK signal', async () => {
    await applyImplicitSignal('user-a', 'user-b', 'BLOCK');

    expect(mockMatchScoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { implicitBoost: -0.20 } }),
    );
  });

  it('clamps boost to -0.30 for repeated negative signals', async () => {
    mockMatchScoreFindFirst.mockResolvedValue({ id: 'score-1', implicitBoost: -0.25 });

    await applyImplicitSignal('user-a', 'user-b', 'BLOCK');

    expect(mockMatchScoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { implicitBoost: -0.30 } }),
    );
  });

  it('is a no-op when no MatchScore row exists for the pair', async () => {
    mockMatchScoreFindFirst.mockResolvedValue(null);

    await applyImplicitSignal('user-a', 'user-b', 'PROFILE_VIEW');

    expect(mockMatchScoreUpdate).not.toHaveBeenCalled();
  });

  it('does not throw when the DB update fails (fire-and-forget)', async () => {
    mockMatchScoreUpdate.mockRejectedValue(new Error('DB timeout'));

    await expect(applyImplicitSignal('user-a', 'user-b', 'PROFILE_VIEW')).resolves.toBeUndefined();
  });

  it('canonicalizes the user pair (lexicographic sort) in the lookup query', async () => {
    await applyImplicitSignal('user-z', 'user-a', 'PROFILE_VIEW');

    expect(mockMatchScoreFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userAId: 'user-a', userBId: 'user-z' },
      }),
    );
  });
});
