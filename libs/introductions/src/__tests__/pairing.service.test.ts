import { generatePairingsForDrop } from '../pairing.service.js';
import { IntroductionDropNotFoundError } from '../drop.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDropFindUnique     = jest.fn();
const mockDropUpdate         = jest.fn();
const mockProfileFindMany    = jest.fn();
const mockIntroFindMany      = jest.fn();
const mockIntroCreate        = jest.fn();
const mockBlockFindMany      = jest.fn();
const mockMatchScoreFindMany = jest.fn();
const mockQueryRaw           = jest.fn();
const mockIsAiConfigured     = jest.fn().mockReturnValue(false);

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    introductionDrop: {
      findUnique: (...a: unknown[]) => mockDropFindUnique(...a),
      update:     (...a: unknown[]) => mockDropUpdate(...a),
    },
    profile: {
      findMany: (...a: unknown[]) => mockProfileFindMany(...a),
    },
    introduction: {
      findMany: (...a: unknown[]) => mockIntroFindMany(...a),
      create:   (...a: unknown[]) => mockIntroCreate(...a),
    },
    userBlock: {
      findMany: (...a: unknown[]) => mockBlockFindMany(...a),
    },
    matchScore: {
      findMany: (...a: unknown[]) => mockMatchScoreFindMany(...a),
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

// Mock the dynamic import('@abroad-matrimony/ai') used inside isAiAvailable()
jest.mock('@abroad-matrimony/ai', () => ({
  isAiConfigured: (...a: unknown[]) => mockIsAiConfigured(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const DROP_ID   = 'drop-uuid-1';
const USER_A_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_B_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_C_ID = 'cccccccc-0000-0000-0000-000000000003';
const USER_D_ID = 'dddddddd-0000-0000-0000-000000000004';

function makeDrop(memberPool: string[] = [USER_A_ID, USER_B_ID]) {
  return {
    id:         DROP_ID,
    status:     'PENDING_APPROVAL',
    memberPool,
    releaseAt:  new Date(Date.now() + 7 * 86_400_000),
  };
}

/** Set up the standard happy-path mocks for a 2-person pool (MALE + FEMALE). */
function setupBasicMocks() {
  mockDropFindUnique.mockResolvedValue(makeDrop());
  mockProfileFindMany.mockResolvedValue([
    { userId: USER_A_ID, gender: 'MALE' },
    { userId: USER_B_ID, gender: 'FEMALE' },
  ]);
  mockIntroFindMany.mockResolvedValue([]);
  mockBlockFindMany.mockResolvedValue([]);
  mockMatchScoreFindMany.mockResolvedValue([{ userAId: USER_A_ID, userBId: USER_B_ID }]);
  mockIntroCreate.mockResolvedValue({});
  mockDropUpdate.mockResolvedValue({});
}

// ── generatePairingsForDrop ────────────────────────────────────────────────────

describe('generatePairingsForDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAiConfigured.mockReturnValue(false);
  });

  // ── Error paths ──────────────────────────────────────────────────────────────

  it('throws IntroductionDropNotFoundError when drop does not exist', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(generatePairingsForDrop(DROP_ID)).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('returns early without creating intros when pool has fewer than 2 members', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop([USER_A_ID]));
    mockProfileFindMany.mockResolvedValue([{ userId: USER_A_ID, gender: 'MALE' }]);
    mockIntroFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([]);

    await generatePairingsForDrop(DROP_ID);

    expect(mockIntroCreate).not.toHaveBeenCalled();
    expect(mockDropUpdate).not.toHaveBeenCalled();
  });

  // ── Happy path — match score fallback ────────────────────────────────────────

  it('creates pairings using match score ranking when AI unavailable', async () => {
    setupBasicMocks(); // AI not configured

    await generatePairingsForDrop(DROP_ID);

    // For USER_A (male) → USER_B (female): intro created
    expect(mockIntroCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dropId:  DROP_ID,
          userAId: USER_A_ID,
          userBId: USER_B_ID,
          status:  'PENDING',
        }),
      }),
    );
  });

  it('updates drop status to SCHEDULED after pairing generation', async () => {
    setupBasicMocks();

    await generatePairingsForDrop(DROP_ID);

    expect(mockDropUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DROP_ID },
        data:  { status: 'SCHEDULED' },
      }),
    );
  });

  // ── AI path (pgvector) ────────────────────────────────────────────────────────

  it('uses pgvector similarity ranking when AI is configured', async () => {
    mockIsAiConfigured.mockReturnValue(true);
    mockDropFindUnique.mockResolvedValue(makeDrop());
    mockProfileFindMany.mockResolvedValue([
      { userId: USER_A_ID, gender: 'MALE' },
      { userId: USER_B_ID, gender: 'FEMALE' },
    ]);
    mockIntroFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([]);
    // pgvector query returns ranked candidates
    mockQueryRaw.mockResolvedValue([{ userId: USER_B_ID, similarity: 0.95 }]);
    mockIntroCreate.mockResolvedValue({});
    mockDropUpdate.mockResolvedValue({});

    await generatePairingsForDrop(DROP_ID);

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockIntroCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userBId: USER_B_ID }) }),
    );
  });

  it('falls back to match scores when AI returns empty pgvector results', async () => {
    mockIsAiConfigured.mockReturnValue(true);
    setupBasicMocks();
    mockQueryRaw.mockResolvedValue([]); // AI returns nothing

    await generatePairingsForDrop(DROP_ID);

    // Should fall back to matchScore
    expect(mockMatchScoreFindMany).toHaveBeenCalled();
    expect(mockIntroCreate).toHaveBeenCalled();
  });

  // ── Random shuffle fallback ───────────────────────────────────────────────────

  it('falls back to random shuffle when no match scores exist', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop());
    mockProfileFindMany.mockResolvedValue([
      { userId: USER_A_ID, gender: 'MALE' },
      { userId: USER_B_ID, gender: 'FEMALE' },
    ]);
    mockIntroFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([]);
    mockMatchScoreFindMany.mockResolvedValue([]); // no scores
    mockIntroCreate.mockResolvedValue({});
    mockDropUpdate.mockResolvedValue({});

    await generatePairingsForDrop(DROP_ID);

    // Random shuffle still creates the intro since there is only one candidate
    expect(mockIntroCreate).toHaveBeenCalled();
  });

  // ── Filtering ─────────────────────────────────────────────────────────────────

  it('skips same-gender pairs', async () => {
    // Pool: A=MALE, B=MALE, C=FEMALE.
    // Each call to rankByMatchScore() is scoped to the actual candidates for that recipient,
    // so we use mockResolvedValueOnce to return only relevant scores per call.
    mockDropFindUnique.mockResolvedValue(makeDrop([USER_A_ID, USER_B_ID, USER_C_ID]));
    mockProfileFindMany.mockResolvedValue([
      { userId: USER_A_ID, gender: 'MALE' },
      { userId: USER_B_ID, gender: 'MALE' },
      { userId: USER_C_ID, gender: 'FEMALE' },
    ]);
    mockIntroFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([]);
    // Call 1: rankByMatchScore(A, [C]) — B filtered by same-gender so not in candidateIds
    mockMatchScoreFindMany
      .mockResolvedValueOnce([{ userAId: USER_A_ID, userBId: USER_C_ID }]) // for A
      .mockResolvedValueOnce([{ userAId: USER_B_ID, userBId: USER_C_ID }]); // for B
    mockIntroCreate.mockResolvedValue({});
    mockDropUpdate.mockResolvedValue({});

    await generatePairingsForDrop(DROP_ID);

    // A→C and B→C should be created; A→B (same gender) should NOT
    const createCalls = mockIntroCreate.mock.calls.map((c) => c[0].data);
    const pairKeys = createCalls.map((d: any) => `${d.userAId}:${d.userBId}`);
    expect(pairKeys.some((k) => k === `${USER_A_ID}:${USER_B_ID}`)).toBe(false);
    expect(pairKeys.some((k) => k === `${USER_A_ID}:${USER_C_ID}`)).toBe(true);
    expect(pairKeys.some((k) => k === `${USER_B_ID}:${USER_C_ID}`)).toBe(true);
  });

  it('skips blocked pairs', async () => {
    // Pool: A=MALE, B=FEMALE. A has blocked B.
    mockDropFindUnique.mockResolvedValue(makeDrop());
    mockProfileFindMany.mockResolvedValue([
      { userId: USER_A_ID, gender: 'MALE' },
      { userId: USER_B_ID, gender: 'FEMALE' },
    ]);
    mockIntroFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([{ blockerId: USER_A_ID, blockedId: USER_B_ID }]);
    mockMatchScoreFindMany.mockResolvedValue([]);
    mockIntroCreate.mockResolvedValue({});
    mockDropUpdate.mockResolvedValue({});

    await generatePairingsForDrop(DROP_ID);

    expect(mockIntroCreate).not.toHaveBeenCalled();
  });

  it('skips already-introduced pairs (idempotent)', async () => {
    setupBasicMocks();
    // Pre-existing introduction A↔B
    mockIntroFindMany.mockResolvedValue([{ userAId: USER_A_ID, userBId: USER_B_ID }]);

    await generatePairingsForDrop(DROP_ID);

    // No new intros should be created
    expect(mockIntroCreate).not.toHaveBeenCalled();
  });

  it('handles create unique-constraint errors gracefully and continues', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop([USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID]));
    mockProfileFindMany.mockResolvedValue([
      { userId: USER_A_ID, gender: 'MALE' },
      { userId: USER_B_ID, gender: 'FEMALE' },
      { userId: USER_C_ID, gender: 'MALE' },
      { userId: USER_D_ID, gender: 'FEMALE' },
    ]);
    mockIntroFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([]);
    mockMatchScoreFindMany.mockResolvedValue([
      { userAId: USER_A_ID, userBId: USER_B_ID },
      { userAId: USER_A_ID, userBId: USER_D_ID },
      { userAId: USER_B_ID, userBId: USER_C_ID },
      { userAId: USER_C_ID, userBId: USER_D_ID },
    ]);
    // First create throws unique constraint; rest succeed
    mockIntroCreate
      .mockRejectedValueOnce(new Error('Unique constraint failed'))
      .mockResolvedValue({});
    mockDropUpdate.mockResolvedValue({});

    // Should not throw even though first create fails
    await expect(generatePairingsForDrop(DROP_ID)).resolves.not.toThrow();
    // Drop should still be updated to SCHEDULED
    expect(mockDropUpdate).toHaveBeenCalled();
  });
});
