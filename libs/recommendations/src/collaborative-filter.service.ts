/**
 * Phase G — Top-K Collaborative Filtering.
 *
 * Inspired by the TDS algorithm (https://towardsdatascience.com/how-i-built-my-own-dating-app-algorithm):
 *
 * 1. Find "neighbourhood" users who took similar positive actions on the same
 *    targets as the querying user (co-likers, co-connectors, co-savers).
 * 2. Collect profiles those neighbours positively engaged with that the user
 *    hasn't already seen.
 * 3. Rank by weighted interaction score and return top-K.
 *
 * All DB errors are caught and return [] — callers use withAiFallback() on top
 * so a DB failure just falls back to the score-based ranker.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'recommendations:collab-filter' });

// ── Tuning constants ──────────────────────────────────────────────────────────

const NEIGHBOURHOOD_SIZE  = 50;  // max co-actioners to pull
const CANDIDATE_LIMIT     = 200; // candidates fetched per neighbour batch
const LOOKBACK_DAYS       = 90;  // only consider interactions in last 90 days
const WEIGHTS = {
  CONNECTION_REQUEST: 3,
  PROFILE_SAVE:       2,
  PROFILE_VIEW:       1,
} as const;

type ActionWeight = keyof typeof WEIGHTS;

// ── Neighbourhood query ───────────────────────────────────────────────────────

interface NeighbourRow {
  neighbourId: string;
  sharedActions: bigint;
}

/**
 * Returns users who took similar positive actions (connect/save/view) on the
 * same profiles as `userId`. "Similar" = at least 1 shared target.
 */
async function findNeighbourhood(userId: string, since: Date): Promise<string[]> {
  // 1. Collect this user's positive-action targets
  const [myConnections, mySaved, myViews] = await Promise.all([
    prisma.connectionRequest.findMany({
      where:  { senderId: userId, createdAt: { gte: since } },
      select: { receiverId: true },
    }),
    prisma.savedProfile.findMany({
      where:  { userId, createdAt: { gte: since } },
      select: { savedUserId: true },
    }),
    prisma.profileView.findMany({
      where:  { viewerId: userId, viewedAt: { gte: since } },
      select: { viewedId: true },
    }),
  ]);

  const myTargets = new Set<string>([
    ...myConnections.map(c => c.receiverId),
    ...mySaved.map(s => s.savedUserId),
    ...myViews.map(v => v.viewedId),
  ]);

  if (myTargets.size === 0) return [];

  const targetList = [...myTargets];

  // 2. Find other users who acted on at least one of the same targets
  // We use raw counts to pick the most overlapping neighbours first
  const rows = await prisma.$queryRaw<NeighbourRow[]>`
    SELECT actor_id as "neighbourId", COUNT(*) as "sharedActions"
    FROM (
      SELECT sender_id    AS actor_id, receiver_id AS target_id FROM connection_requests
        WHERE receiver_id = ANY(${targetList}::uuid[]) AND sender_id != ${userId}
      UNION ALL
      SELECT user_id      AS actor_id, saved_user_id AS target_id FROM saved_profiles
        WHERE saved_user_id = ANY(${targetList}::uuid[]) AND user_id != ${userId}
      UNION ALL
      SELECT viewer_id    AS actor_id, viewed_id AS target_id FROM profile_views
        WHERE viewed_id = ANY(${targetList}::uuid[]) AND viewer_id != ${userId}
    ) AS combined
    WHERE actor_id != ${userId}
    GROUP BY actor_id
    ORDER BY "sharedActions" DESC
    LIMIT ${NEIGHBOURHOOD_SIZE}
  `;

  return rows.map(r => r.neighbourId);
}

// ── Candidate scoring ─────────────────────────────────────────────────────────

interface CandidateScore {
  userId: string;
  score:  number;
}

async function scoreCandidatesFromNeighbours(
  userId:        string,
  neighbours:    string[],
  excludeIds:    string[],
  since:         Date,
): Promise<CandidateScore[]> {
  const exclude = new Set([userId, ...excludeIds]);

  // Targets already interacted with by the querying user (don't re-surface)
  const [myConnections, mySaved, myViews] = await Promise.all([
    prisma.connectionRequest.findMany({ where: { senderId: userId }, select: { receiverId: true } }),
    prisma.savedProfile.findMany({ where: { userId }, select: { savedUserId: true } }),
    prisma.profileView.findMany({ where: { viewerId: userId, viewedAt: { gte: since } }, select: { viewedId: true } }),
  ]);

  myConnections.forEach(c => exclude.add(c.receiverId));
  mySaved.forEach(s => exclude.add(s.savedUserId));
  myViews.forEach(v => exclude.add(v.viewedId));

  // Gather neighbour interactions
  const [neighbourConnections, neighbourSaved, neighbourViews] = await Promise.all([
    prisma.connectionRequest.findMany({
      where:  { senderId: { in: neighbours }, createdAt: { gte: since } },
      select: { receiverId: true },
    }),
    prisma.savedProfile.findMany({
      where:  { userId: { in: neighbours }, createdAt: { gte: since } },
      select: { savedUserId: true },
    }),
    prisma.profileView.findMany({
      where:  { viewerId: { in: neighbours }, viewedAt: { gte: since } },
      select: { viewedId: true },
      take:   CANDIDATE_LIMIT,
    }),
  ]);

  const scoreMap = new Map<string, number>();

  const addScore = (targetId: string, action: ActionWeight) => {
    if (exclude.has(targetId)) return;
    scoreMap.set(targetId, (scoreMap.get(targetId) ?? 0) + WEIGHTS[action]);
  };

  neighbourConnections.forEach(c => addScore(c.receiverId,   'CONNECTION_REQUEST'));
  neighbourSaved.forEach(s =>       addScore(s.savedUserId,  'PROFILE_SAVE'));
  neighbourViews.forEach(v =>       addScore(v.viewedId,     'PROFILE_VIEW'));

  return [...scoreMap.entries()]
    .map(([id, score]) => ({ userId: id, score }))
    .sort((a, b) => b.score - a.score);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns up to `limit` userIds ranked by collaborative filtering score.
 * Returns [] on any error (safe for fire-and-forget / withAiFallback callers).
 */
export async function collaborativeFilter(
  userId:     string,
  limit       = 100,
  excludeIds: string[] = [],
): Promise<string[]> {
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000);

    const neighbours = await findNeighbourhood(userId, since);
    if (neighbours.length === 0) {
      log.info('collaborativeFilter — no neighbours found', { userId });
      return [];
    }

    const candidates = await scoreCandidatesFromNeighbours(userId, neighbours, excludeIds, since);
    log.info('collaborativeFilter — candidates scored', {
      userId,
      neighbours: neighbours.length,
      candidates: candidates.length,
    });

    return candidates.slice(0, limit).map(c => c.userId);
  } catch (err) {
    log.error('collaborativeFilter — error (returning [])', { userId, err });
    return [];
  }
}
