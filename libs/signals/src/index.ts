import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { ConnectionStatus, IntroductionStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'signals' });

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS   = 7  * 86400000;
const FOURTEEN_DAYS_MS = 14 * 86400000;
const PROFILE_COMPLETION_THRESHOLD = 80;
/** EventRsvp.status is a plain String field in the schema (no Prisma enum). */
const RSVP_STATUS_GOING = 'GOING';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface WeeklyMetric {
  key: string;
  label: string;
  value: number;
  delta: number;
}

export interface WeeklyMetricsDto {
  weekOf: string;
  metrics: WeeklyMetric[];
}

export type ActionQueueItemType =
  | 'RESPOND_TO_INTRO'
  | 'ACCEPT_CONNECTION'
  | 'COMPLETE_PROFILE'
  | 'LOG_HABIT';

export interface ActionQueueItem {
  type: ActionQueueItemType;
  label: string;
  priority: number;
  targetUserId: string | null;
  expiresAt: string | null;
}

export interface MomentumDataPoint {
  date: string;
  views: number;
}

// ─── SIGNAL-001: Log a profile view ──────────────────────────────────────────

export class ViewSelfError extends Error {
  constructor() {
    super('CANNOT_VIEW_SELF');
    this.name = 'ViewSelfError';
  }
}

/**
 * Record that viewerId viewed viewedId's profile.
 * Deduplicates: if the same viewer viewed the same profile in the last hour,
 * no new row is created (prevents spam from repeated rapid refreshes).
 */
export async function logProfileView(viewerId: string, viewedId: string): Promise<void> {
  if (viewerId === viewedId) throw new ViewSelfError();

  const oneHourAgo = new Date(Date.now() - 3600000);

  const recent = await prisma.profileView.findFirst({
    where: {
      viewerId,
      viewedId,
      viewedAt: { gte: oneHourAgo },
    },
    select: { id: true },
  });

  if (recent) return;

  await prisma.profileView.create({ data: { viewerId, viewedId } });

  log.info('logProfileView — recorded', { viewerId, viewedId });
}

// ─── SIGNAL-002: Weekly metrics with delta ────────────────────────────────────

/**
 * Returns 4 weekly metrics (profile views, connections received,
 * resonates received, intro pool size) with week-over-week deltas.
 */
export async function getWeeklyMetrics(userId: string): Promise<WeeklyMetricsDto> {
  const now = new Date();
  const weekStart = new Date(now.getTime() - SEVEN_DAYS_MS);
  const prevWeekStart = new Date(now.getTime() - FOURTEEN_DAYS_MS);

  const [
    viewsThisWeek,
    viewsPrevWeek,
    connectionsThisWeek,
    connectionsPrevWeek,
    resonatesThisWeek,
    resonatesPrevWeek,
    introPoolSize,
  ] = await Promise.all([
    prisma.profileView.count({
      where: { viewedId: userId, viewedAt: { gte: weekStart } },
    }),
    prisma.profileView.count({
      where: { viewedId: userId, viewedAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.connection.count({
      where: { receiverId: userId, createdAt: { gte: weekStart } },
    }),
    prisma.connection.count({
      where: { receiverId: userId, createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.promptResonate.count({
      where: { response: { userId }, createdAt: { gte: weekStart } },
    }),
    prisma.promptResonate.count({
      where: { response: { userId }, createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.introduction.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { in: [IntroductionStatus.PENDING, IntroductionStatus.ACCEPTED] },
      },
    }),
  ]);

  const weekOf = weekStart.toISOString().slice(0, 10);

  return {
    weekOf,
    metrics: [
      {
        key: 'profileViews',
        label: 'Profile Views',
        value: viewsThisWeek,
        delta: viewsThisWeek - viewsPrevWeek,
      },
      {
        key: 'connectionRequests',
        label: 'Connection Requests',
        value: connectionsThisWeek,
        delta: connectionsThisWeek - connectionsPrevWeek,
      },
      {
        key: 'resonates',
        label: 'Resonates Received',
        value: resonatesThisWeek,
        delta: resonatesThisWeek - resonatesPrevWeek,
      },
      {
        key: 'introPoolSize',
        label: 'Your Intro Pool',
        value: introPoolSize,
        delta: 0,
      },
    ],
  };
}

// ─── SIGNAL-003: Action queue ─────────────────────────────────────────────────

/**
 * Returns a prioritized list of next actions for the user.
 * Items are ordered by priority (1 = highest).
 */
export async function getActionQueue(userId: string): Promise<ActionQueueItem[]> {
  const [pendingConnections, pendingIntros, profile] = await Promise.all([
    prisma.connection.findMany({
      where: { receiverId: userId, status: ConnectionStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        senderId: true,
        sender: { select: { profile: { select: { name: true } } } },
      },
    }),
    prisma.introduction.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: IntroductionStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        userAId: true,
        userBId: true,
        drop: { select: { releaseAt: true } },
      },
    }),
    prisma.profile.findUnique({
      where: { userId },
      select: { completionScore: true },
    }),
  ]);

  const items: ActionQueueItem[] = [];

  // Priority 1 — respond to pending intros
  for (const intro of pendingIntros) {
    const targetUserId = intro.userAId === userId ? intro.userBId : intro.userAId;
    items.push({
      type: 'RESPOND_TO_INTRO',
      label: 'Respond to your introduction',
      priority: 1,
      targetUserId,
      expiresAt: intro.drop?.releaseAt
        ? new Date(intro.drop.releaseAt.getTime() + 7 * 86400000).toISOString()
        : null,
    });
  }

  // Priority 2 — accept pending connections
  for (const conn of pendingConnections) {
    const name = conn.sender.profile?.name ?? 'Someone';
    items.push({
      type: 'ACCEPT_CONNECTION',
      label: `${name} wants to connect`,
      priority: 2,
      targetUserId: conn.senderId,
      expiresAt: null,
    });
  }

  // Priority 3 — complete profile if score is low
  if (profile && profile.completionScore < PROFILE_COMPLETION_THRESHOLD) {
    items.push({
      type: 'COMPLETE_PROFILE',
      label: 'Complete your profile to get more matches',
      priority: 3,
      targetUserId: null,
      expiresAt: null,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

// ─── SIGNAL-004: Momentum — 7-day daily view bar chart ────────────────────────

/**
 * Returns the last 7 days of daily profile view counts (ordered oldest→newest).
 */
export async function getMomentumData(userId: string): Promise<MomentumDataPoint[]> {
  const days: MomentumDataPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    dayStart.setUTCDate(dayStart.getUTCDate() - i);

    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const views = await prisma.profileView.count({
      where: {
        viewedId: userId,
        viewedAt: { gte: dayStart, lt: dayEnd },
      },
    });

    days.push({ date: dayStart.toISOString().slice(0, 10), views });
  }

  return days;
}
