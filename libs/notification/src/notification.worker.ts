import { Queue, Worker, type Job } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';
import { getEmailAdapter } from './adapters/email/index.js';
import { getSmsAdapter } from './adapters/sms/index.js';
import { getPushAdapter } from './adapters/push/index.js';
import { NotificationType, type NotificationJobData } from './types/notification.types.js';

const log = createChildLogger({ module: 'notification:worker' });

export type { NotificationJobData };

// ── Quiet window check (AI-006) ───────────────────────────────────────────────

/**
 * Checks whether a push notification should be deferred due to the recipient's
 * quiet window (22:00–07:00 local time, or the window stored in ProfileEmbedding).
 *
 * Returns the delay in ms if notification should be deferred; 0 if OK to deliver.
 * Uses dynamic import to avoid a circular dependency on libs/ai at module load.
 */
async function getPushDelay(userId: string | undefined): Promise<number> {
  if (!userId) return 0;

  try {
    // Dynamic import to avoid circular dep: notification → ai → notification
    const { getContactWindow, isWithinWindow, msUntilWindowOpens } = await import('@abroad-matrimony/ai');
    const window = await getContactWindow(userId);
    if (isWithinWindow(window)) return 0;
    return msUntilWindowOpens(window);
  } catch {
    // ai lib unavailable (no OPENAI_API_KEY) — deliver immediately
    return 0;
  }
}

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

    case NotificationType.PUSH: {
      const delayMs = await getPushDelay(data.payload.userId);
      if (delayMs > 0) {
        log.info('Push notification deferred (quiet window)', {
          userId: data.payload.userId,
          delayMs,
        });
        // Re-throw with a special sentinel so the worker can re-add the job with delay
        throw Object.assign(new Error('QUIET_WINDOW_DEFER'), { delayMs });
      }
      await getPushAdapter().send(data.payload);
      break;
    }

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
  const queue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATION, {
    connection: { url: redisUrl },
  });

  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
      log.info('Processing notification job', { jobId: job.id, type: job.data.type });
      try {
        await processNotification(job.data);
      } catch (err) {
        // Quiet window defer — re-add with delay instead of failing
        const asErr = err as { message?: string; delayMs?: number };
        if (asErr.message === 'QUIET_WINDOW_DEFER' && typeof asErr.delayMs === 'number') {
          await queue.add('notification', job.data, {
            delay: asErr.delayMs,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 500 },
          });
          return; // Job "succeeded" — we've re-queued it with delay
        }
        throw err;
      }
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
