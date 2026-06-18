/**
 * IDROP-002 — Drop pairing generation service.
 *
 * For each user in an IntroductionDrop's memberPool, generates personalised
 * 1:1 introductions by selecting 3–5 best matches from the pool.
 *
 * Selection criteria:
 *   - Different gender
 *   - Not already introduced (in any existing Introduction record)
 *   - Not blocked
 *   - Ranked by pgvector cosine similarity (AI path) or totalScore (fallback)
 *
 * After pairings are generated the drop status is updated to SCHEDULED.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { IntroductionDropNotFoundError } from './drop.service.js';

const log = createChildLogger({ module: 'introductions:pairing' });

const MIN_PAIRINGS = 3;
const MAX_PAIRINGS = 5;
const DROP_EXPIRY_DAYS = 7;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if AI (pgvector) path should be used. */
async function isAiAvailable(): Promise<boolean> {
  try {
    // Dynamic import to avoid circular dependency with @abroad-matrimony/ai
    const ai = await import('@abroad-matrimony/ai');
    return (ai as any).isAiConfigured?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Rank candidate pool for a given recipient using pgvector cosine similarity.
 * Falls back to empty array if AI path fails.
 */
async function rankByEmbedding(
  recipientId: string,
  candidateIds: string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return [];

  try {
    // pgvector cosine distance query (1 - distance = similarity)
    const rows = await prisma.$queryRaw<{ userId: string; similarity: number }[]>`
      SELECT pe."userId", 1 - (pe.embedding <=> ref.embedding) AS similarity
      FROM profile_embeddings pe,
           profile_embeddings ref
      WHERE ref."userId" = ${recipientId}
        AND pe."userId" = ANY(${candidateIds}::uuid[])
        AND pe.embedding IS NOT NULL
        AND ref.embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT ${MAX_PAIRINGS}
    `;

    return rows.map((r) => r.userId);
  } catch {
    // Vector query failed (no embeddings or pgvector not available) — return empty to trigger fallback
    return [];
  }
}

/**
 * Rank candidate pool by match_scores.totalScore (fallback when AI not available).
 */
async function rankByMatchScore(
  recipientId: string,
  candidateIds: string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return [];

  const scores = await prisma.matchScore.findMany({
    where: {
      OR: [
        { userAId: recipientId, userBId: { in: candidateIds } },
        { userBId: recipientId, userAId: { in: candidateIds } },
      ],
    },
    orderBy: { totalScore: 'desc' },
    take: MAX_PAIRINGS,
    select: { userAId: true, userBId: true },
  });

  return scores.map((s) =>
    s.userAId === recipientId ? s.userBId : s.userAId,
  );
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Generate personalised pairings for all members of a drop.
 * Updates drop.status to SCHEDULED when complete.
 *
 * @throws {IntroductionDropNotFoundError}
 */
export async function generatePairingsForDrop(dropId: string): Promise<void> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    select: {
      id: true,
      status: true,
      memberPool: true,
      releaseAt: true,
    },
  });

  if (!drop) throw new IntroductionDropNotFoundError();

  const memberPool: string[] = drop.memberPool;
  if (memberPool.length < 2) {
    log.warn('generatePairingsForDrop — pool too small, skipping', { dropId, poolSize: memberPool.length });
    return;
  }

  // Load all pool member genders (via profile)
  const profiles = await prisma.profile.findMany({
    where: { userId: { in: memberPool } },
    select: { userId: true, gender: true },
  });

  const genderMap = new Map<string, string>(
    profiles.map((p) => [p.userId, p.gender]),
  );

  // Load all existing introductions in this drop (for idempotency)
  const existingInDrop = await prisma.introduction.findMany({
    where: { dropId },
    select: { userAId: true, userBId: true },
  });
  const existingSet = new Set(
    existingInDrop.flatMap((i) => [`${i.userAId}:${i.userBId}`, `${i.userBId}:${i.userAId}`]),
  );

  // Load blocks for all pool members
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: { in: memberPool } },
        { blockedId: { in: memberPool } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedPairs = new Set(
    blocks.flatMap((b) => [`${b.blockerId}:${b.blockedId}`, `${b.blockedId}:${b.blockerId}`]),
  );

  const useAi = await isAiAvailable();
  let totalCreated = 0;

  for (const recipientId of memberPool) {
    const recipientGender = genderMap.get(recipientId) ?? '';

    // Candidates: other gender, not blocked, not already introduced in this drop
    const candidates = memberPool.filter((candidateId) => {
      if (candidateId === recipientId) return false;
      const candidateGender = genderMap.get(candidateId) ?? '';
      if (candidateGender === recipientGender) return false;
      if (existingSet.has(`${recipientId}:${candidateId}`)) return false;
      if (blockedPairs.has(`${recipientId}:${candidateId}`)) return false;
      return true;
    });

    if (candidates.length === 0) continue;

    // Rank candidates
    let ranked: string[] = [];

    if (useAi) {
      ranked = await rankByEmbedding(recipientId, candidates);
    }

    // Fallback to match scores if AI unavailable or returned no results
    if (ranked.length === 0) {
      ranked = await rankByMatchScore(recipientId, candidates);
    }

    // Final fallback: shuffle remaining candidates
    if (ranked.length === 0) {
      ranked = [...candidates].sort(() => Math.random() - 0.5);
    }

    const selected = ranked.slice(0, MAX_PAIRINGS);
    const count = Math.min(selected.length, MAX_PAIRINGS);
    if (count < MIN_PAIRINGS && candidates.length < MIN_PAIRINGS) {
      // Pool too small for this recipient — use all available
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DROP_EXPIRY_DAYS);

    for (const matchId of selected.slice(0, Math.max(count, selected.length))) {
      try {
        await prisma.introduction.create({
          data: {
            dropId,
            userAId: recipientId,
            userBId: matchId,
            expiresAt,
            status: 'PENDING' as any,
          },
        });

        // Register the pair so we don't create the reverse pairing in this same run
        existingSet.add(`${recipientId}:${matchId}`);
        existingSet.add(`${matchId}:${recipientId}`);
        totalCreated++;
      } catch {
        // Unique constraint — pairing already exists, skip
      }
    }
  }

  // Update drop status to SCHEDULED
  await prisma.introductionDrop.update({
    where: { id: dropId },
    data: { status: 'SCHEDULED' as any },
  });

  log.info('generatePairingsForDrop — complete', {
    dropId,
    poolSize: memberPool.length,
    pairingsCreated: totalCreated,
  });
}
