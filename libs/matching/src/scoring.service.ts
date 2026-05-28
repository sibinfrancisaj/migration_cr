import { RealLifeQuestionKey, VerificationStatus } from '@abroad-matrimony/shared';
import type { ScoreBreakdown } from '@abroad-matrimony/shared';

// ── Weights — must sum to 1.0 ─────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  verification:        0.15,
  settlementIntent:    0.20,
  realLifeAnswers:     0.25,
  profileCompleteness: 0.10,
  checkInRecency:      0.05,
  ageCompatibility:    0.10,
  groupMembership:     0.05,
  languageMatch:       0.05,
  faithAlignment:      0.05,
} as const satisfies Record<keyof ScoreBreakdown, number>;

// ── Input type ────────────────────────────────────────────────────────────────

/**
 * All data about one user that the scoring algorithm needs.
 * Fetched by `getUserScoringData()` in match-score.service.ts before calling
 * the pure `computeMatchScore()` function.
 */
export interface UserScoringData {
  userId: string;
  profile: {
    dateOfBirth:        Date;
    settlementIntent:   string;
    completionScore:    number;   // 0–100 integer
    verificationStatus: string;   // VerificationStatus enum string value
  };
  /** All real-life answers keyed by RealLifeQuestionKey. */
  realLifeAnswers: Map<RealLifeQuestionKey, string | string[]>;
  /** Most recent check-in submission date, or null if the user never checked in. */
  latestCheckIn: Date | null;
  /** Active group IDs the user belongs to. */
  groupIds: Set<string>;
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface ScoreResult {
  /** Weighted sum of all dimension scores, normalised to 0.0–1.0. */
  totalScore: number;
  /** Per-dimension raw scores (each 0.0–1.0, before applying weight). */
  breakdown:  ScoreBreakdown;
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Pure compatibility scorer — no side effects, no DB calls.
 *
 * Produces a weighted total score and a per-dimension breakdown.
 * Symmetric: `computeMatchScore(A, B)` equals `computeMatchScore(B, A)`.
 *
 * @param userA  Pre-fetched scoring data for user A
 * @param userB  Pre-fetched scoring data for user B
 * @param now    Reference date for age / recency calculations (injectable for tests)
 */
export function computeMatchScore(
  userA: UserScoringData,
  userB: UserScoringData,
  now: Date = new Date(),
): ScoreResult {
  const breakdown: ScoreBreakdown = {
    verification:        scoreVerification(userA, userB),
    settlementIntent:    scoreSettlementIntent(userA, userB),
    realLifeAnswers:     scoreRealLifeAnswers(userA, userB),
    profileCompleteness: scoreProfileCompleteness(userA, userB),
    checkInRecency:      scoreCheckInRecency(userA, userB, now),
    ageCompatibility:    scoreAgeCompatibility(userA, userB, now),
    groupMembership:     scoreGroupMembership(userA, userB),
    languageMatch:       scoreLanguageMatch(userA, userB),
    faithAlignment:      scoreFaithAlignment(userA, userB),
  };

  const totalScore = round2(
    breakdown.verification        * SCORE_WEIGHTS.verification        +
    breakdown.settlementIntent    * SCORE_WEIGHTS.settlementIntent    +
    breakdown.realLifeAnswers     * SCORE_WEIGHTS.realLifeAnswers     +
    breakdown.profileCompleteness * SCORE_WEIGHTS.profileCompleteness +
    breakdown.checkInRecency      * SCORE_WEIGHTS.checkInRecency      +
    breakdown.ageCompatibility    * SCORE_WEIGHTS.ageCompatibility    +
    breakdown.groupMembership     * SCORE_WEIGHTS.groupMembership     +
    breakdown.languageMatch       * SCORE_WEIGHTS.languageMatch       +
    breakdown.faithAlignment      * SCORE_WEIGHTS.faithAlignment,
  );

  return { totalScore, breakdown };
}

// ── Dimension scorers (each returns 0.0–1.0) ──────────────────────────────────

/** Both users verified → 1.0; one verified → 0.5; neither → 0.0. */
function scoreVerification(a: UserScoringData, b: UserScoringData): number {
  const aVerified = a.profile.verificationStatus === VerificationStatus.APPROVED;
  const bVerified = b.profile.verificationStatus === VerificationStatus.APPROVED;
  if (aVerified && bVerified) return 1.0;
  if (aVerified || bVerified) return 0.5;
  return 0.0;
}

/** Jaccard similarity of tokenized settlementIntent strings. */
function scoreSettlementIntent(a: UserScoringData, b: UserScoringData): number {
  return jaccardSimilarity(
    tokenize(a.profile.settlementIntent),
    tokenize(b.profile.settlementIntent),
  );
}

/**
 * Average per-question answer similarity across questions both users answered.
 * Unanswered questions are skipped (no penalty for incompleteness here —
 * profileCompleteness captures that separately).
 */
function scoreRealLifeAnswers(a: UserScoringData, b: UserScoringData): number {
  let total = 0;
  let count = 0;

  for (const key of Object.values(RealLifeQuestionKey)) {
    const aVal = a.realLifeAnswers.get(key);
    const bVal = b.realLifeAnswers.get(key);
    if (aVal === undefined || bVal === undefined) continue;
    total += answerSimilarity(aVal, bVal);
    count++;
  }

  return count === 0 ? 0.0 : round2(total / count);
}

/** Average normalised completion score of both users. */
function scoreProfileCompleteness(a: UserScoringData, b: UserScoringData): number {
  return round2((a.profile.completionScore + b.profile.completionScore) / 2 / 100);
}

/** Average recency score of both users' latest check-in. */
function scoreCheckInRecency(a: UserScoringData, b: UserScoringData, now: Date): number {
  return round2((recencyScore(a.latestCheckIn, now) + recencyScore(b.latestCheckIn, now)) / 2);
}

/**
 * Age-gap compatibility. Tiered bands (years):
 *   0–3 → 1.0 · 4–6 → 0.8 · 7–10 → 0.6 · 11–15 → 0.4 · 16–20 → 0.2 · >20 → 0.0
 */
function scoreAgeCompatibility(a: UserScoringData, b: UserScoringData, now: Date): number {
  const diff = Math.abs(ageInYears(a.profile.dateOfBirth, now) - ageInYears(b.profile.dateOfBirth, now));
  if (diff <=  3) return 1.0;
  if (diff <=  6) return 0.8;
  if (diff <= 10) return 0.6;
  if (diff <= 15) return 0.4;
  if (diff <= 20) return 0.2;
  return 0.0;
}

/** Shared active group membership — any overlap → 1.0, none → 0.0. */
function scoreGroupMembership(a: UserScoringData, b: UserScoringData): number {
  for (const groupId of a.groupIds) {
    if (b.groupIds.has(groupId)) return 1.0;
  }
  return 0.0;
}

/** Similarity of LANGUAGE_AT_HOME answers. 0.0 if either user hasn't answered. */
function scoreLanguageMatch(a: UserScoringData, b: UserScoringData): number {
  const aVal = a.realLifeAnswers.get(RealLifeQuestionKey.LANGUAGE_AT_HOME);
  const bVal = b.realLifeAnswers.get(RealLifeQuestionKey.LANGUAGE_AT_HOME);
  if (aVal === undefined || bVal === undefined) return 0.0;
  return answerSimilarity(aVal, bVal);
}

/** Similarity of FAITH_IN_PRACTICE answers. 0.0 if either user hasn't answered. */
function scoreFaithAlignment(a: UserScoringData, b: UserScoringData): number {
  const aVal = a.realLifeAnswers.get(RealLifeQuestionKey.FAITH_IN_PRACTICE);
  const bVal = b.realLifeAnswers.get(RealLifeQuestionKey.FAITH_IN_PRACTICE);
  if (aVal === undefined || bVal === undefined) return 0.0;
  return answerSimilarity(aVal, bVal);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits a free-text string into a lower-cased token set.
 * Splits on whitespace, commas, slashes, and hyphens.
 * Filters tokens shorter than 2 characters (single letters, punctuation).
 */
export function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .split(/[\s,\/\-]+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2),
  );
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|.
 * Returns 0.0 when both sets are empty.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0.0;
  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return round2(intersectionSize / unionSize);
}

/**
 * Similarity between two real-life answer values.
 * Strings are wrapped in a single-element set before Jaccard comparison.
 * Arrays become sets of lower-cased, trimmed strings.
 */
export function answerSimilarity(a: string | string[], b: string | string[]): number {
  return jaccardSimilarity(normalizeAnswer(a), normalizeAnswer(b));
}

function normalizeAnswer(val: string | string[]): Set<string> {
  if (Array.isArray(val)) {
    return new Set(val.map(v => v.toLowerCase().trim()).filter(v => v.length > 0));
  }
  const normalized = val.toLowerCase().trim();
  return normalized.length > 0 ? new Set([normalized]) : new Set();
}

/**
 * Tiered recency score based on days since last check-in.
 *   ≤7 days  → 1.00
 *   ≤14 days → 0.75
 *   ≤30 days → 0.50
 *   ≤90 days → 0.25
 *   >90 days → 0.10
 *   never    → 0.00
 */
export function recencyScore(checkIn: Date | null, now: Date): number {
  if (!checkIn) return 0.0;
  const days = (now.getTime() - checkIn.getTime()) / 86_400_000;
  if (days <=  7) return 1.00;
  if (days <= 14) return 0.75;
  if (days <= 30) return 0.50;
  if (days <= 90) return 0.25;
  return 0.10;
}

/** Integer age in completed years as of `now`. */
export function ageInYears(dob: Date, now: Date): number {
  const years = now.getFullYear() - dob.getFullYear();
  const birthdayPassedThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  return birthdayPassedThisYear ? years : years - 1;
}

/** Round to 2 decimal places (avoids floating-point drift in scores). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
