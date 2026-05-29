/**
 * SEED-007 — Drip scheduler job.
 *
 * BullMQ repeatable job that fires every SEEDER_DRIP_INTERVAL_HOURS hours.
 * On each fire: waits a random delay (0–60 min) for organic feel, then creates
 * 3–5 new profiles (SEEDER_DRIP_MIN to SEEDER_DRIP_MAX).
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { seederLog } from '../lib/seeder-logger.js';
import { getSeederEnv } from '../lib/seeder-env.js';
import { createSeededProfile } from '../factories/profile.factory.js';
import { autoJoinGroups } from '../services/group-join.service.js';
import { setRunning, setDripCompleted } from '../lib/seeder-state.js';
import { triggerMatchRecompute } from './match-recompute.job.js';

export const DRIP_QUEUE_NAME = 'seeder:drip';

let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getConnection(): IORedis {
  const env = getSeederEnv();
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function getDripQueue(): Queue {
  if (_queue) return _queue;
  _queue = new Queue(DRIP_QUEUE_NAME, { connection: getConnection() });
  return _queue;
}

/**
 * Registers the repeatable drip job. Safe to call multiple times — BullMQ
 * deduplicates by job name.
 */
export async function scheduleDripJob(): Promise<void> {
  const env = getSeederEnv();
  const queue = getDripQueue();

  await queue.add(
    'drip',
    {},
    {
      repeat: {
        every: env.SEEDER_DRIP_INTERVAL_HOURS * 60 * 60 * 1000,
      },
      jobId: 'seeder-drip-repeatable',
    },
  );

  seederLog.info('Drip job scheduled', { intervalHours: env.SEEDER_DRIP_INTERVAL_HOURS });
}

/**
 * Triggers an immediate one-off drip (for SEED-008 control API).
 */
export async function triggerImmediateDrip(): Promise<string> {
  const queue = getDripQueue();
  const job = await queue.add('drip-manual', {}, { priority: 1 });
  seederLog.info('Manual drip triggered', { jobId: job.id });
  return job.id ?? 'unknown';
}

/**
 * Starts the BullMQ worker that processes drip jobs.
 */
export function startDripWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    DRIP_QUEUE_NAME,
    async (job: Job) => {
      const env = getSeederEnv();

      if (job.data?.skipDelay !== true) {
        // Organic random delay: 0–60 minutes
        const delayMs = Math.floor(Math.random() * 60 * 60 * 1000);
        seederLog.debug('Drip job: random delay before execution', { delayMs });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const count = Math.floor(
        Math.random() * (env.SEEDER_DRIP_MAX - env.SEEDER_DRIP_MIN + 1) + env.SEEDER_DRIP_MIN,
      );

      seederLog.info('Drip job starting', { count, jobId: job.id });
      setRunning(true, job.id);

      const newUserIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const result = await createSeededProfile();
        if (!result) continue;

        newUserIds.push(result.userId);
        await autoJoinGroups(result);
      }

      setDripCompleted(newUserIds.length);
      seederLog.info('Drip job complete', { created: newUserIds.length, jobId: job.id });

      // Trigger match recompute for new profiles
      if (newUserIds.length > 0) {
        await triggerMatchRecompute(newUserIds);
      }
    },
    { connection: getConnection(), concurrency: 1 },
  );

  _worker.on('failed', (job, err) => {
    seederLog.error('Drip job failed', { jobId: job?.id, err });
    setRunning(false);
  });

  seederLog.info('Drip worker started');
  return _worker;
}

export async function closeDripWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
