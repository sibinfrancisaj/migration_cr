import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { applyTuningToBreakdown } from './scoring.service.js';
import type { ScoreBreakdown } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'matching:tuning' });

// ─── Types ────────────────────────────────────────────────────────────────────

/** Each key maps a dimension name to a multiplier (0.1 – 3.0, default 1.0). */
export type MatchWeights = Partial<Record<string, number>>;

export interface MatchTuningDto {
  userId: string;
  weights: MatchWeights;
  updatedAt: string;
}

/** Importance rating 1–5 as answered in the simplified tuning UI (ALG-011). */
export interface TuningQuestionsDto {
  userId: string;
  settlementImportance: number;  // 1–5, maps to settlementIntent weight
  familyImportance: number;      // 1–5, maps to familyInvolvement weight
  updatedAt: string;
}

/** Result of the impact preview (ALG-012). */
export interface TuningImpactDto {
  pairsAnalysed: number;
  profilesUp: number;
  profilesDown: number;
  profilesUnchanged: number;
  topGainers: Array<{ userId: string; currentScore: number; projectedScore: number }>;
}

// ─── Importance ↔ multiplier helpers ─────────────────────────────────────────

/** Maps a 1–5 importance rating to a dimension multiplier. */
export function importanceToMultiplier(importance: number): number {
  const MAP: Record<number, number> = { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.75, 5: 2.5 };
  return MAP[Math.round(Math.max(1, Math.min(5, importance)))] ?? 1.0;
}

/** Maps a dimension multiplier back to the nearest 1–5 importance rating. */
export function multiplierToImportance(multiplier: number): number {
  if (multiplier <= 0.6)  return 1;
  if (multiplier <= 0.87) return 2;
  if (multiplier <= 1.35) return 3;
  if (multiplier <= 2.1)  return 4;
  return 5;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Get the match tuning weights for a user.
 * Returns default (empty) weights if no custom weights have been set.
 */
export async function getMatchTuning(userId: string): Promise<MatchTuningDto> {
  const row = await prisma.matchTuning.findUnique({
    where: { userId },
    select: { userId: true, weights: true, updatedAt: true },
  });

  if (!row) {
    return {
      userId,
      weights: {},
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    userId: row.userId,
    weights: row.weights as MatchWeights,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Set or update match tuning weights for a user.
 *
 * Weights must be in range 0.1 – 3.0. Values outside this range are clamped.
 */
export async function setMatchTuning(
  userId: string,
  weights: MatchWeights,
): Promise<MatchTuningDto> {
  // Clamp each weight to [0.1, 3.0]
  const clamped: MatchWeights = {};
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value === 'number') {
      clamped[key] = Math.min(3.0, Math.max(0.1, value));
    }
  }

  const row = await prisma.matchTuning.upsert({
    where: { userId },
    create: { userId, weights: clamped },
    update: { weights: clamped },
    select: { userId: true, weights: true, updatedAt: true },
  });

  log.info('setMatchTuning — weights updated', { userId, keys: Object.keys(clamped) });

  return {
    userId: row.userId,
    weights: row.weights as MatchWeights,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Simplified 2-question API (ALG-011) ──────────────────────────────────────

/**
 * Save tuning from the simplified 2-question UI.
 * Translates importance ratings (1–5) to dimension multipliers and stores
 * them via `setMatchTuning`.
 */
export async function setTuningFromQuestions(
  userId: string,
  settlementImportance: number,
  familyImportance: number,
): Promise<TuningQuestionsDto> {
  const weights: MatchWeights = {
    settlementIntent:  importanceToMultiplier(settlementImportance),
    familyInvolvement: importanceToMultiplier(familyImportance),
  };

  const saved = await setMatchTuning(userId, weights);

  return {
    userId,
    settlementImportance,
    familyImportance,
    updatedAt: saved.updatedAt,
  };
}

/**
 * Get the current tuning expressed as 2-question importance ratings.
 */
export async function getTuningAsQuestions(userId: string): Promise<TuningQuestionsDto> {
  const dto = await getMatchTuning(userId);
  const w = dto.weights as MatchWeights;

  return {
    userId,
    settlementImportance: multiplierToImportance(w['settlementIntent'] ?? 1.0),
    familyImportance:     multiplierToImportance(w['familyInvolvement'] ?? 1.0),
    updatedAt: dto.updatedAt,
  };
}

// ─── Tuning impact preview (ALG-012) ──────────────────────────────────────────

/**
 * Computes how many of the user's top 20 stored pairs would change rank
 * if the proposed tuning were applied. Reads stored `scoreBreakdown` from DB.
 */
export async function computeTuningImpact(
  userId: string,
  settlementImportance: number,
  familyImportance: number,
): Promise<TuningImpactDto> {
  const proposedWeights: MatchWeights = {
    settlementIntent:  importanceToMultiplier(settlementImportance),
    familyInvolvement: importanceToMultiplier(familyImportance),
  };

  const scoreRows = await prisma.matchScore.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { totalScore: 'desc' },
    take: 20,
    select: {
      userAId:    true,
      userBId:    true,
      totalScore: true,
      breakdown:  true,
    },
  });

  let profilesUp = 0;
  let profilesDown = 0;
  let profilesUnchanged = 0;
  const gainers: Array<{ userId: string; currentScore: number; projectedScore: number }> = [];

  for (const row of scoreRows) {
    const otherUserId = row.userAId === userId ? row.userBId : row.userAId;
    const breakdown = row.breakdown as ScoreBreakdown;
    const projected = applyTuningToBreakdown(breakdown, proposedWeights);
    const delta = projected - row.totalScore;

    if (delta > 0.02) {
      profilesUp++;
      gainers.push({ userId: otherUserId, currentScore: row.totalScore, projectedScore: projected });
    } else if (delta < -0.02) {
      profilesDown++;
    } else {
      profilesUnchanged++;
    }
  }

  gainers.sort((a, b) => (b.projectedScore - b.currentScore) - (a.projectedScore - a.currentScore));

  log.info('computeTuningImpact — computed', { userId, profilesUp, profilesDown });

  return {
    pairsAnalysed:    scoreRows.length,
    profilesUp,
    profilesDown,
    profilesUnchanged,
    topGainers:       gainers.slice(0, 5),
  };
}
