/**
 * PROD-004 — BullMQ cron worker for subscription renewal reminders.
 * Runs daily at 09:00 UTC.
 */
import { Worker, Queue } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { sendMembershipRenewalReminders } from './renewal-reminder.service.js';

const log = createChildLogger({ module: 'payment:renewal-reminder-worker' });

const QUEUE_NAME = 'renewal-reminder';
const CRON_EXPRESSION = '0 9 * * *'; // daily 09:00 UTC

export function createRenewalReminderWorker(redisUrl: string): Worker {
  const queue = new Queue(QUEUE_NAME, { connection: { url: redisUrl } });

  // Register the repeatable cron job on startup (idempotent)
  queue.add('daily-reminder', {}, {
    repeat: { pattern: CRON_EXPRESSION },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  }).catch((err) => log.error('Failed to register renewal reminder cron', { err }));

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      log.info('Running renewal reminder job');
      const result = await sendMembershipRenewalReminders();
      log.info('Renewal reminder job complete', result);
    },
    { connection: { url: redisUrl }, concurrency: 1 },
  );

  worker.on('completed', () => log.info('Renewal reminder job completed'));
  worker.on('failed', (job, err) => log.error('Renewal reminder job failed', { jobId: job?.id, err }));

  return worker;
}
