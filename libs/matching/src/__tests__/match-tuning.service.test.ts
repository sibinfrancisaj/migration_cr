import {
  getMatchTuning,
  setMatchTuning,
} from '../match-tuning.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockMatchTuningFindUnique = jest.fn();
const mockMatchTuningUpsert     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    matchTuning: {
      findUnique: (...a: unknown[]) => mockMatchTuningFindUnique(...a),
      upsert:     (...a: unknown[]) => mockMatchTuningUpsert(...a),
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
