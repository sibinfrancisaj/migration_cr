/**
 * ADMIN-016 — AI / ProfileEmbedding monitoring service.
 * Embedding status, stale profiles, queue health, trigger recomputation.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { enqueueProfileIntelligence } from './enqueue-intelligence.js';
import { getEnv } from '@abroad-matrimony/config';

const log = createChildLogger({ module: 'ai:monitoring' });
const STALE_DAYS = 7;

export class UserEmbeddingNotFoundError extends Error {
  constructor() { super('USER_EMBEDDING_NOT_FOUND'); this.name = 'UserEmbeddingNotFoundError'; }
}

export interface EmbeddingStatusDto {
  totalUsers: number;
  withEmbedding: number;
  pendingEmbedding: number;   // missing or stale (> STALE_DAYS days)
  staleCutoffDate: string;
}

export interface EmbeddingUserDto {
  userId: string;
  name: string | null;
  summary: string | null;
  traitTagCount: number;
  vibeScoresPresent: boolean;
  embeddingPresent: boolean;
  updatedAt: string | null;
}

export interface EmbeddingListParams {
  status?: 'complete' | 'pending' | 'stale';
  limit?: number;
  cursor?: string;
}

// ─── getEmbeddingStatus ──────────────────────────────────────────────────────

export async function getEmbeddingStatus(): Promise<EmbeddingStatusDto> {
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);

  const [totalUsers, withEmbedding, staleOrMissing] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.profileEmbedding.count(),
    prisma.user.count({
      where: {
        deletedAt: null,
        OR: [
          { profileEmbedding: null },
          { profileEmbedding: { updatedAt: { lt: staleCutoff } } },
        ],
      },
    }),
  ]);

  return {
    totalUsers,
    withEmbedding,
    pendingEmbedding: staleOrMissing,
    staleCutoffDate: staleCutoff.toISOString(),
  };
}

// ─── listEmbeddings ──────────────────────────────────────────────────────────

export async function listEmbeddings(params: EmbeddingListParams): Promise<{
  items: EmbeddingUserDto[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const limit = Math.min(params.limit ?? 20, 100);
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);

  const statusFilter = (() => {
    if (params.status === 'complete') return { profileEmbedding: { updatedAt: { gte: staleCutoff } } };
    if (params.status === 'pending')  return { profileEmbedding: null };
    if (params.status === 'stale')    return { profileEmbedding: { updatedAt: { lt: staleCutoff } } };
    return {};
  })();

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(params.cursor ? { id: { gt: params.cursor } } : {}),
      ...statusFilter,
    },
    select: {
      id: true,
      profile: { select: { name: true } },
      profileEmbedding: {
        select: { summary: true, traitTags: true, vibeScores: true, embedding: true, updatedAt: true },
      },
    },
    orderBy: { id: 'asc' },
    take: limit + 1,
  });

  const hasMore = users.length > limit;
  const page = users.slice(0, limit);

  return {
    items: page.map((u) => ({
      userId: u.id,
      name: u.profile?.name ?? null,
      summary: (u.profileEmbedding?.summary as string | null) ?? null,
      traitTagCount: Array.isArray(u.profileEmbedding?.traitTags)
        ? (u.profileEmbedding!.traitTags as unknown[]).length
        : 0,
      vibeScoresPresent: u.profileEmbedding?.vibeScores != null,
      embeddingPresent:  u.profileEmbedding?.embedding != null,
      updatedAt: u.profileEmbedding?.updatedAt?.toISOString() ?? null,
    })),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ─── recomputeEmbedding ──────────────────────────────────────────────────────

export async function recomputeEmbedding(
  userId: string,
): Promise<{ jobId: string; queued: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new UserEmbeddingNotFoundError();

  const env = getEnv();
  await enqueueProfileIntelligence(userId, env.REDIS_URL);

  const jobId = `pi:${userId}`;
  log.info('Profile intelligence recompute enqueued', { userId, jobId });
  return { jobId, queued: true };
}

// ─── recomputeAllStaleEmbeddings ─────────────────────────────────────────────

export async function recomputeAllStaleEmbeddings(): Promise<{ jobsQueued: number }> {
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);
  const env = getEnv();

  const staleUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { profileEmbedding: null },
        { profileEmbedding: { updatedAt: { lt: staleCutoff } } },
      ],
    },
    select: { id: true },
    take: 1000,  // cap bulk runs
  });

  let queued = 0;
  for (const u of staleUsers) {
    try {
      await enqueueProfileIntelligence(u.id, env.REDIS_URL);
      queued++;
    } catch {
      log.warn('Failed to enqueue recompute for user', { userId: u.id });
    }
  }

  log.info('Bulk stale embedding recompute enqueued', { queued, total: staleUsers.length });
  return { jobsQueued: queued };
}
