import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { MatchScoreDto } from '@abroad-matrimony/shared';
import { RealLifeQuestionKey } from '@abroad-matrimony/shared';
import { computeMatchScore } from './scoring.service.js';
import type { UserScoringData } from './scoring.service.js';
import { setMatchScoreCache } from './score-cache.service.js';

const log = createChildLogger({ module: 'matching:match-score' });

export const ALGORITHM_VERSION = 'v1';

// ── Custom errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when a user has no profile row and cannot be scored.
 */
export class UserProfileMissingError extends Error {
  constructor(public readonly userId: string) {
    super(`PROFILE_MISSING:${userId}`);
    this.name = 'UserProfileMissingError';
  }
}

// ── Data fetching ─────────────────────────────────────────────────────────────

/**
 * Fetches all data needed to score a single user in parallel.
 * Exported for reuse by MATCH-002 (BullMQ batch worker).
 *
 * @throws {UserProfileMissingError} if the user has no profile row
 */
export async function getUserScoringData(userId: string): Promise<UserScoringData> {
  const [profile, answers, latestCheckIn, groupMemberships] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: {
        dateOfBirth:        true,
        settlementIntent:   true,
        completionScore:    true,
        verificationStatus: true,
      },
    }),
    prisma.realLifeAnswer.findMany({
      where:  { userId },
      select: { questionKey: true, value: true },
    }),
    prisma.checkIn.findFirst({
      where:   { userId },
      orderBy: { submittedAt: 'desc' },
      select:  { submittedAt: true },
    }),
    prisma.groupMember.findMany({
      where:  { userId, status: 'ACTIVE' },
      select: { groupId: true },
    }),
  ]);

  if (!profile) {
    log.warn('getUserScoringData — no profile found', { userId });
    throw new UserProfileMissingError(userId);
  }

  const realLifeAnswers = new Map<RealLifeQuestionKey, string | string[]>();
  for (const a of answers) {
    realLifeAnswers.set(
      a.questionKey as RealLifeQuestionKey,
      a.value as string | string[],
    );
  }

  return {
    userId,
    profile: {
      dateOfBirth:        profile.dateOfBirth,
      settlementIntent:   profile.settlementIntent,
      completionScore:    profile.completionScore,
      verificationStatus: profile.verificationStatus,
    },
    realLifeAnswers,
    latestCheckIn:  latestCheckIn?.submittedAt ?? null,
    groupIds:       new Set(groupMemberships.map(m => m.groupId)),
  };
}

// ── Pair canonicalization ─────────────────────────────────────────────────────

/**
 * Always store pairs with the lexicographically smaller UUID as userAId.
 * This guarantees the @@unique([userAId, userBId, algorithmV]) constraint
 * is never violated by reverse-order calls.
 */
function canonicalizePair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Fetches scoring data for both users, computes the compatibility score,
 * and upserts the result into `match_scores`.
 *
 * Called by:
 *   - MATCH-002 BullMQ worker (batch mode)
 *   - Future: on-demand endpoint for real-time score refresh
 *
 * @throws {Error}                   if userAId === userBId
 * @throws {UserProfileMissingError} if either user has no profile
 */
export async function computeAndSaveScore(
  userAId: string,
  userBId: string,
): Promise<MatchScoreDto> {
  if (userAId === userBId) {
    throw new Error('Cannot compute score between a user and themselves');
  }

  // Fetch both users' scoring data in parallel
  const [dataA, dataB] = await Promise.all([
    getUserScoringData(userAId),
    getUserScoringData(userBId),
  ]);

  const result                      = computeMatchScore(dataA, dataB);
  const [canonicalA, canonicalB]    = canonicalizePair(userAId, userBId);

  const saved = await prisma.matchScore.upsert({
    where: {
      userAId_userBId_algorithmV: {
        userAId:    canonicalA,
        userBId:    canonicalB,
        algorithmV: ALGORITHM_VERSION,
      },
    },
    create: {
      userAId:    canonicalA,
      userBId:    canonicalB,
      totalScore: result.totalScore,
      breakdown:  result.breakdown as unknown as Record<string, number>,
      algorithmV: ALGORITHM_VERSION,
    },
    update: {
      totalScore: result.totalScore,
      breakdown:  result.breakdown as unknown as Record<string, number>,
      computedAt: new Date(),
    },
  });

  log.info('Match score saved', {
    userAId:    canonicalA,
    userBId:    canonicalB,
    totalScore: result.totalScore,
  });

  const dto: MatchScoreDto = {
    userAId:    saved.userAId,
    userBId:    saved.userBId,
    totalScore: saved.totalScore,
    breakdown:  saved.breakdown as unknown as import('@abroad-matrimony/shared').ScoreBreakdown,
    computedAt: saved.computedAt,
  };

  // Best-effort cache population — errors are swallowed inside setMatchScoreCache
  await setMatchScoreCache(dto);

  return dto;
}
