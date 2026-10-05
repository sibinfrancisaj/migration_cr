/**
 * Decision Log — write path.
 *
 * All public functions are fire-and-forget: call with `void`, never await.
 * Every write stores a rule-based summary immediately, then enqueues async
 * narrative enrichment via Groq (free tier) or OpenAI fallback.
 *
 * Also exports the 90-day log pruning job.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  formatMatchScoreSummary,
  formatDiscoveryFeedSummary,
  formatImplicitSignalSummary,
  formatIntroPairingSummary,
  formatDropReleasedSummary,
} from './formatters/index.js';
import { generateNarrative } from './narrative-generator.js';
import type {
  LogDecisionParams,
  MatchScoreLogData,
  DiscoveryFeedLogData,
  ImplicitSignalLogData,
  IntroPairingLogData,
  IntroDropReleasedLogData,
  TuningAppliedLogData,
  NotificationQueuedLogData,
} from './types/decision-log.types.js';

const log = createChildLogger({ module: 'decision-log' });

// ── Core write function ───────────────────────────────────────────────────────

/**
 * Persists a decision log entry then asynchronously enriches it with an LLM narrative.
 * Never throws — all errors are logged and swallowed.
 */
async function writeLog(params: LogDecisionParams): Promise<void> {
  let logId: string | null = null;

  try {
    const record = await prisma.decisionLog.create({
      data: {
        actorUserId:  params.actorUserId,
        targetUserId: params.targetUserId ?? null,
        eventType:    params.eventType,
        summary:      params.summary,
        data:         params.data,
        sessionId:    params.sessionId ?? null,
        confidence:   params.confidence ?? 'MEDIUM',
      },
      select: { id: true },
    });

    logId = record.id;

    // Datadog-compatible structured log — searchable in the Datadog log pipeline
    log.info('decision.event', {
      ddtags: `eventType:${params.eventType}`,
      decisionLogId: logId,
      actorUserId:   params.actorUserId,
      targetUserId:  params.targetUserId,
      eventType:     params.eventType,
      summary:       params.summary,
      confidence:    params.confidence ?? 'MEDIUM',
    });
  } catch (err) {
    log.error('decision-log write failed', { eventType: params.eventType, err });
    return;
  }

  // Async narrative enrichment — never blocks the caller
  if (logId) {
    generateNarrative(logId, params.eventType, params.data)
      .then(async (narrative) => {
        if (!narrative) return;
        await prisma.decisionLog.update({
          where: { id: logId! },
          data: { narrative },
        });
      })
      .catch((err) => {
        log.warn('decision-log narrative update failed', { logId, err });
      });
  }
}

// ── Typed fire-and-forget helpers ─────────────────────────────────────────────

export function logMatchScoreComputed(
  data: MatchScoreLogData,
  sessionId?: string,
): void {
  void writeLog({
    actorUserId:  data.userAId,
    targetUserId: data.userBId,
    eventType:    'MATCH_SCORE_COMPUTED',
    summary:      formatMatchScoreSummary(data),
    data:         data as unknown as Record<string, unknown>,
    sessionId,
    confidence:   data.optionalDims.length >= 3 ? 'HIGH' : data.optionalDims.length >= 1 ? 'MEDIUM' : 'MEDIUM',
  });
}

export function logMatchScoreUpdated(
  data: MatchScoreLogData,
  sessionId?: string,
): void {
  void writeLog({
    actorUserId:  data.userAId,
    targetUserId: data.userBId,
    eventType:    'MATCH_SCORE_UPDATED',
    summary:      `Match score updated to ${Math.round(data.totalScore * 100)}% — ${formatMatchScoreSummary(data)}`,
    data:         data as unknown as Record<string, unknown>,
    sessionId,
  });
}

export function logDiscoveryFeedGenerated(
  data: DiscoveryFeedLogData,
  sessionId?: string,
): void {
  void writeLog({
    actorUserId: data.userId,
    eventType:   'DISCOVERY_FEED_GENERATED',
    summary:     formatDiscoveryFeedSummary(data),
    data:        data as unknown as Record<string, unknown>,
    sessionId,
    confidence:  data.candidateCount >= 20 ? 'HIGH' : data.candidateCount >= 5 ? 'MEDIUM' : 'LOW',
  });
}

export function logImplicitSignalApplied(
  data: ImplicitSignalLogData,
  sessionId?: string,
): void {
  void writeLog({
    actorUserId:  data.signalUserId,
    targetUserId: data.targetUserId,
    eventType:    'IMPLICIT_SIGNAL_APPLIED',
    summary:      formatImplicitSignalSummary(data),
    data:         data as unknown as Record<string, unknown>,
    sessionId,
    confidence:   'HIGH',
  });
}

export function logIntroPairingCreated(
  data: IntroPairingLogData,
  sessionId?: string,
): void {
  void writeLog({
    actorUserId:  data.recipientId,
    targetUserId: data.matchedUserId,
    eventType:    'INTRO_PAIRING_CREATED',
    summary:      formatIntroPairingSummary(data),
    data:         data as unknown as Record<string, unknown>,
    sessionId,
    confidence:   data.algorithm === 'random' ? 'LOW' : data.algorithm === 'pgvector' ? 'HIGH' : 'MEDIUM',
  });
}

export function logIntroDropReleased(
  data: IntroDropReleasedLogData,
  sessionId?: string,
): void {
  void writeLog({
    actorUserId: 'system',
    eventType:   'INTRO_DROP_RELEASED',
    summary:     formatDropReleasedSummary(data),
    data:        data as unknown as Record<string, unknown>,
    sessionId,
    confidence:  'HIGH',
  });
}

export function logTuningApplied(
  data: TuningAppliedLogData,
  sessionId?: string,
): void {
  const movers = data.topRankChanges.filter(c => Math.abs(c.oldRank - c.newRank) >= 3).length;
  void writeLog({
    actorUserId: data.userId,
    eventType:   'TUNING_APPLIED',
    summary:     `Match tuning saved — ${movers} profiles moved ≥3 positions in discovery ranking.`,
    data:        data as unknown as Record<string, unknown>,
    sessionId,
    confidence:  'HIGH',
  });
}

export function logNotificationQueued(
  data: NotificationQueuedLogData,
  sessionId?: string,
): void {
  const deferred = data.deferredSeconds
    ? ` (deferred ${Math.round(data.deferredSeconds / 60)} min — quiet window)`
    : '';
  void writeLog({
    actorUserId: data.userId,
    eventType:   'NOTIFICATION_QUEUED',
    summary:     `${data.notificationType} notification queued via ${data.channel}${deferred}.`,
    data:        data as unknown as Record<string, unknown>,
    sessionId,
    confidence:  'HIGH',
  });
}

// ── Pruning job ───────────────────────────────────────────────────────────────

/**
 * Soft-deletes (marks prunedAt) decision logs older than DECISION_LOG_RETENTION_DAYS.
 * Hard-deletes entries already soft-deleted more than 7 days ago.
 * Safe to call on a BullMQ repeatable schedule (daily).
 */
export async function pruneOldDecisionLogs(retentionDays: number = 90): Promise<{ softDeleted: number; hardDeleted: number }> {
  const retentionCutoff = new Date(Date.now() - retentionDays * 86400000);
  const hardCutoff      = new Date(Date.now() - (retentionDays + 7) * 86400000);

  const [softResult, hardResult] = await Promise.all([
    prisma.decisionLog.updateMany({
      where: { createdAt: { lt: retentionCutoff }, prunedAt: null },
      data:  { prunedAt: new Date() },
    }),
    prisma.decisionLog.deleteMany({
      where: { prunedAt: { lt: hardCutoff } },
    }),
  ]);

  log.info('decision-log pruning complete', {
    softDeleted: softResult.count,
    hardDeleted: hardResult.count,
    retentionDays,
  });

  return { softDeleted: softResult.count, hardDeleted: hardResult.count };
}
