import {
  getMatchTuning,
  setMatchTuning,
  getTuningAsQuestions,
  setTuningFromQuestions,
  computeTuningImpact,
  importanceToMultiplier,
  multiplierToImportance,
} from '../match-tuning.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockMatchTuningFindUnique = jest.fn();
const mockMatchTuningUpsert     = jest.fn();
const mockMatchScoreFindMany    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    matchTuning: {
      findUnique: (...a: any[]) => mockMatchTuningFindUnique(...a),
      upsert:     (...a: any[]) => mockMatchTuningUpsert(...a),
    },
    matchScore: {
      findMany: (...a: any[]) => mockMatchScoreFindMany(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

const TUNING_ROW = {
  userId: USER_ID,
  weights: { lifestyle: 1.5, values: 2.0, location: 0.8 },
  updatedAt: new Date('2026-05-01T10:00:00Z'),
};

// ── getMatchTuning ─────────────────────────────────────────────────────────────

describe('getMatchTuning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns existing tuning weights for a user', async () => {
    mockMatchTuningFindUnique.mockResolvedValue(TUNING_ROW);

    const result = await getMatchTuning(USER_ID);

    expect(result.userId).toBe(USER_ID);
    expect(result.weights).toEqual({ lifestyle: 1.5, values: 2.0, location: 0.8 });
    expect(result.updatedAt).toBe(TUNING_ROW.updatedAt.toISOString());
  });

  it('returns default empty weights when no tuning record exists', async () => {
    mockMatchTuningFindUnique.mockResolvedValue(null);

    const result = await getMatchTuning(USER_ID);

    expect(result.userId).toBe(USER_ID);
    expect(result.weights).toEqual({});
    expect(typeof result.updatedAt).toBe('string');
  });
});

// ── setMatchTuning ─────────────────────────────────────────────────────────────

describe('setMatchTuning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts weights and returns the saved result', async () => {
    const weights = { lifestyle: 1.5, values: 2.0 };
    mockMatchTuningUpsert.mockResolvedValue({ ...TUNING_ROW, weights });

    const result = await setMatchTuning(USER_ID, weights);

    expect(mockMatchTuningUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        create: expect.objectContaining({ userId: USER_ID, weights }),
        update: expect.objectContaining({ weights }),
      }),
    );
    expect(result.weights).toEqual(weights);
  });

  it('clamps weights below 0.1 to 0.1', async () => {
    mockMatchTuningUpsert.mockImplementation(({ create }: { create: { weights: Record<string, number> } }) =>
      Promise.resolve({ userId: USER_ID, weights: create.weights, updatedAt: new Date() }),
    );

    const result = await setMatchTuning(USER_ID, { low: 0.001, ok: 1.0 });

    expect(result.weights.low).toBe(0.1);
    expect(result.weights.ok).toBe(1.0);
  });

  it('clamps weights above 3.0 to 3.0', async () => {
    mockMatchTuningUpsert.mockImplementation(({ create }: { create: { weights: Record<string, number> } }) =>
      Promise.resolve({ userId: USER_ID, weights: create.weights, updatedAt: new Date() }),
    );

    const result = await setMatchTuning(USER_ID, { high: 99, edge: 3.0 });

    expect(result.weights.high).toBe(3.0);
    expect(result.weights.edge).toBe(3.0);
  });

  it('skips non-number weight values', async () => {
    mockMatchTuningUpsert.mockImplementation(({ create }: { create: { weights: Record<string, number> } }) =>
      Promise.resolve({ userId: USER_ID, weights: create.weights, updatedAt: new Date() }),
    );

    const result = await setMatchTuning(USER_ID, { valid: 1.5, invalid: 'hello' as unknown as number });

    // Only valid numeric entries should be in the clamped result
    expect(result.weights.valid).toBe(1.5);
    expect(result.weights.invalid).toBeUndefined();
  });

  it('handles empty weights object', async () => {
    mockMatchTuningUpsert.mockResolvedValue({ userId: USER_ID, weights: {}, updatedAt: new Date() });

    const result = await setMatchTuning(USER_ID, {});

    expect(result.weights).toEqual({});
  });
});

// ── importanceToMultiplier ────────────────────────────────────────────────────

describe('importanceToMultiplier', () => {
  it('maps 1 → 0.5 (least important)', () => {
    expect(importanceToMultiplier(1)).toBe(0.5);
  });

  it('maps 3 → 1.0 (neutral/default)', () => {
    expect(importanceToMultiplier(3)).toBe(1.0);
  });

  it('maps 5 → 2.5 (most important)', () => {
    expect(importanceToMultiplier(5)).toBe(2.5);
  });

  it('clamps values outside 1–5 to nearest bound', () => {
    expect(importanceToMultiplier(0)).toBe(0.5);  // clamped to 1
    expect(importanceToMultiplier(6)).toBe(2.5);  // clamped to 5
  });
});

// ── multiplierToImportance ────────────────────────────────────────────────────

describe('multiplierToImportance', () => {
  it('maps 0.5 → 1', () => {
    expect(multiplierToImportance(0.5)).toBe(1);
  });

  it('maps 1.0 → 3 (neutral)', () => {
    expect(multiplierToImportance(1.0)).toBe(3);
  });

  it('maps 2.5 → 5', () => {
    expect(multiplierToImportance(2.5)).toBe(5);
  });

  it('round-trips correctly for all 5 importance values', () => {
    for (let i = 1; i <= 5; i++) {
      expect(multiplierToImportance(importanceToMultiplier(i))).toBe(i);
    }
  });
});

// ── setTuningFromQuestions ────────────────────────────────────────────────────

describe('setTuningFromQuestions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('translates importance ratings to multipliers and calls setMatchTuning', async () => {
    mockMatchTuningUpsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ userId: USER_ID, weights: create.weights, updatedAt: new Date() }),
    );

    const result = await setTuningFromQuestions(USER_ID, 4, 3);

    // importance 4 → 1.75, importance 3 → 1.0
    expect(mockMatchTuningUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          weights: expect.objectContaining({
            settlementIntent:  1.75,
            familyInvolvement: 1.0,
          }),
        }),
      }),
    );
    expect(result.userId).toBe(USER_ID);
    expect(result.settlementImportance).toBe(4);
    expect(result.familyImportance).toBe(3);
  });

  it('maps importance 5 to multiplier 2.5', async () => {
    mockMatchTuningUpsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ userId: USER_ID, weights: create.weights, updatedAt: new Date() }),
    );

    await setTuningFromQuestions(USER_ID, 5, 5);

    expect(mockMatchTuningUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          weights: { settlementIntent: 2.5, familyInvolvement: 2.5 },
        }),
      }),
    );
  });
});

// ── getTuningAsQuestions ──────────────────────────────────────────────────────

describe('getTuningAsQuestions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('converts stored multipliers back to importance ratings', async () => {
    mockMatchTuningFindUnique.mockResolvedValue({
      userId: USER_ID,
      weights: { settlementIntent: 1.75, familyInvolvement: 1.0 },
      updatedAt: new Date('2026-06-01T10:00:00Z'),
    });

    const result = await getTuningAsQuestions(USER_ID);

    expect(result.settlementImportance).toBe(4);
    expect(result.familyImportance).toBe(3);
    expect(result.userId).toBe(USER_ID);
  });

  it('returns importance 3 for both when no tuning is set', async () => {
    mockMatchTuningFindUnique.mockResolvedValue(null);

    const result = await getTuningAsQuestions(USER_ID);

    expect(result.settlementImportance).toBe(3);
    expect(result.familyImportance).toBe(3);
  });
});

// ── computeTuningImpact ───────────────────────────────────────────────────────

const SCORE_ROW = (otherId: string, score: number) => ({
  userAId: USER_ID,
  userBId: otherId,
  totalScore: score,
  breakdown: {
    verification: 1, settlementIntent: 0.8, realLifeAnswers: 0.7,
    profileCompleteness: 0.9, checkInRecency: 1, ageCompatibility: 0.8,
    groupMembership: 1, languageMatch: 1, faithAlignment: 0.9,
  },
});

describe('computeTuningImpact', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns correct counts when some profiles gain rank', async () => {
    mockMatchScoreFindMany.mockResolvedValue([
      SCORE_ROW('other-1', 0.5),
      SCORE_ROW('other-2', 0.6),
    ]);

    // settlementImportance=5 → 2.5x weight on settlementIntent
    const result = await computeTuningImpact(USER_ID, 5, 3);

    expect(result.pairsAnalysed).toBe(2);
    // All profiles that change significantly go into profilesUp or profilesDown
    expect(result.profilesUp + result.profilesDown + result.profilesUnchanged).toBe(2);
    expect(typeof result.profilesUp).toBe('number');
  });

  it('returns valid result structure when neutral weights are applied', async () => {
    mockMatchScoreFindMany.mockResolvedValue([SCORE_ROW('other-1', 0.7)]);

    const result = await computeTuningImpact(USER_ID, 3, 3); // importance 3 = 1.0x (neutral)

    // Result should still be structurally valid
    expect(result.pairsAnalysed).toBe(1);
    expect(result.profilesUp + result.profilesDown + result.profilesUnchanged).toBe(1);
    expect(Array.isArray(result.topGainers)).toBe(true);
  });

  it('returns empty result when no scored pairs exist', async () => {
    mockMatchScoreFindMany.mockResolvedValue([]);

    const result = await computeTuningImpact(USER_ID, 4, 4);

    expect(result.pairsAnalysed).toBe(0);
    expect(result.profilesUp).toBe(0);
    expect(result.profilesDown).toBe(0);
    expect(result.topGainers).toHaveLength(0);
  });
});
