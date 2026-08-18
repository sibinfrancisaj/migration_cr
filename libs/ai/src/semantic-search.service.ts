import { prisma } from '@abroad-matrimony/db';

interface AnnRow {
  user_id: string;
}

// ── Single-vector ANN ─────────────────────────────────────────────────────────

async function annByColumn(
  sourceVector: unknown,
  userId: string,
  limit: number,
  excludeIds: string[],
  column: 'embedding' | '"storyEmbedding"' | '"habitsEmbedding"',
): Promise<string[]> {
  const exclude = [userId, ...excludeIds];
  const rows = await prisma.$queryRawUnsafe<AnnRow[]>(
    `SELECT pe.user_id
     FROM   profile_embeddings pe
     WHERE  pe.user_id != ALL($1::uuid[])
       AND  pe.${column} IS NOT NULL
     ORDER  BY pe.${column} <=> $2::vector
     LIMIT  $3`,
    exclude,
    `[${(sourceVector as number[]).join(',')}]`,
    limit,
  );
  return rows.map(r => r.user_id);
}

// ── Multi-vector embedding fetch ──────────────────────────────────────────────

interface EmbeddingRow {
  embedding:       unknown;
  storyEmbedding:  unknown;
  habitsEmbedding: unknown;
}

async function fetchUserVectors(userId: string): Promise<EmbeddingRow | null> {
  const rows = await prisma.$queryRaw<EmbeddingRow[]>`
    SELECT embedding, "storyEmbedding", "habitsEmbedding"
    FROM   profile_embeddings
    WHERE  user_id = ${userId}
    LIMIT  1
  `;
  return rows[0] ?? null;
}

// ── Weighted RRF (3 rankers) ──────────────────────────────────────────────────

/**
 * Merge up to 3 ranked lists with per-list weights via weighted RRF.
 * weight[i] defaults to 1.0 if omitted.
 * RRF score(d) = Σ weight_i / (k + rank_i(d))
 */
export function mergeWithWeightedRRF(
  lists: string[][],
  weights: number[] = [],
  k = 60,
): string[] {
  const w = lists.map((_, i) => weights[i] ?? 1.0);
  const rankMaps = lists.map(l => new Map(l.map((id, i) => [id, i])));
  const all = [...new Set(lists.flat())];

  return all.sort((a, b) => {
    const score = (id: string) =>
      rankMaps.reduce((acc, rm, i) =>
        rm.has(id) ? acc + w[i]! / (k + rm.get(id)!) : acc, 0);
    return score(b) - score(a);
  });
}

/**
 * Merges two ranked lists via equal-weight RRF.
 * Kept for backwards compatibility with existing callers in discover.service.ts.
 */
export function mergeWithRRF(
  scoreRanked: string[],
  semanticRanked: string[],
  k = 60,
): string[] {
  return mergeWithWeightedRRF([scoreRanked, semanticRanked], [1, 1], k);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns up to `limit` userIds ordered by cosine similarity, blending 3
 * embedding vectors via weighted RRF:
 *   - personality embedding  weight 0.50
 *   - story embedding        weight 0.25
 *   - habits embedding       weight 0.25
 *
 * Degrades gracefully: if only personality embedding exists (Phase C not yet
 * pushed), falls back to single-vector search.
 *
 * Returns [] when userId has no embedding — caller treats as no-op.
 */
export async function getSemanticallySimilarUsers(
  userId: string,
  limit = 100,
  excludeIds: string[] = [],
): Promise<string[]> {
  const src = await fetchUserVectors(userId);
  if (!src?.embedding) return [];

  const personalityVec = src.embedding as number[];
  const storyVec       = src.storyEmbedding as number[] | null;
  const habitsVec      = src.habitsEmbedding as number[] | null;

  const perLimit = limit * 2; // over-fetch so RRF has material to work with

  if (!storyVec && !habitsVec) {
    // Phase C not yet deployed — single-vector path
    return annByColumn(personalityVec, userId, limit, excludeIds, 'embedding');
  }

  // Phase C path — 3 parallel ANN queries blended by weighted RRF
  const tasks: Promise<string[]>[] = [
    annByColumn(personalityVec, userId, perLimit, excludeIds, 'embedding'),
  ];
  const weights = [0.5];

  if (storyVec) {
    tasks.push(annByColumn(storyVec, userId, perLimit, excludeIds, '"storyEmbedding"'));
    weights.push(0.25);
  }
  if (habitsVec) {
    tasks.push(annByColumn(habitsVec, userId, perLimit, excludeIds, '"habitsEmbedding"'));
    weights.push(0.25);
  }

  const results = await Promise.all(tasks);
  return mergeWithWeightedRRF(results, weights).slice(0, limit);
}
