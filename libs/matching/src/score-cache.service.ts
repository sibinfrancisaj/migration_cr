import { cacheGet, cacheSet, cacheDel } from '@abroad-matrimony/cache';
import { createChildLogger } from '@abroad-matrimony/logger';
import { prisma } from '@abroad-matrimony/db';
import { CACHE_KEYS, CACHE_TTL } from '@abroad-matrimony/shared';
import type { MatchScoreDto, ScoreBreakdown } from '@abroad-matrimony/shared';
import { ALGORITHM_VERSION } from './match-score.service.js';

const log = createChildLogger({ module: 'matching:score-cache' });

// ── Key helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the canonical cache key for a match-score pair.
 * Always uses the lexicographically smaller UUID first so reads and writes
 * are always consistent regardless of call order.
 */
function pairKey(idA: string, idB: string): string {
  const [a, b] = idA < idB ? [idA, idB] : [idB, idA];
  return CACHE_KEYS.MATCH_SCORE_PAIR(a, b);
}

// ── Date hydration ────────────────────────────────────────────────────────────

/**
 * JSON.parse() turns Date objects into strings.
 * Re-hydrate any Date fields before returning cached DTOs to callers.
 */
function hydrateDates(raw: Record<string, unknown>): MatchScoreDto {
  return {
    ...(raw as unknown as MatchScoreDto),
    computedAt: new Date(raw['computedAt'] as string),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Cache-aside score lookup.
 *
 * 1. Try Redis — return immediately on hit.
 * 2. On cache miss (or Redis error) — fall back to the DB.
 * 3. Populate the cache after a DB hit so the next read is fast.
 * 4. Return `null` if neither Redis nor the DB has the score.
 *
 * Redis errors are swallowed and logged; the function always falls through to
 * the DB rather than surfacing transient cache failures to callers.
 */
export async function getMatchScore(
  userAId: string,
  userBId: string,
): Promise<MatchScoreDto | null> {
  const key = pairKey(userAId, userBId);

  // ── 1. Redis lookup ────────────────────────────────────────────────────────
  try {
    const cached = await cacheGet<Record<string, unknown>>(key);
    if (cached) {
      log.debug('Match score cache hit', { key });
      return hydrateDates(cached);
    }
  } catch (err) {
    log.warn('Redis read error in getMatchScore — falling through to DB', { err });
  }

  // ── 2. DB fallback ─────────────────────────────────────────────────────────
  const [canonA, canonB] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

  const row = await prisma.matchScore.findUnique({
    where: {
      userAId_userBId_algorithmV: {
        userAId:    canonA,
        userBId:    canonB,
        algorithmV: ALGORITHM_VERSION,
      },
    },
  });

  if (!row) return null;

  const dto: MatchScoreDto = {
    userAId:    row.userAId,
    userBId:    row.userBId,
    totalScore: row.totalScore,
    breakdown:  row.breakdown as unknown as ScoreBreakdown,
    computedAt: row.computedAt,
  };

  // ── 3. Populate cache for next time ────────────────────────────────────────
  try {
    await cacheSet(key, dto, CACHE_TTL.MATCH_SCORES_SECONDS);
  } catch (err) {
    log.warn('Redis write error after DB fallback in getMatchScore — ignoring', { err });
  }

  return dto;
}

/**
 * Writes (or overwrites) a match-score DTO in the cache.
 * Called by `computeAndSaveScore` after every DB upsert so the cache stays
 * in sync without waiting for the next `getMatchScore` call.
 *
 * Redis errors are swallowed — the DB is the source of truth.
 */
export async function setMatchScoreCache(score: MatchScoreDto): Promise<void> {
  const key = pairKey(score.userAId, score.userBId);
  try {
    await cacheSet(key, score, CACHE_TTL.MATCH_SCORES_SECONDS);
    log.debug('Match score cached', { key });
  } catch (err) {
    log.warn('Redis write error in setMatchScoreCache — ignoring', { err });
  }
}

/**
 * Removes a pair's score from the cache.
 * Useful when a score is known to be stale (e.g. profile update hook).
 *
 * Redis errors are swallowed.
 */
export async function deleteMatchScoreCache(
  userAId: string,
  userBId: string,
): Promise<void> {
  const key = pairKey(userAId, userBId);
  try {
    await cacheDel(key);
    log.debug('Match score cache evicted', { key });
  } catch (err) {
    log.warn('Redis delete error in deleteMatchScoreCache — ignoring', { err });
  }
}
