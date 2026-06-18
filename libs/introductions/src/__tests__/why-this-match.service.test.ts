import {
  generateWhyThisMatch,
  generateWhyThisMatchLLM,
  DIMENSION_LABELS,
} from '../why-this-match.service.js';
import type { ScoreBreakdown } from '@abroad-matrimony/shared';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@abroad-matrimony/cache', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HIGH_BREAKDOWN: ScoreBreakdown = {
  verification:        1.0,
  settlementIntent:    0.9,
  realLifeAnswers:     0.85,
  profileCompleteness: 0.8,
  checkInRecency:      0.75,
  ageCompatibility:    1.0,
  groupMembership:     1.0,
  languageMatch:       1.0,
  faithAlignment:      0.9,
};

const LOW_BREAKDOWN: ScoreBreakdown = {
  verification:        0.5,
  settlementIntent:    0.3,
  realLifeAnswers:     0.2,
  profileCompleteness: 0.4,
  checkInRecency:      0.1,
  ageCompatibility:    0.3,
  groupMembership:     0.0,
  languageMatch:       0.2,
  faithAlignment:      0.1,
};

// Habit-dominant fixture: core dims are low so habits reach top-3
const WITH_HABITS: ScoreBreakdown = {
  verification:        0.1,
  settlementIntent:    0.1,
  realLifeAnswers:     0.1,
  profileCompleteness: 0.1,
  checkInRecency:      0.1,
  ageCompatibility:    0.1,
  groupMembership:     0.1,
  languageMatch:       0.1,
  faithAlignment:      0.1,
  habitConsistency:    0.95,
  habitOverlap:        0.8,
};

// ── generateWhyThisMatch() ────────────────────────────────────────────────────

describe('generateWhyThisMatch()', () => {
  it('returns a headline, summary, and 3 dimension cards', () => {
    const result = generateWhyThisMatch(HIGH_BREAKDOWN, 0.9);

    expect(result.headline).toBeTruthy();
    expect(result.summary).toBeTruthy();
    expect(result.dimensions).toHaveLength(3);
    expect(result.isAiGenerated).toBe(false);
  });

  it('sorts dimensions by score descending', () => {
    const result = generateWhyThisMatch(HIGH_BREAKDOWN, 0.9);
    const scores = result.dimensions.map(d => d.score);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });

  it('maps scores to pct (0–100)', () => {
    const result = generateWhyThisMatch(HIGH_BREAKDOWN, 0.9);
    for (const d of result.dimensions) {
      expect(d.pct).toBe(Math.round(d.score * 100));
      expect(d.pct).toBeGreaterThanOrEqual(0);
      expect(d.pct).toBeLessThanOrEqual(100);
    }
  });

  it('assigns "Aligned" tag for scores >= 0.8', () => {
    const result = generateWhyThisMatch(HIGH_BREAKDOWN, 0.9);
    const aligned = result.dimensions.filter(d => d.score >= 0.8);
    for (const d of aligned) {
      expect(d.tag).toBe('Aligned');
    }
  });

  it('assigns "Different" tag for scores < 0.4', () => {
    const result = generateWhyThisMatch(LOW_BREAKDOWN, 0.25);
    const different = result.dimensions.filter(d => d.score < 0.4);
    for (const d of different) {
      expect(d.tag).toBe('Different');
    }
  });

  it('uses DIMENSION_LABELS for card labels', () => {
    const result = generateWhyThisMatch(HIGH_BREAKDOWN, 0.9);
    for (const d of result.dimensions) {
      expect(d.label).toBe(DIMENSION_LABELS[d.key]);
    }
  });

  it('includes habit dimensions in cards when present', () => {
    const result = generateWhyThisMatch(WITH_HABITS, 0.95);
    const keys = result.dimensions.map(d => d.key);
    // At least one habit dimension should appear in top-3
    const hasHabit = keys.some(k => k === 'habitConsistency' || k === 'habitOverlap');
    expect(hasHabit).toBe(true);
  });

  it('produces a summary mentioning aligned dimensions', () => {
    const result = generateWhyThisMatch(HIGH_BREAKDOWN, 0.9);
    // At least one dimension label should appear in the summary or headline
    const text = result.headline + result.summary;
    const hasLabel = result.dimensions.some(d => text.includes(d.label));
    expect(hasLabel).toBe(true);
  });

  it('handles low-scoring breakdown without throwing', () => {
    expect(() => generateWhyThisMatch(LOW_BREAKDOWN, 0.25)).not.toThrow();
    const result = generateWhyThisMatch(LOW_BREAKDOWN, 0.25);
    expect(result.dimensions).toHaveLength(3);
  });
});

// ── generateWhyThisMatchLLM() ─────────────────────────────────────────────────

describe('generateWhyThisMatchLLM()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  it('returns rule-based result when cache miss and AI not configured', async () => {
    // @abroad-matrimony/ai is not installed in tests — dynamic import will fail or return unconfigured
    const result = await generateWhyThisMatchLLM('user-a', 'user-b', HIGH_BREAKDOWN, 0.9);

    expect(result.headline).toBeTruthy();
    expect(result.dimensions).toHaveLength(3);
    // Falls back to rule-based when AI absent
    expect(result.isAiGenerated).toBe(false);
  });

  it('returns cached LLM text on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({
      headline: 'Cached headline',
      summary:  'Cached summary from Redis.',
    });

    const result = await generateWhyThisMatchLLM('user-a', 'user-b', HIGH_BREAKDOWN, 0.9);

    expect(result.headline).toBe('Cached headline');
    expect(result.summary).toBe('Cached summary from Redis.');
    expect(result.isAiGenerated).toBe(true);
  });

  it('does not call cacheSet on a cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ headline: 'h', summary: 's' });

    await generateWhyThisMatchLLM('user-a', 'user-b', HIGH_BREAKDOWN, 0.9);

    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('falls back to rule-based when cache read throws', async () => {
    mockCacheGet.mockRejectedValueOnce(new Error('Redis down'));

    const result = await generateWhyThisMatchLLM('user-a', 'user-b', HIGH_BREAKDOWN, 0.9);

    expect(result.isAiGenerated).toBe(false);
    expect(result.dimensions).toHaveLength(3);
  });

  it('uses canonical key order (smaller UUID first)', async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    // user-a < user-b lexicographically — reverse order call should still use same key
    await generateWhyThisMatchLLM('user-b', 'user-a', HIGH_BREAKDOWN, 0.9);

    const capturedKey = mockCacheGet.mock.calls[0][0] as string;
    expect(capturedKey).toContain('user-a');
    expect(capturedKey.indexOf('user-a')).toBeLessThan(capturedKey.indexOf('user-b'));
  });
});
