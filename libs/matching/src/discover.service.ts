import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { UserRole, MediaType } from '@abroad-matrimony/shared';
import type { DiscoveryFeedDto, DiscoveryItemDto, ScoreBreakdown, VerificationStatus } from '@abroad-matrimony/shared';
import { ALGORITHM_VERSION } from './match-score.service.js';
import { getMatchTuning } from './match-tuning.service.js';
import { applyTuningToBreakdown } from './scoring.service.js';
import { getPartnerPreferences } from './partner-preferences.service.js';
import { withAiFallback, getSemanticallySimilarUsers, mergeWithWeightedRRF } from '@abroad-matrimony/ai';
import { collaborativeFilter } from '@abroad-matrimony/recommendations';
import { logDiscoveryFeedGenerated } from '@abroad-matrimony/decision-log';

// ── MMR diversity reranking ────────────────────────────────────────────────────

/**
 * λ for Maximal Marginal Relevance.
 * 0.7 → 70 % relevance, 30 % diversity.
 */
const MMR_LAMBDA = 0.7;

/** Euclidean distance in 5-dim vibe space. */
function vibeDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((acc, v, i) => acc + (v - (b[i] ?? 5)) ** 2, 0));
}

/**
 * Greedy MMR reranking.
 * Items without vibe embeddings are treated as having zero similarity to all
 * selected items (i.e. they get full relevance credit and join the output in
 * their original personalizedScore order relative to each other).
 *
 * Degrades to the original list when vibeMap has fewer than 2 entries.
 */
export function mmrRerank(
  items: DiscoveryItemDto[],
  vibeMap: Map<string, number[]>,
  lambda = MMR_LAMBDA,
): DiscoveryItemDto[] {
  if (vibeMap.size < 2 || items.length < 2) return items;

  const remaining  = [...items];
  const selected: DiscoveryItemDto[] = [];

  while (remaining.length > 0) {
    let bestIdx   = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item      = remaining[i]!;
      const vibe      = vibeMap.get(item.userId);
      const relevance = item.personalizedScore;

      let maxSim = 0;
      if (vibe && selected.length > 0) {
        for (const sel of selected) {
          const selVibe = vibeMap.get(sel.userId);
          if (selVibe) {
            const dist = vibeDistance(vibe, selVibe);
            const sim  = 1 / (1 + dist);   // normalized to (0, 1]
            if (sim > maxSim) maxSim = sim;
          }
        }
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx   = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return selected;
}

// ── pgvector ANN config ────────────────────────────────────────────────────────

/**
 * When a user has fewer stored MatchScore rows than this threshold (e.g. new
 * user, or after a flush), fall back to live pgvector ANN similarity.
 */
const ANN_THRESHOLD = 10;

interface AnnRow {
  user_id: string;
  similarity: number; // cosine similarity 0–1
}

const log = createChildLogger({ module: 'matching:discover' });

// ── Cursor helpers ─────────────────────────────────────────────────────────────

interface CursorData {
  score: number;
  id: string;
}

/**
 * Encodes a cursor as a base64url JSON blob.
 * Uses composite (score, id) so pagination is stable when multiple rows share
 * the same totalScore.
 */
export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decodes a cursor produced by `encodeCursor`.
 * Returns `null` for any malformed input — caller should treat as "no cursor".
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'score' in parsed &&
      'id' in parsed &&
      typeof (parsed as CursorData).score === 'number' &&
      typeof (parsed as CursorData).id === 'string'
    ) {
      return parsed as CursorData;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Age helper ─────────────────────────────────────────────────────────────────

/**
 * Returns whole years elapsed since `dob`.
 * Exported for unit tests.
 */
export function computeAge(dob: Date, now = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface DiscoverOptions {
  /** base64url-encoded cursor from a previous response */
  cursor?: string;
  /** Number of items to return (default: 20) */
  limit?: number;
  /** Algorithm version to filter by (default: ALGORITHM_VERSION 'v1') */
  algorithmVersion?: string;
}

/**
 * Returns a paginated discovery feed for `userId`.
 *
 * Ordering: highest compatibility score first (stable via composite sort on
 * `totalScore DESC, id ASC`).
 *
 * Filters applied:
 * - Excludes suspended users
 * - Excludes users already connected (any status) to avoid showing
 *   pending/accepted connections in the feed
 *
 * @param userId          - The requesting user
 * @param options         - Pagination + algorithm version
 * @returns               - Items + nextCursor for the next page
 */
export async function getDiscoveryFeed(
  userId: string,
  options: DiscoverOptions = {},
): Promise<DiscoveryFeedDto> {
  const {
    limit = 20,
    algorithmVersion = ALGORITHM_VERSION,
  } = options;

  const cursorData = options.cursor ? decodeCursor(options.cursor) : null;

  // ── 1. Fetch score rows (keyset pagination on totalScore DESC, id ASC) ───────
  const scoreRows = await prisma.matchScore.findMany({
    where: {
      AND: [
        { OR: [{ userAId: userId }, { userBId: userId }] },
        { algorithmV: algorithmVersion },
        ...(cursorData
          ? [
              {
                OR: [
                  { totalScore: { lt: cursorData.score } },
                  {
                    AND: [
                      { totalScore: cursorData.score },
                      { id: { gt: cursorData.id } },
                    ],
                  },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ totalScore: 'desc' }, { id: 'asc' }],
    take: limit + 1,          // fetch one extra to detect hasMore
    select: {
      id:         true,
      userAId:    true,
      userBId:    true,
      totalScore: true,
      breakdown:  true,
    },
  });

  // ── 1b. ANN cold-start fallback — runs when stored scores are sparse ──────────
  // For new users (or post-flush), MatchScore rows may not exist yet.
  // Query profile_embeddings via pgvector cosine similarity as a live fallback.
  // Results are merged with any existing score rows; scored rows take priority.
  const annScoreMap = new Map<string, number>(); // userId → hybrid totalScore
  if (!cursorData && scoreRows.length < ANN_THRESHOLD) {
    try {
      const annRows = await prisma.$queryRaw<AnnRow[]>`
        SELECT pe.user_id,
               1 - (pe.embedding <=> (
                 SELECT embedding FROM profile_embeddings WHERE user_id = ${userId}
               )) AS similarity
        FROM profile_embeddings pe
        WHERE pe.user_id != ${userId}
          AND pe.embedding IS NOT NULL
          AND (SELECT embedding FROM profile_embeddings WHERE user_id = ${userId}) IS NOT NULL
        ORDER BY pe.embedding <=> (
          SELECT embedding FROM profile_embeddings WHERE user_id = ${userId}
        )
        LIMIT ${limit * 3}
      `;

      const existingScoredIds = new Set(
        scoreRows.map(r => (r.userAId === userId ? r.userBId : r.userAId)),
      );

      for (const row of annRows) {
        if (existingScoredIds.has(row.user_id)) continue;
        // Similarity is 0–1; scale to 0–100 for a hybrid totalScore
        const semanticScore = Math.round(Number(row.similarity) * 100);
        annScoreMap.set(row.user_id, semanticScore);
      }

      log.info('ANN cold-start fallback used', {
        userId,
        existingScoreCount: scoreRows.length,
        annCandidates: annScoreMap.size,
      });
    } catch (err) {
      // Embedding may not exist yet for this user — degrade gracefully
      log.warn('ANN cold-start query failed (no embedding?)', { userId, err });
    }
  }

  // ── 1c. RRF fusion — 4 rankers blended by weighted RRF ───────────────────────
  // Runs on first-page requests for established users (>= ANN_THRESHOLD scores).
  // Cold-start path (1b) and RRF path (1c) are mutually exclusive.
  //
  // Rankers + weights:
  //   1. Score-based ranking   weight 0.50 (stored MatchScore)
  //   2. Semantic (3-vector)   weight 0.25 (pgvector ANN)
  //   3. Collaborative filter  weight 0.25 (co-interaction neighbourhood)
  //
  // withAiFallback wraps each AI call independently — failure in any one ranker
  // gracefully drops it from the blend without affecting the others.
  let rrfFusedIds: string[] | null = null;
  if (!cursorData && scoreRows.length >= ANN_THRESHOLD) {
    const scoreRankedIds = scoreRows.map(r => (r.userAId === userId ? r.userBId : r.userAId));

    const [semanticIds, collabIds] = await Promise.all([
      withAiFallback<string[]>({
        name:      'semantic-search',
        context:   { userId },
        timeoutMs: 3_000,
        primary:   () => getSemanticallySimilarUsers(userId, 200, []),
        fallback:  () => [],
      }),
      withAiFallback<string[]>({
        name:      'collaborative-filter',
        context:   { userId },
        timeoutMs: 3_000,
        primary:   () => collaborativeFilter(userId, 200, []),
        fallback:  () => [],
      }),
    ]);

    const lists:   string[][] = [scoreRankedIds];
    const weights: number[]   = [0.50];

    if (semanticIds.length > 0) { lists.push(semanticIds); weights.push(0.25); }
    if (collabIds.length > 0)   { lists.push(collabIds);   weights.push(0.25); }

    if (lists.length > 1) {
      rrfFusedIds = mergeWithWeightedRRF(lists, weights);

      // Surface AI-only candidates with rank-derived proxy scores so the DTO
      // builder doesn't skip them (they have no stored MatchScore).
      const scoredSet    = new Set(scoreRankedIds);
      const aiCandidates = [...new Set([...semanticIds, ...collabIds])];
      for (let i = 0; i < aiCandidates.length; i++) {
        const id = aiCandidates[i];
        if (!scoredSet.has(id) && !annScoreMap.has(id)) {
          annScoreMap.set(id, Math.max(40, Math.round(85 - i * 0.45)));
        }
      }

      log.info('RRF fusion applied', {
        userId,
        scoreRankedCount: scoreRankedIds.length,
        semanticCount:    semanticIds.length,
        collabCount:      collabIds.length,
        fusedCount:       rrfFusedIds.length,
      });
    }
  }

  const hasMore = scoreRows.length > limit;
  const rows    = hasMore ? scoreRows.slice(0, limit) : scoreRows;

  // If no stored scores AND no ANN candidates, return empty
  if (rows.length === 0 && annScoreMap.size === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // ── 2. Resolve the "other" user ID in each score pair + ANN candidates ───────
  const scoredOtherIds = rows.map(r => (r.userAId === userId ? r.userBId : r.userAId));
  // annCandidateIds: populated by cold-start (1b) XOR semantic-only by RRF (1c).
  // The two paths are mutually exclusive (cold-start runs only when < ANN_THRESHOLD).
  const annCandidateIds = [...annScoreMap.keys()];
  // If RRF ran, use its fused ordering (semantic + score blended); otherwise fall
  // back to score-first order with ANN cold-start candidates appended.
  const otherUserIds = rrfFusedIds && rrfFusedIds.length > 0
    ? [...new Set([...rrfFusedIds, ...annCandidateIds])]
    : [...new Set([...scoredOtherIds, ...annCandidateIds])];

  // ── 3. Batch-fetch roles — filter out suspended users ─────────────────────
  const users = await prisma.user.findMany({
    where:  { id: { in: otherUserIds } },
    select: { id: true, role: true },
  });
  const activeUserIds = new Set(
    users
      .filter(u => u.role !== UserRole.SUSPENDED)
      .map(u => u.id),
  );

  // ── 4. Batch-fetch connections — filter out already-connected users ────────
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { senderId: userId,   receiverId: { in: otherUserIds } },
        { senderId: { in: otherUserIds }, receiverId: userId },
      ],
    },
    select: { senderId: true, receiverId: true },
  });
  const connectedUserIds = new Set(
    connections.map(c => (c.senderId === userId ? c.receiverId : c.senderId)),
  );

  // ── 5. Final eligible user IDs (preserves score order) ────────────────────
  const eligibleIds = otherUserIds.filter(
    id => activeUserIds.has(id) && !connectedUserIds.has(id),
  );

  if (eligibleIds.length === 0) {
    const lastRow    = rows[rows.length - 1];
    const nextCursor = hasMore
      ? encodeCursor({ score: lastRow.totalScore, id: lastRow.id })
      : null;
    return { items: [], nextCursor, hasMore };
  }

  // ── 6. Apply partner preference pre-filter (PROD-006) ─────────────────────
  // Fetch the requesting user's preferences and build the where clause.
  // We resolve preferences AND profiles in parallel to reduce latency.
  const partnerPrefs = await getPartnerPreferences(userId);
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileWhere: any = {
    userId: { in: eligibleIds },
    ...(partnerPrefs.ageMin !== null || partnerPrefs.ageMax !== null
      ? {
          dateOfBirth: {
            // ageMax → born at least ageMax years ago → dateOfBirth <= cutoff
            ...(partnerPrefs.ageMax !== null
              ? { gte: new Date(now.getFullYear() - partnerPrefs.ageMax, now.getMonth(), now.getDate()) }
              : {}),
            // ageMin → born no more than ageMin years ago → dateOfBirth >= cutoff
            ...(partnerPrefs.ageMin !== null
              ? { lte: new Date(now.getFullYear() - partnerPrefs.ageMin, now.getMonth(), now.getDate()) }
              : {}),
          },
        }
      : {}),
    ...(partnerPrefs.countries.length > 0 ? { currentCountry: { in: partnerPrefs.countries } } : {}),
    ...(partnerPrefs.cities.length > 0    ? { currentCity:    { in: partnerPrefs.cities } }    : {}),
    // religions filter requires a join to RealLifeAnswer — deferred to future enhancement
  };

  // ── 7. Batch-fetch profiles ────────────────────────────────────────────────
  const profiles = await prisma.profile.findMany({
    where: profileWhere,
    select: {
      userId:            true,
      name:              true,
      dateOfBirth:       true,
      currentCity:       true,
      currentCountry:    true,
      settlementIntent:  true,
      completionScore:   true,
      verificationStatus: true,
    },
  });
  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  // ── 8. Batch-fetch first photo per eligible user ───────────────────────────
  const photos = await prisma.media.findMany({
    where:   { userId: { in: eligibleIds }, type: MediaType.PHOTO },
    orderBy: [{ userId: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    select:  { userId: true, url: true, order: true },
  });
  const photoMap = new Map<string, string>();
  for (const photo of photos) {
    if (!photoMap.has(photo.userId)) {
      photoMap.set(photo.userId, photo.url);
    }
  }

  // ── 9. Fetch tuning weights + vibe embeddings in parallel ────────────────────
  const [tuning, vibeRows] = await Promise.all([
    getMatchTuning(userId),
    prisma.profileEmbedding.findMany({
      where:  { userId: { in: eligibleIds } },
      select: { userId: true, vibeScores: true },
    }),
  ]);
  const hasTuning = Object.keys(tuning.weights).length > 0;
  const vibeMap   = new Map<string, number[]>(
    vibeRows
      .filter(r => Array.isArray(r.vibeScores))
      .map(r => [r.userId, r.vibeScores as number[]]),
  );

  // ── 10. Assemble DTOs, apply tuning, and sort by personalizedScore ────────
  const scoredRowMap = new Map(
    rows.map(r => [r.userAId === userId ? r.userBId : r.userAId, r]),
  );

  const items: DiscoveryItemDto[] = [];

  for (const otherId of eligibleIds) {
    const profile = profileMap.get(otherId);
    if (!profile) continue;

    const scoredRow = scoredRowMap.get(otherId);
    const annScore  = annScoreMap.get(otherId);

    let totalScore: number;
    let breakdown: ScoreBreakdown;

    if (scoredRow) {
      // Full stored score — use as-is
      totalScore = scoredRow.totalScore;
      breakdown  = scoredRow.breakdown as unknown as ScoreBreakdown;
    } else if (annScore !== undefined) {
      // ANN-only: semantic similarity is the proxy score
      totalScore = annScore;
      // Empty breakdown signals this is a semantic-only result
      breakdown  = {} as ScoreBreakdown;
    } else {
      continue;
    }

    const personalizedScore = hasTuning && scoredRow
      ? applyTuningToBreakdown(breakdown, tuning.weights)
      : totalScore;

    items.push({
      userId:            otherId,
      name:              profile.name,
      age:               computeAge(profile.dateOfBirth),
      currentCity:       profile.currentCity,
      currentCountry:    profile.currentCountry,
      settlementIntent:  profile.settlementIntent,
      completionScore:   profile.completionScore,
      verificationStatus: profile.verificationStatus as unknown as VerificationStatus,
      photoUrl:          photoMap.get(otherId),
      totalScore,
      personalizedScore,
      scoreBreakdown:    breakdown,
    });
  }

  // Re-sort by personalizedScore (tuning active) or totalScore (ANN mixed in)
  if (hasTuning || annScoreMap.size > 0) {
    items.sort((a, b) => b.personalizedScore - a.personalizedScore);
  }

  // ── 11. MMR diversity reranking ───────────────────────────────────────────────
  // Balances relevance (personalizedScore) against vibe-space diversity.
  // Degrades gracefully when fewer than 2 users have vibe embeddings.
  const finalItems = mmrRerank(items, vibeMap);

  log.info('MMR reranking applied', {
    userId,
    candidateCount:  items.length,
    vibeMapSize:     vibeMap.size,
    rerankedCount:   finalItems.length,
  });

  // Cursor only makes sense for stored score rows (ANN results are first-page only)
  const lastScoredRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const nextCursor = hasMore && lastScoredRow
    ? encodeCursor({ score: lastScoredRow.totalScore, id: lastScoredRow.id })
    : null;

  log.info('Discovery feed fetched', {
    userId,
    algorithmVersion,
    itemCount: finalItems.length,
    hasMore,
  });

  // Decision log — fire-and-forget, never blocks the caller
  logDiscoveryFeedGenerated({
    userId,
    candidateCount:      items.length,
    finalCount:          finalItems.length,
    rrfActive:           rrfFusedIds !== null,
    annColdStart:        annScoreMap.size > 0 && rrfFusedIds === null,
    collaborativeActive: rrfFusedIds !== null,
    mmrActive:           vibeMap.size >= 2,
    cursorUsed:          options.cursor != null,
    topScores:           finalItems.slice(0, 5).map(i => i.personalizedScore),
  });

  return { items: finalItems, nextCursor, hasMore };
}
