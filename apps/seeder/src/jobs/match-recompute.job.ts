/**
 * SEED-009 — Match recompute trigger.
 *
 * After each drip batch, enqueues a RECOMPUTE_SCORES BullMQ job targeting
 * the newly created profile IDs so the discovery feed has meaningful scores.
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { seederLog } from '../lib/seeder-logger.js';
import { getSeederEnv } from '../lib/seeder-env.js';
import { setMatchRecomputeAt } from '../lib/seeder-state.js';

export const MATCH_QUEUE_NAME = 'seeder:match-recompute';

let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getConnection(): IORedis {
  return new IORedis(getSeederEnv().REDIS_URL, { maxRetriesPerRequest: null });
}

export async function triggerMatchRecompute(newUserIds: string[]): Promise<void> {
  if (!_queue) {
    _queue = new Queue(MATCH_QUEUE_NAME, { connection: getConnection() });
  }
  await _queue.add('recompute', { userIds: newUserIds });
  seederLog.debug('Match recompute job enqueued', { userCount: newUserIds.length });
}

export function startMatchRecomputeWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    MATCH_QUEUE_NAME,
    async (job: Job) => {
      const userIds: string[] = job.data.userIds ?? [];
      seederLog.info('Match recompute job running', { userCount: userIds.length });

      // Import matching lib dynamically so it doesn't fail if DB isn't reachable
      try {
        const { batchComputeScoresForUsers } = await import('@abroad-matrimony/matching');
        await batchComputeScoresForUsers(userIds);
        setMatchRecomputeAt();
        seederLog.info('Match recompute complete', { userCount: userIds.length });
      } catch (err) {
        seederLog.warn('Match recompute failed — scores will be computed on next batch', { err });
      }
    },
    { connection: getConnection(), concurrency: 1 },
  );

  _worker.on('failed', (job, err) => {
    seederLog.error('Match recompute job failed', { jobId: job?.id, err });
  });

  seederLog.info('Match recompute worker started');
  return _worker;
}

export async function closeMatchRecomputeWorker(): Promise<void> {
  if (_worker) { await _worker.close(); _worker = null; }
  if (_queue) { await _queue.close(); _queue = null; }
}
