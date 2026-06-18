/**
 * INTRO-001 — BullMQ weekly introduction drop worker.
 *
 * Registers a repeatable BullMQ job that fires every Sunday at 09:00 UTC
 * (cron: `0 9 * * 0`). On each tick it calls `createWeeklyGroupDrops()`
 * which creates one IntroductionDrop per active REGIONAL group and
 * fires async pairing generation.
 *
 * Usage (in apps/gateway/src/server.ts):
 *   ```ts
 *   const introWorker = await createWeeklyDropWorker(env.REDIS_URL);
 *   // on shutdown:
 *   await introWorker.close();
 *   ```
 */

import { Worker, Queue } from 'bullmq';
import type { Job } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';
import { createWeeklyGroupDrops } from './weekly-drop.service.js';

const log = createChildLogger({ module: 'introductions:weekly-drop-job' });

const WEEKLY_DROP_JOB_NAME = 'weekly-group-drops';

/** Sunday at 09:00 UTC */
const WEEKLY_DROP_CRON = '0 9 * * 0';

// ── Worker ────────────────────────────────────────────────────────────────────

/**
 * Creates the BullMQ worker that processes weekly drop jobs.
 * Also schedules the repeatable cron job so the queue self-manages.
 *
 * @param redisUrl - Redis connection URL
 */
export async function createWeeklyDropWorker(redisUrl: string): Promise<Worker> {
  // Register the repeatable job so it fires on cron schedule
  const queue = new Queue(QUEUE_NAMES.WEEKLY_INTROS, {
    connection: { url: redisUrl },
  });

  await queue.add(
    WEEKLY_DROP_JOB_NAME,
    {},
    {
      repeat: { pattern: WEEKLY_DROP_CRON, tz: 'UTC' },
      jobId:  `${WEEKLY_DROP_JOB_NAME}:cron`,
    },
  );

  log.info('Weekly drop cron registered', { cron: WEEKLY_DROP_CRON });

  await queue.close();

  // Create the worker that processes the jobs
  const worker = new Worker(
    QUEUE_NAMES.WEEKLY_INTROS,
    async (job: Job) => {
      log.info('Processing weekly drop job', { jobId: job.id, name: job.name });
      const result = await createWeeklyGroupDrops();
      log.info('Weekly drop job complete', { jobId: job.id, ...result });
      return result;
    },
    {
      connection: { url: redisUrl },
      concurrency: 1,
    },
  );

  worker.on('completed', (job, result) => {
    log.info('Weekly drop worker: job completed', {
      jobId: job.id,
      created: (result as { created: number }).created,
      skipped: (result as { skipped: number }).skipped,
    });
  });

  worker.on('failed', (job, err) => {
    log.error('Weekly drop worker: job failed', { jobId: job?.id, err });
  });

  return worker;
}

/**
 * Immediately enqueues one weekly drop run (useful for manual triggers / seeder).
 * Does NOT affect the repeatable cron schedule.
 */
export async function triggerWeeklyDropNow(redisUrl: string): Promise<string> {
  const queue = new Queue(QUEUE_NAMES.WEEKLY_INTROS, {
    connection: { url: redisUrl },
  });
  const job = await queue.add(WEEKLY_DROP_JOB_NAME, {}, { jobId: `${WEEKLY_DROP_JOB_NAME}:manual:${Date.now()}` });
  await queue.close();
  log.info('Weekly drop triggered manually', { jobId: job.id });
  return job.id ?? '';
}
