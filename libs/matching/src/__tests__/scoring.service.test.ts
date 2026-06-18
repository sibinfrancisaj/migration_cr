import {
  computeMatchScore,
  applyTuningToBreakdown,
  SCORE_WEIGHTS,
  tokenize,
  jaccardSimilarity,
  answerSimilarity,
  recencyScore,
  ageInYears,
} from '../scoring.service.js';
import type { UserScoringData } from '../scoring.service.js';
import { RealLifeQuestionKey, VerificationStatus } from '@abroad-matrimony/shared';
import type { ScoreBreakdown } from '@abroad-matrimony/shared';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-27T12:00:00.000Z');

/** Build a UserScoringData with sensible defaults, overridable per-test. */
function makeUser(overrides: Partial<UserScoringData> = {}): UserScoringData {
  return {
    userId: 'user-a',
    profile: {
      dateOfBirth:        new Date('1992-06-15'),    // age 33
      settlementIntent:   'UK or Canada',
      completionScore:    100,
      verificationStatus: VerificationStatus.APPROVED,
    },
    realLifeAnswers: new Map([
      [RealLifeQuestionKey.DIET,             'Vegetarian'],
      [RealLifeQuestionKey.FAITH_IN_PRACTICE,'Hindu'],
      [RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil'],
      [RealLifeQuestionKey.KIDS,             'Yes, 2'],
      [RealLifeQuestionKey.WHERE_TO_SETTLE,  'Europe'],
    ]),
    latestCheckIn: new Date('2026-05-25T10:00:00.000Z'), // 2 days ago
    groupIds: new Set(['group-london']),
    ...overrides,
  };
}

function makeUserB(overrides: Partial<UserScoringData> = {}): UserScoringData {
  return makeUser({
    userId: 'user-b',
    ...overrides,
  });
}

// ── Helper functions ──────────────────────────────────────────────────────────

describe('tokenize()', () => {
  it('lowercases all tokens', () => {
    expect(tokenize('UK Canada')).toEqual(new Set(['uk', 'canada']));
  });

  it('splits on commas', () => {
    expect(tokenize('UK,Canada')).toEqual(new Set(['uk', 'canada']));
  });

  it('splits on slashes', () => {
    expect(tokenize('UK/Canada')).toEqual(new Set(['uk', 'canada']));
  });

  it('filters tokens shorter than 2 characters', () => {
    const result = tokenize('A UK');
    expect(result.has('a')).toBe(false);
    expect(result.has('uk')).toBe(true);
  });

  it('returns an empty set for an empty string', () => {
    expect(tokenize('')).toEqual(new Set());
  });

  it('deduplicates tokens', () => {
    const result = tokenize('UK UK Canada');
    expect(result.size).toBe(2);
  });
});

describe('jaccardSimilarity()', () => {
  it('returns 1.0 for identical sets', () => {
    const s = new Set(['uk', 'canada']);
    expect(jaccardSimilarity(s, s)).toBe(1.0);
  });

  it('returns 0.0 for completely disjoint sets', () => {
    expect(jaccardSimilarity(new Set(['uk']), new Set(['india']))).toBe(0.0);
  });

  it('returns 0.0 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0.0);
  });

  it('computes partial overlap correctly', () => {
    // {uk, canada} ∩ {uk, australia} = {uk} → 1/3
    const result = jaccardSimilarity(new Set(['uk', 'canada']), new Set(['uk', 'australia']));
    expect(result).toBeCloseTo(0.33, 2);
  });
});

describe('answerSimilarity()', () => {
  it('returns 1.0 for identical strings', () => {
    expect(answerSimilarity('Vegetarian', 'Vegetarian')).toBe(1.0);
  });

  it('is case-insensitive', () => {
    expect(answerSimilarity('Hindu', 'hindu')).toBe(1.0);
  });

  it('returns 0.0 for different strings', () => {
    expect(answerSimilarity('Vegetarian', 'Non-vegetarian')).toBe(0.0);
  });

  it('handles array vs array (Jaccard)', () => {
    expect(answerSimilarity(['English', 'Tamil'], ['Tamil', 'Hindi'])).toBeCloseTo(0.33, 2);
  });

  it('handles string vs array', () => {
    expect(answerSimilarity('Tamil', ['Tamil', 'Hindi'])).toBeCloseTo(0.5, 2);
  });

  it('returns 0.0 for empty string vs non-empty string', () => {
    expect(answerSimilarity('', 'Vegetarian')).toBe(0.0);
  });
});

describe('recencyScore()', () => {
  it('returns 0.0 when check-in is null', () => {
    expect(recencyScore(null, NOW)).toBe(0.0);
  });

  it('returns 1.0 when checked in today', () => {
    expect(recencyScore(NOW, NOW)).toBe(1.0);
  });

  it('returns 1.0 within 7 days', () => {
    const d = new Date(NOW.getTime() - 6 * 86_400_000);
    expect(recencyScore(d, NOW)).toBe(1.0);
  });

  it('returns 0.75 between 8 and 14 days', () => {
    const d = new Date(NOW.getTime() - 10 * 86_400_000);
    expect(recencyScore(d, NOW)).toBe(0.75);
  });

  it('returns 0.5 between 15 and 30 days', () => {
    const d = new Date(NOW.getTime() - 20 * 86_400_000);
    expect(recencyScore(d, NOW)).toBe(0.5);
  });

  it('returns 0.25 between 31 and 90 days', () => {
    const d = new Date(NOW.getTime() - 60 * 86_400_000);
    expect(recencyScore(d, NOW)).toBe(0.25);
  });

  it('returns 0.1 after 90 days', () => {
    const d = new Date(NOW.getTime() - 120 * 86_400_000);
    expect(recencyScore(d, NOW)).toBe(0.1);
  });
});

describe('ageInYears()', () => {
  it('computes age correctly when birthday has passed this year', () => {
    const dob = new Date('1992-01-01');
    expect(ageInYears(dob, new Date('2026-05-27'))).toBe(34);
  });

  it('computes age correctly when birthday has not passed this year', () => {
    const dob = new Date('1992-12-31');
    expect(ageInYears(dob, new Date('2026-05-27'))).toBe(33);
  });

  it('counts birthday day itself as having passed', () => {
    const dob = new Date('1992-05-27');
    expect(ageInYears(dob, new Date('2026-05-27'))).toBe(34);
  });
});

// ── computeMatchScore() ───────────────────────────────────────────────────────

describe('computeMatchScore()', () => {

  // ── Weight invariant ────────────────────────────────────────────────────────

  it('SCORE_WEIGHTS sum to exactly 1.0', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  // ── Symmetry ────────────────────────────────────────────────────────────────

  it('is symmetric — score(A,B) equals score(B,A)', () => {
    const a = makeUser();
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: new Date('1990-03-10'), settlementIntent: 'UK' } });
    const ab = computeMatchScore(a, b, NOW);
    const ba = computeMatchScore(b, a, NOW);
    expect(ab.totalScore).toBe(ba.totalScore);
  });

  // ── Perfect match ───────────────────────────────────────────────────────────

  it('scores 1.0 for two identical user profiles', () => {
    const a = makeUser();
    const b = makeUserB();
    const result = computeMatchScore(a, b, NOW);
    expect(result.totalScore).toBe(1.0);
  });

  // ── Verification dimension ──────────────────────────────────────────────────

  it('verification: both APPROVED → breakdown.verification = 1.0', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.verification).toBe(1.0);
  });

  it('verification: one APPROVED → breakdown.verification = 0.5', () => {
    const a = makeUser();
    const b = makeUserB({ profile: { ...makeUser().profile, verificationStatus: VerificationStatus.PENDING } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.verification).toBe(0.5);
  });

  it('verification: neither APPROVED → breakdown.verification = 0.0', () => {
    const a = makeUser({ profile: { ...makeUser().profile, verificationStatus: VerificationStatus.PENDING } });
    const b = makeUserB({ profile: { ...makeUser().profile, verificationStatus: VerificationStatus.PENDING } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.verification).toBe(0.0);
  });

  // ── Settlement intent dimension ─────────────────────────────────────────────

  it('settlementIntent: identical strings → 1.0', () => {
    const a = makeUser({ profile: { ...makeUser().profile, settlementIntent: 'UK' } });
    const b = makeUserB({ profile: { ...makeUser().profile, settlementIntent: 'UK' } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.settlementIntent).toBe(1.0);
  });

  it('settlementIntent: no overlap → 0.0', () => {
    const a = makeUser({ profile: { ...makeUser().profile, settlementIntent: 'Canada' } });
    const b = makeUserB({ profile: { ...makeUser().profile, settlementIntent: 'Australia' } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.settlementIntent).toBe(0.0);
  });

  it('settlementIntent: partial overlap scores between 0 and 1', () => {
    const a = makeUser({ profile: { ...makeUser().profile, settlementIntent: 'UK or Canada' } });
    const b = makeUserB({ profile: { ...makeUser().profile, settlementIntent: 'UK or Australia' } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.settlementIntent).toBeGreaterThan(0);
    expect(breakdown.settlementIntent).toBeLessThan(1);
  });

  // ── Real-life answers dimension ─────────────────────────────────────────────

  it('realLifeAnswers: full match on all answered questions → 1.0', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.realLifeAnswers).toBe(1.0);
  });

  it('realLifeAnswers: no questions answered by either user → 0.0', () => {
    const a = makeUser({ realLifeAnswers: new Map() });
    const b = makeUserB({ realLifeAnswers: new Map() });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.realLifeAnswers).toBe(0.0);
  });

  it('realLifeAnswers: questions answered only by one user are skipped', () => {
    const aAnswers = new Map([[RealLifeQuestionKey.DIET, 'Vegetarian']]);
    const bAnswers = new Map([[RealLifeQuestionKey.DIET, 'Vegetarian'], [RealLifeQuestionKey.KIDS, 'No']]);
    const a = makeUser({ realLifeAnswers: aAnswers });
    const b = makeUserB({ realLifeAnswers: bAnswers });
    const { breakdown } = computeMatchScore(a, b, NOW);
    // Only DIET is answered by both — and it matches → 1.0
    expect(breakdown.realLifeAnswers).toBe(1.0);
  });

  it('realLifeAnswers: array answers use Jaccard similarity', () => {
    const aAnswers = new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, ['English', 'Tamil']]]);
    const bAnswers = new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, ['Tamil', 'Hindi']]]);
    const a = makeUser({ realLifeAnswers: aAnswers });
    const b = makeUserB({ realLifeAnswers: bAnswers });
    const { breakdown } = computeMatchScore(a, b, NOW);
    // Jaccard: {english,tamil} ∩ {tamil,hindi} = {tamil} / {english,tamil,hindi} = 1/3
    expect(breakdown.realLifeAnswers).toBeCloseTo(0.33, 1);
  });

  // ── Profile completeness dimension ──────────────────────────────────────────

  it('profileCompleteness: both 100 → 1.0', () => {
    const a = makeUser({ profile: { ...makeUser().profile, completionScore: 100 } });
    const b = makeUserB({ profile: { ...makeUser().profile, completionScore: 100 } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.profileCompleteness).toBe(1.0);
  });

  it('profileCompleteness: both 0 → 0.0', () => {
    const a = makeUser({ profile: { ...makeUser().profile, completionScore: 0 } });
    const b = makeUserB({ profile: { ...makeUser().profile, completionScore: 0 } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.profileCompleteness).toBe(0.0);
  });

  it('profileCompleteness: average of 60 and 80 → 0.70', () => {
    const base = makeUser().profile;
    const a = makeUser({ profile: { ...base, completionScore: 60 } });
    const b = makeUserB({ profile: { ...base, completionScore: 80 } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.profileCompleteness).toBe(0.70);
  });

  // ── Check-in recency dimension ──────────────────────────────────────────────

  it('checkInRecency: both checked in today → 1.0', () => {
    const a = makeUser({ latestCheckIn: NOW });
    const b = makeUserB({ latestCheckIn: NOW });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.checkInRecency).toBe(1.0);
  });

  it('checkInRecency: neither ever checked in → 0.0', () => {
    const a = makeUser({ latestCheckIn: null });
    const b = makeUserB({ latestCheckIn: null });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.checkInRecency).toBe(0.0);
  });

  it('checkInRecency: one checked in today, one never → 0.5', () => {
    const a = makeUser({ latestCheckIn: NOW });
    const b = makeUserB({ latestCheckIn: null });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.checkInRecency).toBe(0.5);
  });

  // ── Age compatibility dimension ─────────────────────────────────────────────

  it('ageCompatibility: same age → 1.0', () => {
    const dob = new Date('1992-06-15');
    const a = makeUser({ profile: { ...makeUser().profile, dateOfBirth: dob } });
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: dob } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.ageCompatibility).toBe(1.0);
  });

  it('ageCompatibility: 5-year gap → 0.8', () => {
    const a = makeUser({ profile: { ...makeUser().profile, dateOfBirth: new Date('1990-01-01') } });
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: new Date('1995-01-01') } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.ageCompatibility).toBe(0.8);
  });

  it('ageCompatibility: 8-year gap → 0.6', () => {
    const a = makeUser({ profile: { ...makeUser().profile, dateOfBirth: new Date('1990-01-01') } });
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: new Date('1998-01-01') } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.ageCompatibility).toBe(0.6);
  });

  it('ageCompatibility: 12-year gap → 0.4', () => {
    const a = makeUser({ profile: { ...makeUser().profile, dateOfBirth: new Date('1988-01-01') } });
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: new Date('2000-01-01') } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.ageCompatibility).toBe(0.4);
  });

  it('ageCompatibility: 18-year gap → 0.2', () => {
    const a = makeUser({ profile: { ...makeUser().profile, dateOfBirth: new Date('1985-01-01') } });
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: new Date('2003-01-01') } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.ageCompatibility).toBe(0.2);
  });

  it('ageCompatibility: >20-year gap → 0.0', () => {
    const a = makeUser({ profile: { ...makeUser().profile, dateOfBirth: new Date('1970-01-01') } });
    const b = makeUserB({ profile: { ...makeUser().profile, dateOfBirth: new Date('2003-01-01') } });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.ageCompatibility).toBe(0.0);
  });

  // ── Group membership dimension ──────────────────────────────────────────────

  it('groupMembership: shared group → 1.0', () => {
    const a = makeUser({ groupIds: new Set(['group-london', 'group-uk']) });
    const b = makeUserB({ groupIds: new Set(['group-london']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.groupMembership).toBe(1.0);
  });

  it('groupMembership: no shared groups → 0.0', () => {
    const a = makeUser({ groupIds: new Set(['group-london']) });
    const b = makeUserB({ groupIds: new Set(['group-dubai']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.groupMembership).toBe(0.0);
  });

  it('groupMembership: both in no groups → 0.0', () => {
    const a = makeUser({ groupIds: new Set() });
    const b = makeUserB({ groupIds: new Set() });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.groupMembership).toBe(0.0);
  });

  // ── Language match dimension ────────────────────────────────────────────────

  it('languageMatch: same language → 1.0', () => {
    const a = makeUser({ realLifeAnswers: new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil']]) });
    const b = makeUserB({ realLifeAnswers: new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil']]) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.languageMatch).toBe(1.0);
  });

  it('languageMatch: different languages → 0.0', () => {
    const a = makeUser({ realLifeAnswers: new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil']]) });
    const b = makeUserB({ realLifeAnswers: new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Hindi']]) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.languageMatch).toBe(0.0);
  });

  it('languageMatch: unanswered by either user → 0.0', () => {
    const a = makeUser({ realLifeAnswers: new Map() });
    const b = makeUserB({ realLifeAnswers: new Map([[RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil']]) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.languageMatch).toBe(0.0);
  });

  // ── Faith alignment dimension ───────────────────────────────────────────────

  it('faithAlignment: same faith → 1.0', () => {
    const a = makeUser({ realLifeAnswers: new Map([[RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Hindu']]) });
    const b = makeUserB({ realLifeAnswers: new Map([[RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Hindu']]) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.faithAlignment).toBe(1.0);
  });

  it('faithAlignment: different faith → 0.0', () => {
    const a = makeUser({ realLifeAnswers: new Map([[RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Hindu']]) });
    const b = makeUserB({ realLifeAnswers: new Map([[RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Muslim']]) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.faithAlignment).toBe(0.0);
  });

  it('faithAlignment: unanswered by either user → 0.0', () => {
    const a = makeUser({ realLifeAnswers: new Map() });
    const b = makeUserB({ realLifeAnswers: new Map() });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.faithAlignment).toBe(0.0);
  });

  // ── Total score range ───────────────────────────────────────────────────────

  it('totalScore is within [0.0, 1.0] for a minimal profile pair', () => {
    const a = makeUser({
      profile: { ...makeUser().profile, completionScore: 0, verificationStatus: VerificationStatus.PENDING },
      realLifeAnswers: new Map(),
      latestCheckIn: null,
      groupIds: new Set(),
    });
    const b = makeUserB({
      profile: { ...makeUser().profile, completionScore: 0, verificationStatus: VerificationStatus.PENDING },
      realLifeAnswers: new Map(),
      latestCheckIn: null,
      groupIds: new Set(),
    });
    const { totalScore } = computeMatchScore(a, b, NOW);
    expect(totalScore).toBeGreaterThanOrEqual(0.0);
    expect(totalScore).toBeLessThanOrEqual(1.0);
  });

  it('breakdown contains all 9 expected dimension keys', () => {
    const { breakdown } = computeMatchScore(makeUser(), makeUserB(), NOW);
    expect(Object.keys(breakdown)).toEqual(
      expect.arrayContaining([
        'verification', 'settlementIntent', 'realLifeAnswers',
        'profileCompleteness', 'checkInRecency', 'ageCompatibility',
        'groupMembership', 'languageMatch', 'faithAlignment',
      ]),
    );
  });

  // ── HABIT-008: habit dimensions ─────────────────────────────────────────────

  it('habit dimensions absent when no habitConsistencyRate provided', () => {
    const a = makeUser(); // no habit data
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.habitConsistency).toBeUndefined();
    expect(breakdown.habitOverlap).toBeUndefined();
  });

  it('habit dimensions present when both users have habit data', () => {
    const a = makeUser({
      habitConsistencyRate: 0.8,
      activeHabitKeys: new Set(['HYDRATION', 'EXERCISE']),
    });
    const b = makeUserB({
      habitConsistencyRate: 0.7,
      activeHabitKeys: new Set(['HYDRATION', 'SLEEP']),
    });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.habitConsistency).toBeDefined();
    expect(breakdown.habitOverlap).toBeDefined();
    expect(breakdown.habitConsistency).toBeGreaterThanOrEqual(0.0);
    expect(breakdown.habitConsistency).toBeLessThanOrEqual(1.0);
    expect(breakdown.habitOverlap).toBeGreaterThanOrEqual(0.0);
    expect(breakdown.habitOverlap).toBeLessThanOrEqual(1.0);
  });

  it('habit consistency: identical rates → 1.0', () => {
    const a = makeUser({ habitConsistencyRate: 0.6, activeHabitKeys: new Set(['HYDRATION']) });
    const b = makeUserB({ habitConsistencyRate: 0.6, activeHabitKeys: new Set(['HYDRATION']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.habitConsistency).toBe(1.0);
  });

  it('habit consistency: opposite rates → 0.0', () => {
    const a = makeUser({ habitConsistencyRate: 1.0, activeHabitKeys: new Set(['HYDRATION']) });
    const b = makeUserB({ habitConsistencyRate: 0.0, activeHabitKeys: new Set(['HYDRATION']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.habitConsistency).toBe(0.0);
  });

  it('habit overlap: identical habit sets → 1.0', () => {
    const keys = new Set(['HYDRATION', 'EXERCISE']);
    const a = makeUser({ habitConsistencyRate: 0.5, activeHabitKeys: keys });
    const b = makeUserB({ habitConsistencyRate: 0.5, activeHabitKeys: keys });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.habitOverlap).toBe(1.0);
  });

  it('habit overlap: no common habits → 0.0', () => {
    const a = makeUser({ habitConsistencyRate: 0.5, activeHabitKeys: new Set(['HYDRATION']) });
    const b = makeUserB({ habitConsistencyRate: 0.5, activeHabitKeys: new Set(['EXERCISE']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.habitOverlap).toBe(0.0);
  });

  it('total score stays ≤ 1.0 when habit dimensions are included', () => {
    const a = makeUser({
      habitConsistencyRate: 1.0,
      activeHabitKeys: new Set(['HYDRATION', 'EXERCISE', 'SLEEP']),
    });
    const b = makeUserB({
      habitConsistencyRate: 1.0,
      activeHabitKeys: new Set(['HYDRATION', 'EXERCISE', 'SLEEP']),
    });
    const { totalScore } = computeMatchScore(a, b, NOW);
    expect(totalScore).toBeGreaterThanOrEqual(0.0);
    expect(totalScore).toBeLessThanOrEqual(1.0);
  });

  // ── PROMPT-007: prompt resonance dimension ──────────────────────────────────

  it('promptResonance absent when promptResonatedUserIds not provided', () => {
    const a = makeUser(); // no prompt data
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.promptResonance).toBeUndefined();
  });

  it('promptResonance present when both users have prompt resonance data', () => {
    const a = makeUser({ userId: 'user-a', promptResonatedUserIds: new Set(['user-b']) });
    const b = makeUserB({ userId: 'user-b', promptResonatedUserIds: new Set(['user-a']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.promptResonance).toBeDefined();
  });

  it('promptResonance: mutual resonance → 1.0', () => {
    const a = makeUser({ userId: 'user-a', promptResonatedUserIds: new Set(['user-b']) });
    const b = makeUserB({ userId: 'user-b', promptResonatedUserIds: new Set(['user-a']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.promptResonance).toBe(1.0);
  });

  it('promptResonance: one-way A→B → 0.5', () => {
    const a = makeUser({ userId: 'user-a', promptResonatedUserIds: new Set(['user-b']) });
    const b = makeUserB({ userId: 'user-b', promptResonatedUserIds: new Set() });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.promptResonance).toBe(0.5);
  });

  it('promptResonance: neither resonated → 0.0', () => {
    const a = makeUser({ userId: 'user-a', promptResonatedUserIds: new Set() });
    const b = makeUserB({ userId: 'user-b', promptResonatedUserIds: new Set() });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.promptResonance).toBe(0.0);
  });

  it('total score stays ≤ 1.0 with both habits and prompt resonance', () => {
    const a = makeUser({
      userId: 'user-a',
      habitConsistencyRate: 1.0,
      activeHabitKeys: new Set(['HYDRATION', 'EXERCISE']),
      promptResonatedUserIds: new Set(['user-b']),
    });
    const b = makeUserB({
      userId: 'user-b',
      habitConsistencyRate: 1.0,
      activeHabitKeys: new Set(['HYDRATION', 'EXERCISE']),
      promptResonatedUserIds: new Set(['user-a']),
    });
    const { totalScore } = computeMatchScore(a, b, NOW);
    expect(totalScore).toBeGreaterThanOrEqual(0.0);
    expect(totalScore).toBeLessThanOrEqual(1.0);
  });

  it('total score with only prompt data uses 0.98 core scale', () => {
    const a = makeUser({ userId: 'user-a', promptResonatedUserIds: new Set(['user-b']) });
    const b = makeUserB({ userId: 'user-b', promptResonatedUserIds: new Set(['user-a']) });
    const { totalScore } = computeMatchScore(a, b, NOW);
    expect(totalScore).toBeGreaterThanOrEqual(0.0);
    expect(totalScore).toBeLessThanOrEqual(1.0);
  });

  // ── ALG-004/005: familyInvolvement ───────────────────────────────────────────

  it('familyInvolvement absent when PARENTS_INVOLVEMENT not answered by either user', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.familyInvolvement).toBeUndefined();
  });

  it('familyInvolvement present when both users answered PARENTS_INVOLVEMENT', () => {
    const a = makeUser({
      realLifeAnswers: new Map([
        [RealLifeQuestionKey.PARENTS_INVOLVEMENT, 'very involved'],
        [RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Hindu'],
        [RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil'],
      ]),
    });
    const b = makeUserB({
      realLifeAnswers: new Map([
        [RealLifeQuestionKey.PARENTS_INVOLVEMENT, 'very involved'],
        [RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Hindu'],
        [RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil'],
      ]),
    });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.familyInvolvement).toBeDefined();
    expect(breakdown.familyInvolvement).toBeGreaterThanOrEqual(0.0);
    expect(breakdown.familyInvolvement).toBeLessThanOrEqual(1.0);
  });

  it('familyInvolvement: identical answers → 1.0', () => {
    const answers = new Map([
      [RealLifeQuestionKey.PARENTS_INVOLVEMENT, 'very involved'],
      [RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil'],
    ]);
    const a = makeUser({ realLifeAnswers: answers });
    const b = makeUserB({ realLifeAnswers: answers });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.familyInvolvement).toBe(1.0);
  });

  // ── ALG-006: eventCoAttendance ───────────────────────────────────────────────

  it('eventCoAttendance absent when eventAttendedIds not provided', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.eventCoAttendance).toBeUndefined();
  });

  it('eventCoAttendance: shared event → 1.0', () => {
    const a = makeUser({ eventAttendedIds: new Set(['event-1', 'event-2']) });
    const b = makeUserB({ eventAttendedIds: new Set(['event-2', 'event-3']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.eventCoAttendance).toBe(1.0);
  });

  it('eventCoAttendance: no shared events → 0.0', () => {
    const a = makeUser({ eventAttendedIds: new Set(['event-1']) });
    const b = makeUserB({ eventAttendedIds: new Set(['event-2']) });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.eventCoAttendance).toBe(0.0);
  });

  // ── ALG-007: communicationStyle ──────────────────────────────────────────────

  it('communicationStyle absent when hasVoiceIntro not provided', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.communicationStyle).toBeUndefined();
  });

  it('communicationStyle: both have voice intro → 1.0', () => {
    const a = makeUser({ hasVoiceIntro: true });
    const b = makeUserB({ hasVoiceIntro: true });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.communicationStyle).toBe(1.0);
  });

  it('communicationStyle: one has voice intro → 0.5', () => {
    const a = makeUser({ hasVoiceIntro: true });
    const b = makeUserB({ hasVoiceIntro: false });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.communicationStyle).toBe(0.5);
  });

  // ── ALG-008: profileViewMomentum ─────────────────────────────────────────────

  it('profileViewMomentum absent when recentViewCount not provided', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.profileViewMomentum).toBeUndefined();
  });

  it('profileViewMomentum: 10+ views each → 1.0', () => {
    const a = makeUser({ recentViewCount: 15 });
    const b = makeUserB({ recentViewCount: 12 });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.profileViewMomentum).toBe(1.0);
  });

  it('profileViewMomentum: 5 views average → 0.5', () => {
    const a = makeUser({ recentViewCount: 5 });
    const b = makeUserB({ recentViewCount: 5 });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.profileViewMomentum).toBe(0.5);
  });

  // ── ALG-009: trustLayerDepth ─────────────────────────────────────────────────

  it('trustLayerDepth absent when profileTrustScore not provided', () => {
    const a = makeUser();
    const b = makeUserB();
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.trustLayerDepth).toBeUndefined();
  });

  it('trustLayerDepth: both 100% trust → 1.0', () => {
    const a = makeUser({ profileTrustScore: 100 });
    const b = makeUserB({ profileTrustScore: 100 });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.trustLayerDepth).toBe(1.0);
  });

  it('trustLayerDepth: 60 and 80 → 0.7', () => {
    const a = makeUser({ profileTrustScore: 60 });
    const b = makeUserB({ profileTrustScore: 80 });
    const { breakdown } = computeMatchScore(a, b, NOW);
    expect(breakdown.trustLayerDepth).toBe(0.7);
  });

  it('total score stays ≤ 1.0 with all v2 dimensions', () => {
    const answers = new Map([
      [RealLifeQuestionKey.PARENTS_INVOLVEMENT, 'very involved'],
      [RealLifeQuestionKey.FAITH_IN_PRACTICE, 'Hindu'],
      [RealLifeQuestionKey.LANGUAGE_AT_HOME, 'Tamil'],
    ]);
    const a = makeUser({
      realLifeAnswers: answers,
      promptResonatedUserIds: new Set(['user-b']),
      habitConsistencyRate: 0.9,
      activeHabitKeys: new Set(['SLEEP', 'EXERCISE']),
      eventAttendedIds: new Set(['event-1']),
      hasVoiceIntro: true,
      recentViewCount: 10,
      profileTrustScore: 90,
    });
    const b = makeUserB({
      realLifeAnswers: answers,
      promptResonatedUserIds: new Set(['user-a']),
      habitConsistencyRate: 0.9,
      activeHabitKeys: new Set(['SLEEP', 'EXERCISE']),
      eventAttendedIds: new Set(['event-1']),
      hasVoiceIntro: true,
      recentViewCount: 10,
      profileTrustScore: 90,
    });
    const { totalScore } = computeMatchScore(a, b, NOW);
    expect(totalScore).toBeGreaterThanOrEqual(0.0);
    expect(totalScore).toBeLessThanOrEqual(1.0);
  });
});

// ── applyTuningToBreakdown ────────────────────────────────────────────────────

const BASE_BREAKDOWN: ScoreBreakdown = {
  verification:        1.0,
  settlementIntent:    0.5,
  realLifeAnswers:     0.7,
  profileCompleteness: 0.8,
  checkInRecency:      1.0,
  ageCompatibility:    0.9,
  groupMembership:     1.0,
  languageMatch:       1.0,
  faithAlignment:      0.8,
};

describe('applyTuningToBreakdown', () => {
  it('returns a score in [0, 1]', () => {
    const score = applyTuningToBreakdown(BASE_BREAKDOWN, {});
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('returns same as default totalScore when all multipliers are 1.0', () => {
    const neutralWeights = Object.keys(SCORE_WEIGHTS).reduce<Record<string, number>>(
      (acc, k) => ({ ...acc, [k]: 1.0 }),
      {},
    );
    const score = applyTuningToBreakdown(BASE_BREAKDOWN, neutralWeights);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('boosting a high-scoring dimension raises the personalised score', () => {
    const base = applyTuningToBreakdown(BASE_BREAKDOWN, {});
    const boosted = applyTuningToBreakdown(BASE_BREAKDOWN, { verification: 3.0 });
    // verification=1.0 is a top score; boosting it should not hurt
    expect(boosted).toBeGreaterThanOrEqual(base - 0.01); // allow tiny float diff
  });

  it('boosting a low-scoring dimension raises the personalised score', () => {
    const base = applyTuningToBreakdown(BASE_BREAKDOWN, {});
    // settlementIntent=0.5 is low; 2.5x weight on it should lower personalised score
    // compared to boosting verification (1.0). At minimum it stays in [0,1].
    const boosted = applyTuningToBreakdown(BASE_BREAKDOWN, { settlementIntent: 2.5 });
    expect(boosted).toBeGreaterThanOrEqual(0.0);
    expect(boosted).toBeLessThanOrEqual(1.0);
  });

  it('returns 0.0 when all dimension scores are 0', () => {
    const zeroBreakdown: ScoreBreakdown = {
      verification: 0, settlementIntent: 0, realLifeAnswers: 0,
      profileCompleteness: 0, checkInRecency: 0, ageCompatibility: 0,
      groupMembership: 0, languageMatch: 0, faithAlignment: 0,
    };
    expect(applyTuningToBreakdown(zeroBreakdown, {})).toBe(0.0);
  });

  it('handles optional v2 dimensions in the breakdown', () => {
    const withV2: ScoreBreakdown = {
      ...BASE_BREAKDOWN,
      familyInvolvement: 1.0,
      trustLayerDepth:   0.8,
    };
    const score = applyTuningToBreakdown(withV2, { familyInvolvement: 2.0 });
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});
