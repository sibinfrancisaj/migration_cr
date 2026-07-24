/**
 * Match Intelligence analytics — ADMIN Phase C.
 * getMatchHealth: algorithm health, score distribution, zero-match alerts.
 * getUserMatches: top match pairs for a specific user.
 * getUserActivity: daily/weekly/monthly platform activity for a user.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'analytics:match' });

// ─── Match Health ─────────────────────────────────────────────────────────────

export interface ScoreBucket {
  range: string;   // e.g. "0–10", "10–20", …, "90–100"
  count: number;
}

export interface MatchHealthDto {
  totalPairsComputed: number;
  avgScore: number;
  medianScore: number;
  usersWithZeroMatches: number;   // users with a profile but no MatchScore rows
  usersWithLowTopScore: number;   // users whose best match score < 0.30
  scoreDistribution: ScoreBucket[];
  algorithmVersions: Array<{ version: number; count: number }>;
  lastComputedAt: string | null;
  stalePairsCount: number;        // pairs not recomputed in last 7 days
}

export async function getMatchHealth(): Promise<MatchHealthDto> {
  log.info('Computing match health');

  const [
    totalPairs,
    avgAgg,
    lastComputed,
    algVersions,
    stalePairs,
    totalProfiles,
  ] = await Promise.all([
    prisma.matchScore.count(),
    prisma.matchScore.aggregate({ _avg: { totalScore: true } }),
    prisma.matchScore.findFirst({ orderBy: { computedAt: 'desc' }, select: { computedAt: true } }),
    prisma.$queryRaw<Array<{ version: number; count: bigint }>>`
      SELECT algorithm_v AS version, COUNT(*) AS count
      FROM match_scores
      GROUP BY algorithm_v
      ORDER BY algorithm_v
    `,
    prisma.matchScore.count({
      where: { computedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    prisma.profile.count(),
  ]);

  // Score distribution in 10-point buckets (0–100 scale since scores are 0–1)
  const buckets = await prisma.$queryRaw<Array<{ bucket: number; count: bigint }>>`
    SELECT
      FLOOR(total_score * 10) AS bucket,
      COUNT(*) AS count
    FROM match_scores
    GROUP BY bucket
    ORDER BY bucket
  `;

  const scoreDistribution: ScoreBucket[] = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${(i + 1) * 10}`,
    count: 0,
  }));
  for (const b of buckets) {
    const idx = Math.min(Math.floor(Number(b.bucket)), 9);
    scoreDistribution[idx]!.count = Number(b.count);
  }

  // Median: get the middle score value
  let medianScore = 0;
  if (totalPairs > 0) {
    const medianRow = await prisma.$queryRaw<Array<{ median: number }>>`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_score) AS median
      FROM match_scores
    `;
    medianScore = Number(medianRow[0]?.median ?? 0);
  }

  // Users with no match pairs at all
  const usersWithMatches = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT user_a_id) AS count FROM match_scores
    UNION
    SELECT COUNT(DISTINCT user_b_id) FROM match_scores
  `;
  const usersMatchedCount = usersWithMatches.reduce((s, r) => s + Number(r.count), 0);
  const usersWithZeroMatches = Math.max(0, totalProfiles - usersMatchedCount);

  // Users whose best score is < 0.30
  const lowTopScoreRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM (
      SELECT user_a_id AS uid, MAX(total_score) AS best
      FROM match_scores GROUP BY user_a_id
      HAVING MAX(total_score) < 0.30
    ) sub
  `;
  const usersWithLowTopScore = Number(lowTopScoreRows[0]?.count ?? 0);

  return {
    totalPairsComputed: totalPairs,
    avgScore: Number((avgAgg._avg.totalScore ?? 0).toFixed(4)),
    medianScore: Number(medianScore.toFixed(4)),
    usersWithZeroMatches,
    usersWithLowTopScore,
    scoreDistribution,
    algorithmVersions: algVersions.map((r) => ({
      version: Number(r.version),
      count: Number(r.count),
    })),
    lastComputedAt: lastComputed?.computedAt?.toISOString() ?? null,
    stalePairsCount: stalePairs,
  };
}

// ─── Per-User Matches ─────────────────────────────────────────────────────────

export interface UserMatchDto {
  matchedUserId: string;
  matchedUserName: string | null;
  matchedUserPhone: string;
  totalScore: number;
  breakdown: Record<string, number>;
  algorithmV: number;
  computedAt: string;
}

export async function getUserMatches(
  userId: string,
  limit = 20,
): Promise<{ user: { id: string; name: string | null; phone: string }; matches: UserMatchDto[] }> {
  log.info('Fetching user matches', { userId });

  const [user, matchesA, matchesB] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, profile: { select: { fullName: true } } },
    }),
    prisma.matchScore.findMany({
      where: { userAId: userId },
      orderBy: { totalScore: 'desc' },
      take: limit,
      include: {
        userB: { select: { id: true, phone: true, profile: { select: { fullName: true } } } },
      },
    }),
    prisma.matchScore.findMany({
      where: { userBId: userId },
      orderBy: { totalScore: 'desc' },
      take: limit,
      include: {
        userA: { select: { id: true, phone: true, profile: { select: { fullName: true } } } },
      },
    }),
  ]);

  if (!user) throw new Error('User not found');

  const all = [
    ...matchesA.map((m) => ({
      matchedUserId: m.userB.id,
      matchedUserName: m.userB.profile?.fullName ?? null,
      matchedUserPhone: m.userB.phone.slice(0, 6) + '****',
      totalScore: Number(m.totalScore),
      breakdown: (m.breakdown ?? {}) as Record<string, number>,
      algorithmV: m.algorithmV,
      computedAt: m.computedAt.toISOString(),
    })),
    ...matchesB.map((m) => ({
      matchedUserId: m.userA.id,
      matchedUserName: m.userA.profile?.fullName ?? null,
      matchedUserPhone: m.userA.phone.slice(0, 6) + '****',
      totalScore: Number(m.totalScore),
      breakdown: (m.breakdown ?? {}) as Record<string, number>,
      algorithmV: m.algorithmV,
      computedAt: m.computedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);

  return {
    user: {
      id: user.id,
      name: user.profile?.fullName ?? null,
      phone: user.phone.slice(0, 6) + '****',
    },
    matches: all,
  };
}

// ─── Per-User Activity ────────────────────────────────────────────────────────

export interface ActivityPoint {
  date: string;   // ISO date YYYY-MM-DD
  profileViews: number;
  connectionsSent: number;
  messagesSet: number;
  habitsLogged: number;
  promptResponses: number;
}

export interface UserActivityDto {
  userId: string;
  daily: ActivityPoint[];    // last 30 days
  weeklySummary: {
    profileViews: number;
    connectionsSent: number;
    messagesSent: number;
    habitsLogged: number;
  };
  monthlySummary: {
    profileViews: number;
    connectionsSent: number;
    messagesSent: number;
    habitsLogged: number;
  };
  streakDays: number;        // consecutive days with any habit log
  lastActiveAt: string | null;
}

export async function getUserActivity(userId: string): Promise<UserActivityDto> {
  log.info('Fetching user activity', { userId });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sevenDaysAgo  = new Date(now.getTime() -  7 * 86_400_000);

  const [
    viewsMonthly,
    connectionsMonthly,
    habitsMonthly,
    promptsMonthly,
    viewsWeekly,
    connectionsWeekly,
    habitsWeekly,
    lastHabit,
  ] = await Promise.all([
    prisma.profileView.count({ where: { viewerId: userId, viewedAt: { gte: thirtyDaysAgo } } }),
    prisma.connection.count({ where: { requesterId: userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.habitLog.count({ where: { userId, date: { gte: thirtyDaysAgo.toISOString().split('T')[0]! } } }),
    prisma.promptResponse.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.profileView.count({ where: { viewerId: userId, viewedAt: { gte: sevenDaysAgo } } }),
    prisma.connection.count({ where: { requesterId: userId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.habitLog.count({ where: { userId, date: { gte: sevenDaysAgo.toISOString().split('T')[0]! } } }),
    prisma.habitLog.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { date: true } }),
  ]);

  // Build daily breakdown for last 30 days
  const dailyViews = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT DATE(viewed_at) AS day, COUNT(*) AS count
    FROM profile_views
    WHERE viewer_id = ${userId} AND viewed_at >= ${thirtyDaysAgo}
    GROUP BY day ORDER BY day
  `;
  const dailyConns = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT DATE(created_at) AS day, COUNT(*) AS count
    FROM connections
    WHERE requester_id = ${userId} AND created_at >= ${thirtyDaysAgo}
    GROUP BY day ORDER BY day
  `;
  const dailyHabits = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
    SELECT date AS day, COUNT(*) AS count
    FROM habit_logs
    WHERE user_id = ${userId} AND date >= ${thirtyDaysAgo.toISOString().split('T')[0]!}
    GROUP BY day ORDER BY day
  `;

  // Build a map per date
  const byDate: Record<string, ActivityPoint> = {};
  const toKey = (d: Date | string) =>
    typeof d === 'string' ? d : d.toISOString().split('T')[0]!;

  for (const v of dailyViews)  { const k = toKey(v.day); if (!byDate[k]) byDate[k] = zero(k); byDate[k]!.profileViews = Number(v.count); }
  for (const c of dailyConns)  { const k = toKey(c.day); if (!byDate[k]) byDate[k] = zero(k); byDate[k]!.connectionsSent = Number(c.count); }
  for (const h of dailyHabits) { const k = toKey(h.day); if (!byDate[k]) byDate[k] = zero(k); byDate[k]!.habitsLogged = Number(h.count); }

  const daily = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  // Streak: consecutive days with habit logs ending today/yesterday
  let streakDays = 0;
  if (lastHabit) {
    const allHabitDates = await prisma.habitLog.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
    });
    const dateSet = new Set(allHabitDates.map((h) => h.date));
    let check = new Date();
    while (dateSet.has(check.toISOString().split('T')[0]!)) {
      streakDays++;
      check = new Date(check.getTime() - 86_400_000);
    }
  }

  const lastActiveAt = lastHabit?.date
    ? new Date(lastHabit.date).toISOString()
    : null;

  return {
    userId,
    daily,
    weeklySummary: {
      profileViews: viewsWeekly,
      connectionsSent: connectionsWeekly,
      messagesSent: 0,    // messages are in Firestore, not Postgres
      habitsLogged: habitsWeekly,
    },
    monthlySummary: {
      profileViews: viewsMonthly,
      connectionsSent: connectionsMonthly,
      messagesSent: 0,
      habitsLogged: habitsMonthly,
    },
    streakDays,
    lastActiveAt,
  };
}

function zero(date: string): ActivityPoint {
  return { date, profileViews: 0, connectionsSent: 0, messagesSet: 0, habitsLogged: 0, promptResponses: 0 };
}
