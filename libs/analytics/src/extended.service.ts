/**
 * ADMIN-017 — Extended analytics for Phase 8 features.
 * Group activity, drop engagement, AI pipeline health, diamond breakdown.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'analytics:extended' });

export interface PeriodParams { from?: string; to?: string; }

function dateRange(from?: string, to?: string) {
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  };
}

// ─── getGroupAnalytics ───────────────────────────────────────────────────────

export interface GroupAnalyticsDto {
  period: { from: string; to: string };
  newGroupsByType: Record<string, number>;
  totalMembersByType: Record<string, number>;
  postCount: number;
  commentCount: number;
  likeCount: number;
  joinFunnelBySource: Record<string, number>;
  topActiveGroups: Array<{ groupId: string; name: string; postCount: number }>;
}

export async function getGroupAnalytics(params: PeriodParams): Promise<GroupAnalyticsDto> {
  const range = dateRange(params.from, params.to);
  const from = params.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to   = params.to   ?? new Date().toISOString();

  const [newGroups, postCount, commentCount, likeCount, joinsBySource, topGroups] = await Promise.all([
    prisma.group.groupBy({ by: ['type'], where: { createdAt: range }, _count: { id: true } }),
    prisma.groupPost.count({ where: { createdAt: range } }),
    prisma.groupPostComment.count({ where: { createdAt: range } }),
    prisma.groupPostLike.count({ where: { createdAt: range } }),
    prisma.groupMember.groupBy({ by: ['joinedVia'], where: { joinedAt: range }, _count: { id: true } }),
    prisma.groupPost.groupBy({
      by: ['groupId'],
      where: { createdAt: range },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  // Fetch names for top groups
  const topGroupIds = topGroups.map((g) => g.groupId);
  const groupNames = topGroupIds.length
    ? await prisma.group.findMany({
        where: { id: { in: topGroupIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(groupNames.map((g) => [g.id, g.name]));

  // Member counts by type
  const membersByType = await prisma.group.findMany({
    select: { type: true, _count: { select: { members: true } } },
  });
  const membersByTypeMap: Record<string, number> = {};
  for (const g of membersByType) {
    const t = g.type as string;
    membersByTypeMap[t] = (membersByTypeMap[t] ?? 0) + g._count.members;
  }

  log.info('Group analytics computed', { from, to });

  return {
    period: { from, to },
    newGroupsByType: Object.fromEntries(newGroups.map((g) => [g.type as string, g._count.id])),
    totalMembersByType: membersByTypeMap,
    postCount,
    commentCount,
    likeCount,
    joinFunnelBySource: Object.fromEntries(joinsBySource.map((j) => [j.joinedVia as string, j._count.id])),
    topActiveGroups: topGroups.map((g) => ({
      groupId: g.groupId,
      name: nameMap.get(g.groupId) ?? '',
      postCount: g._count.id,
    })),
  };
}

// ─── getDropAnalytics ────────────────────────────────────────────────────────

export interface DropAnalyticsDto {
  period: { from: string; to: string };
  dropsByStatus: Record<string, number>;
  aiProposedCount: number;
  adminCreatedCount: number;
  avgPoolSize: number;
  avgPairingsPerDrop: number;
  earlyAccessViews: number;
  earlyAccessUnlocks: number;
  earlyAccessDiamondsPaise: number;
  unlockDiamondsPaise: number;
  introAcceptRate: string;
  introDeclineRate: string;
}

export async function getDropAnalytics(params: PeriodParams): Promise<DropAnalyticsDto> {
  const range = dateRange(params.from, params.to);
  const from = params.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to   = params.to   ?? new Date().toISOString();

  const [dropsByStatus, drops, intros, earlyAccessSpend, unlockSpend] = await Promise.all([
    prisma.introductionDrop.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.introductionDrop.findMany({
      where: { createdAt: range },
      select: { memberPool: true, _count: { select: { introductions: true } } },
    }),
    prisma.introduction.groupBy({ by: ['status'], where: { createdAt: range }, _count: { id: true } }),
    prisma.diamondLedger.aggregate({
      _sum: { delta: true },
      where: { reason: 'INTRO_EARLY_VIEW' as never, createdAt: range },
    }),
    prisma.diamondLedger.aggregate({
      _sum: { delta: true },
      where: { reason: 'INTRO_EARLY_UNLOCK' as never, createdAt: range },
    }),
  ]);

  const earlyViews = await prisma.introduction.count({ where: { viewedEarlyAt: { not: null }, createdAt: range } });
  const earlyUnlocks = await prisma.introduction.count({ where: { unlockedEarlyAt: { not: null }, createdAt: range } });

  const totalIntros = intros.reduce((s, i) => s + i._count.id, 0);
  const acceptedCount = intros.find((i) => i.status === 'ACCEPTED')?._count.id ?? 0;
  const declinedCount = intros.find((i) => i.status === 'DECLINED')?._count.id ?? 0;

  const avgPool = drops.length
    ? drops.reduce((s, d) => s + d.memberPool.length, 0) / drops.length
    : 0;
  const avgPairings = drops.length
    ? drops.reduce((s, d) => s + d._count.introductions, 0) / drops.length
    : 0;

  log.info('Drop analytics computed', { from, to });

  return {
    period: { from, to },
    dropsByStatus: Object.fromEntries(dropsByStatus.map((d) => [d.status as string, d._count.id])),
    aiProposedCount: 0,   // proposedByAI field not in current schema — placeholder
    adminCreatedCount: drops.length,
    avgPoolSize: Number(avgPool.toFixed(1)),
    avgPairingsPerDrop: Number(avgPairings.toFixed(1)),
    earlyAccessViews: earlyViews,
    earlyAccessUnlocks: earlyUnlocks,
    earlyAccessDiamondsPaise: Math.abs(earlyAccessSpend._sum.delta ?? 0),
    unlockDiamondsPaise: Math.abs(unlockSpend._sum.delta ?? 0),
    introAcceptRate: totalIntros > 0 ? ((acceptedCount / totalIntros) * 100).toFixed(1) + '%' : '0%',
    introDeclineRate: totalIntros > 0 ? ((declinedCount / totalIntros) * 100).toFixed(1) + '%' : '0%',
  };
}

// ─── getAiAnalytics ──────────────────────────────────────────────────────────

export interface AiAnalyticsDto {
  period: { from: string; to: string };
  embeddingCoveragePercent: string;
  totalUsersWithEmbedding: number;
  totalUsers: number;
  pendingEmbeddingCount: number;
}

export async function getAiAnalytics(params: PeriodParams): Promise<AiAnalyticsDto> {
  const from = params.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to   = params.to   ?? new Date().toISOString();

  const [totalUsers, withEmbedding, staleOrMissing] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.profileEmbedding.count(),
    prisma.user.count({
      where: {
        deletedAt: null,
        OR: [
          { profileEmbedding: null },
          { profileEmbedding: { updatedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } },
        ],
      },
    }),
  ]);

  const coverage = totalUsers > 0 ? ((withEmbedding / totalUsers) * 100).toFixed(1) + '%' : '0%';

  log.info('AI analytics computed', { from, to });

  return {
    period: { from, to },
    embeddingCoveragePercent: coverage,
    totalUsersWithEmbedding: withEmbedding,
    totalUsers,
    pendingEmbeddingCount: staleOrMissing,
  };
}

// ─── getDiamondAnalytics ─────────────────────────────────────────────────────

export interface DiamondAnalyticsDto {
  period: { from: string; to: string };
  byReason: Record<string, number>;
  totalSpentPaise: number;
  totalCreditedPaise: number;
  netBalanceChangePaise: number;
}

export async function getDiamondAnalytics(params: PeriodParams): Promise<DiamondAnalyticsDto> {
  const range = dateRange(params.from, params.to);
  const from = params.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to   = params.to   ?? new Date().toISOString();

  const byReason = await prisma.diamondLedger.groupBy({
    by: ['reason'],
    where: { createdAt: range },
    _sum: { delta: true },
  });

  const totals = await prisma.diamondLedger.aggregate({
    _sum: { delta: true },
    where: { createdAt: range },
  });

  const spends = await prisma.diamondLedger.aggregate({
    _sum: { delta: true },
    where: { delta: { lt: 0 }, createdAt: range },
  });

  const credits = await prisma.diamondLedger.aggregate({
    _sum: { delta: true },
    where: { delta: { gt: 0 }, createdAt: range },
  });

  log.info('Diamond analytics computed', { from, to });

  return {
    period: { from, to },
    byReason: Object.fromEntries(
      byReason.map((r) => [r.reason as string, r._sum.delta ?? 0]),
    ),
    totalSpentPaise: Math.abs(spends._sum.delta ?? 0),
    totalCreditedPaise: credits._sum.delta ?? 0,
    netBalanceChangePaise: totals._sum.delta ?? 0,
  };
}
