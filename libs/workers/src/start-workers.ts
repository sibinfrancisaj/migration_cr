import type { Worker } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { createEventWorker, mergeHandlerRegistries } from '@abroad-matrimony/event-bus';
import { createScoreRecomputeWorker, createMatchingEventHandlers } from '@abroad-matrimony/matching';
import { createNotificationWorker, createNotificationEventHandlers } from '@abroad-matrimony/notification';
import { createProfileEventHandlers } from '@abroad-matrimony/profile';
import { isAiConfigured, createAiWorker } from '@abroad-matrimony/ai';
import { createWeeklyDropWorker } from '@abroad-matrimony/introductions';

const log = createChildLogger({ module: 'workers' });

export const WORKER_NAMES = {
  EVENTS:        'events',
  MATCHING:      'matching',
  NOTIFICATION:  'notification',
  AI:            'ai',
  WEEKLY_DROP:   'weekly-drop',
} as const;

export type WorkerName = (typeof WORKER_NAMES)[keyof typeof WORKER_NAMES];

export interface RunningWorkers {
  workers: Partial<Record<WorkerName, Worker>>;
  /** Close every worker, in the reverse of start order. Never throws. */
  stop: () => Promise<void>;
}

/**
 * Start every BullMQ worker the platform runs (ADR-023).
 *
 * Used by apps/worker, and by apps/gateway while GATEWAY_RUN_WORKERS=true.
 * Callers must have initialised the DB, Redis client, event bus and (if
 * configured) Firebase first — workers publish events and send pushes.
 * The AI worker only starts when OPENAI_API_KEY is set.
 */
export async function startWorkers(redisUrl: string): Promise<RunningWorkers> {
  const started: Array<[WorkerName, Worker]> = [];

  // CloudEvent consumer — fans domain events out to notification, matching and profile handlers (ADR-021)
  started.push([
    WORKER_NAMES.EVENTS,
    createEventWorker(
      redisUrl,
      mergeHandlerRegistries(
        createNotificationEventHandlers(redisUrl),
        createMatchingEventHandlers(redisUrl),
        createProfileEventHandlers(),
      ),
    ),
  ]);
  started.push([WORKER_NAMES.MATCHING, createScoreRecomputeWorker(redisUrl)]);
  started.push([WORKER_NAMES.NOTIFICATION, createNotificationWorker(redisUrl)]);

  if (isAiConfigured()) {
    started.push([WORKER_NAMES.AI, createAiWorker(redisUrl)]);
  } else {
    log.warn('OPENAI_API_KEY not set — AI worker not started; profile intelligence disabled');
  }

  // Sunday 09:00 UTC cron
  started.push([WORKER_NAMES.WEEKLY_DROP, await createWeeklyDropWorker(redisUrl)]);

  log.info('Workers started', { workers: started.map(([name]) => name) });

  return {
    workers: Object.fromEntries(started) as RunningWorkers['workers'],
    stop: async () => {
      for (const [name, worker] of [...started].reverse()) {
        try {
          await worker.close();
        } catch (err) {
          log.error('Worker failed to close', { worker: name, err });
        }
      }
      log.info('Workers stopped');
    },
  };
}
