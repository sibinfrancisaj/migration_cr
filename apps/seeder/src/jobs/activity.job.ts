/**
 * SEED-006 — Activity simulation BullMQ job.
 * Runs every 2 hours. Picks 10–20 seeded users and simulates activity.
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { seederLog } from '../lib/seeder-logger.js';
import { getSeederEnv } from '../lib/seeder-env.js';
import { getState, setActivityRunning, setSocialLoopCompleted } from '../lib/seeder-state.js';
import { runSocialLoop } from '../services/social-loop.service.js';

export const ACTIVITY_QUEUE_NAME = 'seeder:activity';

const ACTIVITY_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getConnection(): IORedis {
  return new IORedis(getSeederEnv().REDIS_URL, { maxRetriesPerRequest: null });
}

export function getActivityQueue(): Queue {
  if (!_queue) _queue = new Queue(ACTIVITY_QUEUE_NAME, { connection: getConnection() });
  return _queue;
}

export async function scheduleActivityJob(): Promise<void> {
  await getActivityQueue().add('activity', {}, {
    repeat: { every: ACTIVITY_INTERVAL_MS },
    jobId: 'seeder-activity-repeatable',
  });
  seederLog.info('Activity simulation job scheduled', { intervalMs: ACTIVITY_INTERVAL_MS });
}

export async function triggerImmediateActivity(): Promise<string> {
  const job = await getActivityQueue().add('activity-manual', {}, { priority: 1 });
  seederLog.info('Manual activity trigger queued', { jobId: job.id });
  return job.id ?? 'unknown';
}

export function startActivityWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    ACTIVITY_QUEUE_NAME,
    async (_job: Job) => {
      if (getState().activityPaused) {
        seederLog.info('Activity job skipped — scheduler is paused');
        return;
      }

      setActivityRunning(true);
      const startMs = Date.now();
      seederLog.info('Social loop starting');

      const result = await runSocialLoop();
      const durationMs = Date.now() - startMs;

      setSocialLoopCompleted({
        usersActive: result.usersActive,
        totalProactive: result.totalProactive,
        connectionsHandled: result.totalReactive.connectionsHandled,
        introsHandled: result.totalReactive.introsHandled,
        postsLiked: result.totalReactive.postsLiked,
        commentsAdded: result.totalReactive.commentsAdded,
        responsesResonated: result.totalReactive.responsesResonated,
        durationMs,
      });

      seederLog.info('Social loop complete', { ...result, durationMs });
    },
    { connection: getConnection(), concurrency: 1 },
  );

  _worker.on('failed', (job, err) => {
    setActivityRunning(false);
    seederLog.error('Activity simulation job failed', { jobId: job?.id, err });
  });

  seederLog.info('Activity worker started');
  return _worker;
}

export async function closeActivityWorker(): Promise<void> {
  if (_worker) { await _worker.close(); _worker = null; }
  if (_queue) { await _queue.close(); _queue = null; }
}
