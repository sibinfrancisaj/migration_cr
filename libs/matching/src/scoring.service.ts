import { RealLifeQuestionKey, VerificationStatus } from '@abroad-matrimony/shared';
import type { ScoreBreakdown } from '@abroad-matrimony/shared';

// ── Weights — core 9 dimensions sum to 1.0 ────────────────────────────────────

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
} as const;

/**
 * Habit dimension weights (HABIT-008).
 * When both users have habit data, these contribute 0.05 of the total score.
 * The 9 core weights are scaled down proportionally to keep the total at 1.0.
 */
export const HABIT_WEIGHTS = {
  habitConsistency: 0.03,
  habitOverlap:     0.02,
} as const;

/**
 * Prompt resonance weight (PROMPT-007).
 * When both users have prompt activity, this contributes 0.02 of the total.
 * Combined with HABIT_WEIGHTS (0.05), core is scaled by 0.93.
 */
export const PROMPT_RESONANCE_WEIGHT = 0.02;

/**
 * Algorithm v2 dimension weights (ALG-004 through ALG-009).
 * Each is opt-in — only added when both users have the relevant data.
 * Max total additional allocation = 0.10; minimum coreScale = 0.80.
 */
export const V2_DIM_WEIGHTS = {
  familyInvolvement:   0.03, // ALG-004/005
  eventCoAttendance:   0.02, // ALG-006
  communicationStyle:  0.02, // ALG-007
  profileViewMomentum: 0.01, // ALG-008
  trustLayerDepth:     0.02, // ALG-009
} as const;

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
  /**
   * HABIT-008: fraction of days (0.0–1.0) the user logged any habit in the
   * last 30 days. Undefined = no habit data fetched.
   */
  habitConsistencyRate?: number;
  /**
   * HABIT-008: set of HabitKeys the user has actively logged in last 30 days.
   * Undefined = no habit data fetched.
   */
  activeHabitKeys?: Set<string>;
  /**
   * PROMPT-007: Set of user IDs whose prompt responses this user has resonated with.
   * Undefined = no prompt resonate data fetched.
   */
  promptResonatedUserIds?: Set<string>;

  // ── v2 optional fields ───────────────────────────────────────────────────────

  /**
   * ALG-006: Set of event IDs where this user has a GOING RSVP.
   * Undefined = event data not fetched.
   */
  eventAttendedIds?: Set<string>;

  /**
   * ALG-007: Whether the user has a voice intro transcript.
   * Undefined = voice intro data not fetched.
   */
  hasVoiceIntro?: boolean;

  /**
   * ALG-008: Number of profile views this user received in the last 7 days.
   * Undefined = view data not fetched.
   */
  recentViewCount?: number;

  /**
   * ALG-009: Trust score (0–100) for this user.
   * Undefined = trust data not fetched.
   */
  profileTrustScore?: number;
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

  // HABIT-008: include habit dimensions when both users have habit data
  const hasHabitData =
    userA.habitConsistencyRate !== undefined &&
    userB.habitConsistencyRate !== undefined &&
    userA.activeHabitKeys !== undefined &&
    userB.activeHabitKeys !== undefined;

  if (hasHabitData) {
    breakdown.habitConsistency = scoreHabitConsistency(userA, userB);
    breakdown.habitOverlap     = scoreHabitOverlap(userA, userB);
  }

  // PROMPT-007: include prompt resonance when both users have prompt activity data
  const hasPromptData =
    userA.promptResonatedUserIds !== undefined &&
    userB.promptResonatedUserIds !== undefined;

  if (hasPromptData) {
    breakdown.promptResonance = scorePromptResonance(userA, userB);
  }

  // ALG-004/005: family involvement — when both have PARENTS_INVOLVEMENT answer
  const hasFamilyData =
    userA.realLifeAnswers.has(RealLifeQuestionKey.PARENTS_INVOLVEMENT) &&
    userB.realLifeAnswers.has(RealLifeQuestionKey.PARENTS_INVOLVEMENT);

  if (hasFamilyData) {
    breakdown.familyInvolvement = scoreFamilyInvolvement(userA, userB);
  }

  // ALG-006: event co-attendance — when both have event RSVP data
  const hasEventData =
    userA.eventAttendedIds !== undefined && userB.eventAttendedIds !== undefined;

  if (hasEventData) {
    breakdown.eventCoAttendance = scoreEventCoAttendance(userA, userB);
  }

  // ALG-007: communication style — when both have voice intro data
  const hasCommData =
    userA.hasVoiceIntro !== undefined && userB.hasVoiceIntro !== undefined;

  if (hasCommData) {
    breakdown.communicationStyle = scoreCommunicationStyle(userA, userB);
  }

  // ALG-008: profile view momentum — when both have view count data
  const hasMomentumData =
    userA.recentViewCount !== undefined && userB.recentViewCount !== undefined;

  if (hasMomentumData) {
    breakdown.profileViewMomentum = scoreProfileViewMomentum(userA, userB);
  }

  // ALG-009: trust layer depth — when both have trust score data
  const hasTrustData =
    userA.profileTrustScore !== undefined && userB.profileTrustScore !== undefined;

  if (hasTrustData) {
    breakdown.trustLayerDepth = scoreTrustLayerDepth(userA, userB);
  }

  // Compute weighted total.
  // Optional allocations scale the core contribution down.
  const habitAlloc   = hasHabitData   ? 0.05 : 0.0;
  const promptAlloc  = hasPromptData  ? 0.02 : 0.0;
  const familyAlloc  = hasFamilyData  ? V2_DIM_WEIGHTS.familyInvolvement   : 0.0;
  const eventAlloc   = hasEventData   ? V2_DIM_WEIGHTS.eventCoAttendance   : 0.0;
  const commAlloc    = hasCommData    ? V2_DIM_WEIGHTS.communicationStyle  : 0.0;
  const momentumAlloc = hasMomentumData ? V2_DIM_WEIGHTS.profileViewMomentum : 0.0;
  const trustAlloc   = hasTrustData   ? V2_DIM_WEIGHTS.trustLayerDepth     : 0.0;
  const coreScale    = 1.0 - habitAlloc - promptAlloc - familyAlloc - eventAlloc
                           - commAlloc - momentumAlloc - trustAlloc;

  const coreTotal =
    breakdown.verification        * SCORE_WEIGHTS.verification        +
    breakdown.settlementIntent    * SCORE_WEIGHTS.settlementIntent    +
    breakdown.realLifeAnswers     * SCORE_WEIGHTS.realLifeAnswers     +
    breakdown.profileCompleteness * SCORE_WEIGHTS.profileCompleteness +
    breakdown.checkInRecency      * SCORE_WEIGHTS.checkInRecency      +
    breakdown.ageCompatibility    * SCORE_WEIGHTS.ageCompatibility    +
    breakdown.groupMembership     * SCORE_WEIGHTS.groupMembership     +
    breakdown.languageMatch       * SCORE_WEIGHTS.languageMatch       +
    breakdown.faithAlignment      * SCORE_WEIGHTS.faithAlignment;

  const totalScore = round2(
    coreTotal * coreScale +
    (breakdown.habitConsistency   ?? 0) * HABIT_WEIGHTS.habitConsistency +
    (breakdown.habitOverlap       ?? 0) * HABIT_WEIGHTS.habitOverlap +
    (breakdown.promptResonance    ?? 0) * PROMPT_RESONANCE_WEIGHT +
    (breakdown.familyInvolvement  ?? 0) * V2_DIM_WEIGHTS.familyInvolvement +
    (breakdown.eventCoAttendance  ?? 0) * V2_DIM_WEIGHTS.eventCoAttendance +
    (breakdown.communicationStyle ?? 0) * V2_DIM_WEIGHTS.communicationStyle +
    (breakdown.profileViewMomentum ?? 0) * V2_DIM_WEIGHTS.profileViewMomentum +
    (breakdown.trustLayerDepth    ?? 0) * V2_DIM_WEIGHTS.trustLayerDepth,
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

// ── HABIT-008 dimension scorers ───────────────────────────────────────────────

/**
 * Habit consistency similarity: 1 - |rateA - rateB|.
 * Both users with 80% rate → 1.0 - 0.0 = 1.0.
 * One at 100%, one at 0% → 1.0 - 1.0 = 0.0.
 * Called only when both users have habit data.
 */
function scoreHabitConsistency(a: UserScoringData, b: UserScoringData): number {
  const rateA = a.habitConsistencyRate ?? 0;
  const rateB = b.habitConsistencyRate ?? 0;
  return round2(1.0 - Math.abs(rateA - rateB));
}

/**
 * Habit overlap: Jaccard similarity of active habit key sets.
 * Called only when both users have habit data.
 */
function scoreHabitOverlap(a: UserScoringData, b: UserScoringData): number {
  const setA = a.activeHabitKeys ?? new Set<string>();
  const setB = b.activeHabitKeys ?? new Set<string>();
  if (setA.size === 0 && setB.size === 0) return 0.0;
  const intersection = new Set([...setA].filter((k) => setB.has(k)));
  const union = new Set([...setA, ...setB]);
  return round2(intersection.size / union.size);
}

// ── ALG-004/005: family involvement ──────────────────────────────────────────

/**
 * Average Jaccard similarity of PARENTS_INVOLVEMENT and FAMILY_STRUCTURE answers.
 * Called only when both users have answered PARENTS_INVOLVEMENT.
 */
function scoreFamilyInvolvement(a: UserScoringData, b: UserScoringData): number {
  const keys = [RealLifeQuestionKey.PARENTS_INVOLVEMENT, RealLifeQuestionKey.FAMILY_STRUCTURE] as const;
  let total = 0;
  let count = 0;
  for (const key of keys) {
    const av = a.realLifeAnswers.get(key);
    const bv = b.realLifeAnswers.get(key);
    if (av !== undefined && bv !== undefined) {
      total += answerSimilarity(av, bv);
      count++;
    }
  }
  return count === 0 ? 0.0 : round2(total / count);
}

// ── ALG-006: event co-attendance ──────────────────────────────────────────────

/**
 * 1.0 if both users attended (GOING) at least one shared event, else 0.0.
 */
function scoreEventCoAttendance(a: UserScoringData, b: UserScoringData): number {
  const aIds = a.eventAttendedIds ?? new Set<string>();
  const bIds = b.eventAttendedIds ?? new Set<string>();
  for (const id of aIds) {
    if (bIds.has(id)) return 1.0;
  }
  return 0.0;
}

// ── ALG-007: communication style ──────────────────────────────────────────────

/**
 * Voice intro engagement score:
 *   Both have voice intro → 1.0
 *   One has voice intro  → 0.5
 *   Neither              → 0.0
 */
function scoreCommunicationStyle(a: UserScoringData, b: UserScoringData): number {
  const aHas = a.hasVoiceIntro ?? false;
  const bHas = b.hasVoiceIntro ?? false;
  if (aHas && bHas) return 1.0;
  if (aHas || bHas) return 0.5;
  return 0.0;
}

// ── ALG-008: profile view momentum ────────────────────────────────────────────

/**
 * Average normalised recent profile view count.
 * 10+ views in last 7 days → 1.0 (linear scale, capped at 1.0).
 */
function scoreProfileViewMomentum(a: UserScoringData, b: UserScoringData): number {
  const aScore = Math.min((a.recentViewCount ?? 0) / 10, 1.0);
  const bScore = Math.min((b.recentViewCount ?? 0) / 10, 1.0);
  return round2((aScore + bScore) / 2);
}

// ── ALG-009: trust layer depth ────────────────────────────────────────────────

/**
 * Average normalised trust score for both users (trustScore / 100).
 */
function scoreTrustLayerDepth(a: UserScoringData, b: UserScoringData): number {
  const aScore = (a.profileTrustScore ?? 0) / 100;
  const bScore = (b.profileTrustScore ?? 0) / 100;
  return round2((aScore + bScore) / 2);
}

// ── PROMPT-007 dimension scorer ───────────────────────────────────────────────

/**
 * Prompt resonance score: measures mutual interest via "resonate" reactions.
 *   Both users resonated each other's responses → 1.0 (strong mutual signal)
 *   Only one resonated the other's response    → 0.5 (one-way interest)
 *   Neither resonated the other               → 0.0
 * Called only when both users have prompt resonance data.
 */
function scorePromptResonance(a: UserScoringData, b: UserScoringData): number {
  const aSetB = a.promptResonatedUserIds?.has(b.userId) ?? false;
  const bSetA = b.promptResonatedUserIds?.has(a.userId) ?? false;
  if (aSetB && bSetA) return 1.0;
  if (aSetB || bSetA) return 0.5;
  return 0.0;
}

/** Round to 2 decimal places (avoids floating-point drift in scores). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Tuning application (ALG-011 / ALG-012) ───────────────────────────────────

import type { ScoreBreakdown } from '@abroad-matrimony/shared';
import type { MatchWeights } from './match-tuning.service.js';

/**
 * Applies per-user tuning multipliers to a stored `ScoreBreakdown` and returns
 * a personalised total score.
 *
 * The dimension weights are first multiplied by the user's tuning factor, then
 * the result is normalised so the weights still sum to 1.0. Dimensions absent
 * from the breakdown are treated as zero contribution.
 *
 * @param breakdown  The stored per-dimension scores (0.0–1.0 each)
 * @param weights    Tuning multipliers (default 1.0 per dimension)
 * @returns          Personalised total score (0.0–1.0)
 */
export function applyTuningToBreakdown(
  breakdown: ScoreBreakdown,
  weights: MatchWeights,
): number {
  const BASE_WEIGHTS: Record<string, number> = {
    verification:        SCORE_WEIGHTS.verification,
    settlementIntent:    SCORE_WEIGHTS.settlementIntent,
    realLifeAnswers:     SCORE_WEIGHTS.realLifeAnswers,
    profileCompleteness: SCORE_WEIGHTS.profileCompleteness,
    checkInRecency:      SCORE_WEIGHTS.checkInRecency,
    ageCompatibility:    SCORE_WEIGHTS.ageCompatibility,
    groupMembership:     SCORE_WEIGHTS.groupMembership,
    languageMatch:       SCORE_WEIGHTS.languageMatch,
    faithAlignment:      SCORE_WEIGHTS.faithAlignment,
    habitConsistency:    HABIT_WEIGHTS.habitConsistency,
    habitOverlap:        HABIT_WEIGHTS.habitOverlap,
    promptResonance:     PROMPT_RESONANCE_WEIGHT,
    familyInvolvement:   V2_DIM_WEIGHTS.familyInvolvement,
    eventCoAttendance:   V2_DIM_WEIGHTS.eventCoAttendance,
    communicationStyle:  V2_DIM_WEIGHTS.communicationStyle,
    profileViewMomentum: V2_DIM_WEIGHTS.profileViewMomentum,
    trustLayerDepth:     V2_DIM_WEIGHTS.trustLayerDepth,
  };

  // Only include dimensions that are present in the breakdown
  const presentDims = Object.entries(breakdown as Record<string, number | undefined>)
    .filter(([, v]) => v !== undefined) as Array<[string, number]>;

  // Apply tuning multiplier to each dimension's base weight
  const adjustedWeights = presentDims.map(([dim]) => ({
    dim,
    score: (breakdown as Record<string, number>)[dim] ?? 0,
    weight: (BASE_WEIGHTS[dim] ?? 0.01) * (weights[dim] ?? 1.0),
  }));

  const totalWeight = adjustedWeights.reduce((s, { weight }) => s + weight, 0);
  if (totalWeight === 0) return 0.0;

  const weighted = adjustedWeights.reduce((s, { score, weight }) => s + score * weight, 0);
  return round2(weighted / totalWeight);
}
