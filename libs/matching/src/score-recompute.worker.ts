import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  CLOUD_EVENT_TYPES,
  QUEUE_NAMES,
  SCORE_RECOMPUTE_STALE_HOURS,
} from '@abroad-matrimony/shared';
import { publish } from '@abroad-matrimony/event-bus';
import { computeAndSaveScore, UserProfileMissingError, ALGORITHM_VERSION } from './match-score.service.js';

const log = createChildLogger({ module: 'matching:score-recompute' });

/** BullMQ job name — used for deduplication via fixed jobId. */
const JOB_NAME = 'score-recompute';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ScoreRecomputeJobData {
  /** User ID of the admin / system process that triggered the recompute (optional, for audit). */
  requestedBy?: string;
  /**
   * When `true`, skips the 24-hour stale check and recomputes every pair unconditionally.
   * Defaults to `false`.
   */
  force?: boolean;
}

export interface ScoreRecomputeResult {
  totalUsers:  number;
  totalPairs:  number;
  computed:    number;
  skipped:     number;
  errors:      number;
}

// ── Core processing function (exported for unit-test isolation) ───────────────

/**
 * Enumerates every user pair, skips fresh ones (unless forced), and calls
 * `computeAndSaveScore()` for each stale pair.  Fires a
 * `SCORE_RECOMPUTE_COMPLETED` CloudEvent on completion regardless of errors.
 *
 * The optional `onProgress` callback receives a 0–100 integer after each pair
 * is processed; the BullMQ Worker uses it to call `job.updateProgress()`.
 *
 * Exported for unit testing — callers do not need BullMQ to test this function.
 */
export async function processScoreRecompute(
  data: ScoreRecomputeJobData,
  onProgress?: (pct: number) => Promise<void>,
): Promise<ScoreRecomputeResult> {
  const { force = false } = data;

  // ── 1. Fetch all user IDs that have a profile row ─────────────────────────
  const profiles = await prisma.profile.findMany({
    select: { userId: true },
  });
  const userIds   = profiles.map(p => p.userId);
  const totalUsers = userIds.length;
  // Guard against -0 when totalUsers === 0 (JS: 0 * -1 = -0)
  const totalPairs = totalUsers < 2 ? 0 : (totalUsers * (totalUsers - 1)) / 2;

  log.info('Score recompute started', { totalUsers, totalPairs, force });

  // Nothing to do with fewer than 2 users
  if (totalPairs === 0) {
    const result: ScoreRecomputeResult = {
      totalUsers, totalPairs, computed: 0, skipped: 0, errors: 0,
    };
    await publish(CLOUD_EVENT_TYPES.SCORE_RECOMPUTE_COMPLETED, result);
    log.info('Score recompute finished (no pairs)', result);
    return result;
  }

  // ── 2. Bulk-load recent scores (1 DB call) to avoid per-pair stale queries ─
  const recentPairSet = new Set<string>();

  if (!force) {
    const staleThreshold = new Date(Date.now() - SCORE_RECOMPUTE_STALE_HOURS * 3_600_000);
    const recentScores = await prisma.matchScore.findMany({
      where: {
        computedAt: { gte: staleThreshold },
        algorithmV: ALGORITHM_VERSION,
      },
      select: { userAId: true, userBId: true },
    });
    for (const { userAId, userBId } of recentScores) {
      recentPairSet.add(`${userAId}:${userBId}`);
    }
  }

  // ── 3. Enumerate all N*(N-1)/2 pairs ─────────────────────────────────────
  let computed = 0, skipped = 0, errors = 0, done = 0;

  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      // Canonicalize inline (same rule as in match-score.service.ts)
      const idA = userIds[i];
      const idB = userIds[j];
      const [canonA, canonB] = idA < idB ? [idA, idB] : [idB, idA];

      if (!force && recentPairSet.has(`${canonA}:${canonB}`)) {
        skipped++;
      } else {
        try {
          await computeAndSaveScore(canonA, canonB);
          computed++;
        } catch (err) {
          errors++;
          if (err instanceof UserProfileMissingError) {
            log.warn('Pair skipped — profile missing', {
              userAId: canonA, userBId: canonB, missingUser: err.userId,
            });
          } else {
            log.error('Failed to compute pair score', {
              userAId: canonA, userBId: canonB, err,
            });
          }
        }
      }

      done++;
      if (onProgress) {
        await onProgress(Math.round((done / totalPairs) * 100));
      }
    }
  }

  const result: ScoreRecomputeResult = { totalUsers, totalPairs, computed, skipped, errors };

  log.info('Score recompute finished', result);
  await publish(CLOUD_EVENT_TYPES.SCORE_RECOMPUTE_COMPLETED, result);

  return result;
}

// ── BullMQ Worker factory ─────────────────────────────────────────────────────

/**
 * Creates and starts a BullMQ Worker that processes jobs from the MATCHING queue.
 * Only one job runs at a time (`concurrency: 1`) — a full recompute is heavy.
 *
 * Call `worker.close()` during graceful shutdown.
 */
export function createScoreRecomputeWorker(redisUrl: string): Worker<ScoreRecomputeJobData> {
  const worker = new Worker<ScoreRecomputeJobData>(
    QUEUE_NAMES.MATCHING,
    async (job: Job<ScoreRecomputeJobData>) => {
      await processScoreRecompute(job.data, async (pct) => {
        await job.updateProgress(pct);
      });
    },
    {
      connection: { url: redisUrl },
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    log.info('Score recompute job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log.error('Score recompute job failed', { jobId: job?.id, err });
  });

  return worker;
}

// ── Job enqueue helper ────────────────────────────────────────────────────────

/**
 * Enqueues a score-recompute job on the MATCHING queue.
 *
 * Uses a fixed `jobId` (`"score-recompute"`) so BullMQ deduplicates the job —
 * if one is already pending/running, adding a second is a no-op for the
 * waiting state (BullMQ will not add a duplicate with the same ID when one is
 * already in the `waiting` state).
 */
export async function enqueueScoreRecompute(
  redisUrl: string,
  data: ScoreRecomputeJobData = {},
): Promise<void> {
  const queue = new Queue<ScoreRecomputeJobData>(QUEUE_NAMES.MATCHING, {
    connection: { url: redisUrl },
  });

  try {
    await queue.add(JOB_NAME, data, {
      jobId:   JOB_NAME,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    });
    log.info('Score recompute job enqueued', { force: data.force ?? false });
  } finally {
    await queue.close();
  }
}
