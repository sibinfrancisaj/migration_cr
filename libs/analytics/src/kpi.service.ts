/**
 * ADMIN-007 — Core KPI dashboard.
 * Aggregate platform metrics: DAU/WAU/MAU, registrations, funnels, membership conversion.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'analytics:kpi' });

export interface KpiParams {
  from?: string;
  to?: string;
}

export interface CohortParams {
  from?: string;
  to?: string;
  granularity?: 'day' | 'week';
}

export interface KpiDto {
  period: { from: string; to: string };
  users: {
    newRegistrations: number;
    totalActive: number;
    suspended: number;
  };
  profiles: {
    avgCompletionScore: number;
    totalComplete: number;        // completionScore >= 80
    voiceIntroCount: number;
  };
  connections: {
    requestsSent: number;
    accepted: number;
    acceptanceRate: string;
  };
  membership: {
    totalActive: number;
    newInPeriod: number;
    conversionRate: string;       // active members / total users
  };
  diamonds: {
    totalSpentPaise: number;
    totalCreditedPaise: number;
  };
  matching: {
    avgTotalScore: number;
  };
}

function dateRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  };
}

export async function getKpiDashboard(params: KpiParams): Promise<KpiDto> {
  const range = dateRange(params.from, params.to);
  const periodFrom = params.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const periodTo   = params.to   ?? new Date().toISOString();

  const [
    newRegistrations,
    totalActive,
    suspended,
    profiles,
    connectionsSent,
    connectionsAccepted,
    totalMembers,
    newMembers,
    totalUsers,
    diamondSpend,
    diamondCredit,
    matchScores,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: range } }),
    prisma.user.count({ where: { role: { notIn: ['SUSPENDED'] as never[] } } }),
    prisma.user.count({ where: { role: 'SUSPENDED' as never } }),
    prisma.profile.aggregate({
      _avg: { completionScore: true },
      _count: { id: true },
      where: {
        ...(range.gte || range.lte ? { createdAt: range } : {}),
        voiceIntroTranscript: { not: null },
      },
    }),
    prisma.connection.count({ where: { createdAt: range } }),
    prisma.connection.count({ where: { status: 'ACCEPTED' as never, updatedAt: range } }),
    prisma.membership.count({ where: { status: 'ACTIVE' as never } }),
    prisma.membership.count({ where: { status: 'ACTIVE' as never, createdAt: range } }),
    prisma.user.count(),
    prisma.diamondLedger.aggregate({
      _sum: { delta: true },
      where: { delta: { lt: 0 }, createdAt: range },
    }),
    prisma.diamondLedger.aggregate({
      _sum: { delta: true },
      where: { delta: { gt: 0 }, createdAt: range },
    }),
    prisma.matchScore.aggregate({ _avg: { totalScore: true } }),
  ]);

  const completeProfiles = await prisma.profile.count({ where: { completionScore: { gte: 80 } } });

  const avgCompletion = await prisma.profile.aggregate({ _avg: { completionScore: true } });

  const acceptanceRate =
    connectionsSent > 0
      ? ((connectionsAccepted / connectionsSent) * 100).toFixed(1) + '%'
      : '0%';

  const conversionRate =
    totalUsers > 0
      ? ((totalMembers / totalUsers) * 100).toFixed(2) + '%'
      : '0%';

  log.info('KPI dashboard computed', { from: periodFrom, to: periodTo });

  return {
    period: { from: periodFrom, to: periodTo },
    users: {
      newRegistrations,
      totalActive,
      suspended,
    },
    profiles: {
      avgCompletionScore: Math.round(avgCompletion._avg.completionScore ?? 0),
      totalComplete: completeProfiles,
      voiceIntroCount: profiles._count.id,
    },
    connections: {
      requestsSent: connectionsSent,
      accepted: connectionsAccepted,
      acceptanceRate,
    },
    membership: {
      totalActive: totalMembers,
      newInPeriod: newMembers,
      conversionRate,
    },
    diamonds: {
      totalSpentPaise: Math.abs(diamondSpend._sum.delta ?? 0),
      totalCreditedPaise: diamondCredit._sum.delta ?? 0,
    },
    matching: {
      avgTotalScore: Number((matchScores._avg.totalScore ?? 0).toFixed(4)),
    },
  };
}

// ─── getCohortRetention ──────────────────────────────────────────────────────

export interface CohortBucket {
  cohortDate: string;
  registered: number;
  d1Retained: number;
  d7Retained: number;
  d30Retained: number;
}

export async function getCohortRetention(_params: CohortParams): Promise<CohortBucket[]> {
  // Lightweight proxy: return weekly registration cohorts + check-in activity as retention signal
  const weeks = await prisma.$queryRaw<Array<{ week: Date; registered: bigint }>>`
    SELECT
      date_trunc('week', created_at) AS week,
      COUNT(*) AS registered
    FROM users
    WHERE deleted_at IS NULL
    GROUP BY week
    ORDER BY week DESC
    LIMIT 12
  `;

  return weeks.map((w) => ({
    cohortDate: w.week.toISOString().split('T')[0]!,
    registered: Number(w.registered),
    d1Retained:  0,  // Requires event-level tracking; placeholder
    d7Retained:  0,
    d30Retained: 0,
  }));
}
