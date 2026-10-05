/**
 * Decision Log — read/query path (admin use only).
 *
 * Provides:
 *   - queryDecisionLogs()   — filtered paginated list
 *   - getMatchStory()       — chronological narrative of how two users came to match
 *   - getUserTimeline()     — all decisions touching a single user
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type {
  DecisionLogDto,
  DecisionLogQueryParams,
  MatchStoryDto,
} from './types/decision-log.types.js';

const log = createChildLogger({ module: 'decision-log:query' });

function toDto(row: {
  id: string;
  actorUserId: string;
  targetUserId: string | null;
  eventType: string;
  summary: string;
  narrative: string | null;
  data: unknown;
  sessionId: string | null;
  confidence: string;
  createdAt: Date;
}): DecisionLogDto {
  return {
    id:           row.id,
    actorUserId:  row.actorUserId,
    targetUserId: row.targetUserId,
    eventType:    row.eventType as DecisionLogDto['eventType'],
    summary:      row.summary,
    narrative:    row.narrative,
    data:         row.data as Record<string, unknown>,
    sessionId:    row.sessionId,
    confidence:   row.confidence as DecisionLogDto['confidence'],
    createdAt:    row.createdAt,
  };
}

export async function queryDecisionLogs(
  params: DecisionLogQueryParams,
): Promise<{ items: DecisionLogDto[]; total: number }> {
  const limit  = Math.min(params.limit ?? 50, 200);
  const page   = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { prunedAt: null };

  if (params.actorUserId)  where['actorUserId']  = params.actorUserId;
  if (params.targetUserId) where['targetUserId'] = params.targetUserId;
  if (params.eventType)    where['eventType']    = params.eventType;
  if (params.sessionId)    where['sessionId']    = params.sessionId;
  if (params.from || params.to) {
    where['createdAt'] = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to   ? { lte: params.to   } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.decisionLog.findMany({
      where:   where as Parameters<typeof prisma.decisionLog.findMany>[0]['where'],
      orderBy: { createdAt: 'desc' },
      skip:    offset,
      take:    limit,
      select: {
        id: true, actorUserId: true, targetUserId: true, eventType: true,
        summary: true, narrative: true, data: true, sessionId: true,
        confidence: true, createdAt: true,
      },
    }),
    prisma.decisionLog.count({
      where: where as Parameters<typeof prisma.decisionLog.count>[0]['where'],
    }),
  ]);

  return { items: items.map(toDto), total };
}

/**
 * Returns a chronological narrative of all events between two users — how their
 * match evolved over time (score computations, signals, drops, feed appearances).
 */
export async function getMatchStory(
  userAId: string,
  userBId: string,
): Promise<MatchStoryDto> {
  log.info('getMatchStory', { userAId, userBId });

  const rows = await prisma.decisionLog.findMany({
    where: {
      prunedAt: null,
      OR: [
        { actorUserId: userAId, targetUserId: userBId },
        { actorUserId: userBId, targetUserId: userAId },
        { actorUserId: userAId, targetUserId: null, eventType: { in: ['DISCOVERY_FEED_GENERATED', 'TUNING_APPLIED'] } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, actorUserId: true, targetUserId: true, eventType: true, summary: true, narrative: true, data: true, sessionId: true, confidence: true, createdAt: true },
  });

  // Get current stored score
  const [smaller, larger] = [userAId, userBId].sort();
  const stored = await prisma.matchScore.findFirst({
    where: { userAId: smaller, userBId: larger },
    select: { totalScore: true },
  });

  return {
    userAId,
    userBId,
    currentScore: stored?.totalScore ?? null,
    entries: rows.map(r => ({
      timestamp:  r.createdAt,
      eventType:  r.eventType as MatchStoryDto['entries'][0]['eventType'],
      summary:    r.summary,
      narrative:  r.narrative,
      data:       r.data as Record<string, unknown>,
    })),
  };
}

/**
 * Returns all decision events where a user was the actor or target, in reverse
 * chronological order. Useful for auditing a user's full algorithmic history.
 */
export async function getUserTimeline(
  userId: string,
  from?: Date,
  to?: Date,
  limit = 100,
): Promise<DecisionLogDto[]> {
  const rows = await prisma.decisionLog.findMany({
    where: {
      prunedAt: null,
      OR: [{ actorUserId: userId }, { targetUserId: userId }],
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take:    Math.min(limit, 500),
    select: {
      id: true, actorUserId: true, targetUserId: true, eventType: true,
      summary: true, narrative: true, data: true, sessionId: true,
      confidence: true, createdAt: true,
    },
  });

  return rows.map(toDto);
}
