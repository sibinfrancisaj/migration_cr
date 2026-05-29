import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'matching:tuning' });

// ─── Types ────────────────────────────────────────────────────────────────────

/** Each key maps a dimension name to a multiplier (0.1 – 3.0, default 1.0). */
export type MatchWeights = Partial<Record<string, number>>;

export interface MatchTuningDto {
  userId: string;
  weights: MatchWeights;
  updatedAt: string;
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
