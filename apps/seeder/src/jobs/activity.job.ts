/**
 * SEED-006 — Activity simulation BullMQ job.
 * Runs every 2 hours. Picks 10–20 seeded users and simulates activity.
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { seederLog } from '../lib/seeder-logger.js';
import { getSeederEnv } from '../lib/seeder-env.js';
import { runActivitySimulation } from '../services/activity.simulator.js';

export const ACTIVITY_QUEUE_NAME = 'seeder:activity';

const ACTIVITY_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getConnection(): IORedis {
  return new IORedis(getSeederEnv().REDIS_URL, { maxRetriesPerRequest: null });
}

export async function scheduleActivityJob(): Promise<void> {
  if (!_queue) _queue = new Queue(ACTIVITY_QUEUE_NAME, { connection: getConnection() });
  await _queue.add('activity', {}, {
    repeat: { every: ACTIVITY_INTERVAL_MS },
    jobId: 'seeder-activity-repeatable',
  });
  seederLog.info('Activity simulation job scheduled', { intervalMs: ACTIVITY_INTERVAL_MS });
}

export function startActivityWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    ACTIVITY_QUEUE_NAME,
    async (_job: Job) => {
      seederLog.info('Activity simulation starting');
      const result = await runActivitySimulation();
      seederLog.info('Activity simulation complete', result);
    },
    { connection: getConnection(), concurrency: 1 },
  );

  _worker.on('failed', (job, err) => {
    seederLog.error('Activity simulation job failed', { jobId: job?.id, err });
  });

  seederLog.info('Activity worker started');
  return _worker;
}

export async function closeActivityWorker(): Promise<void> {
  if (_worker) { await _worker.close(); _worker = null; }
  if (_queue) { await _queue.close(); _queue = null; }
}
