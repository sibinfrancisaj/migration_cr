import { Queue, Worker, type Job } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';
import { getEmailAdapter } from './adapters/email/index.js';
import { getSmsAdapter } from './adapters/sms/index.js';
import { getPushAdapter } from './adapters/push/index.js';
import { NotificationType, type NotificationJobData } from './types/notification.types.js';

const log = createChildLogger({ module: 'notification:worker' });

export type { NotificationJobData };

// ── Core dispatch function (exported for unit-test isolation) ─────────────────

/**
 * Dispatches a single notification to the appropriate adapter.
 * Isolated from BullMQ so it can be unit-tested without a Redis connection.
 */
export async function processNotification(data: NotificationJobData): Promise<void> {
  switch (data.type) {
    case NotificationType.EMAIL:
      await getEmailAdapter().send(data.payload);
      break;

    case NotificationType.SMS:
      await getSmsAdapter().send(data.payload);
      break;

    case NotificationType.PUSH:
      await getPushAdapter().send(data.payload);
      break;

    default: {
      // Exhaustiveness check — TypeScript will catch unhandled cases at compile time.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _exhaustive: never = data as any;
      log.error('Unknown notification type', { type: (_exhaustive as NotificationJobData).type });
      throw new Error(`Unknown notification type: ${JSON.stringify(data)}`);
    }
  }
}

// ── BullMQ Worker factory ─────────────────────────────────────────────────────

/**
 * Creates and starts a BullMQ Worker for the NOTIFICATION queue.
 * Processes up to 5 notifications concurrently (I/O-bound, safe to parallelise).
 *
 * Call `worker.close()` during graceful shutdown.
 */
export function createNotificationWorker(redisUrl: string): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
      log.info('Processing notification job', { jobId: job.id, type: job.data.type });
      await processNotification(job.data);
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    log.info('Notification job completed', { jobId: job.id, type: job.data.type });
  });

  worker.on('failed', (job, err) => {
    log.error('Notification job failed', { jobId: job?.id, type: job?.data?.type, err });
  });

  return worker;
}

// ── Job enqueue helper ────────────────────────────────────────────────────────

/**
 * Enqueues a notification job on the NOTIFICATION queue.
 * Retries up to 3 times with exponential back-off (5s base).
 *
 * @param redisUrl  Redis connection URL.
 * @param job       The notification to dispatch.
 */
export async function enqueueNotification(
  redisUrl: string,
  job: NotificationJobData,
): Promise<void> {
  const queue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATION, {
    connection: { url: redisUrl },
  });

  try {
    await queue.add('notification', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail:     { count: 500 },
    });
    log.info('Notification enqueued', { type: job.type });
  } finally {
    await queue.close();
  }
}
