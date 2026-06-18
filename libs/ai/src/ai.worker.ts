/**
 * AI-007 — Profile Intelligence BullMQ Worker.
 *
 * Processes PROFILE_INTELLIGENCE_UPDATE jobs from the PROFILE_INTELLIGENCE queue.
 * Each job calls `generateProfileIntelligence()` for the given userId.
 *
 * The worker is started in apps/gateway/src/server.ts alongside other workers.
 * Concurrency is set to 2 (AI calls are rate-limited by OpenAI; keep low to avoid 429s).
 */
import { Queue, Worker, type Job } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';
import { generateProfileIntelligence } from './profile-intelligence.service.js';
import type { ProfileIntelligenceJobData } from './types/ai.types.js';

const log = createChildLogger({ module: 'ai:worker' });

// ── Core processor (exported for unit-test isolation) ─────────────────────────

/**
 * Processes a single profile intelligence update job.
 * Short-circuits safely if AI is not configured.
 */
export async function processProfileIntelligence(
  data: ProfileIntelligenceJobData,
): Promise<void> {
  const { userId } = data;
  log.info('Processing profile intelligence job', { userId });
  await generateProfileIntelligence(userId);
}

// ── BullMQ Worker factory ─────────────────────────────────────────────────────

/**
 * Creates and starts a BullMQ Worker for the PROFILE_INTELLIGENCE queue.
 * Concurrency: 2 (conservative to stay within OpenAI rate limits).
 */
export function createAiWorker(redisUrl: string): Worker<ProfileIntelligenceJobData> {
  const worker = new Worker<ProfileIntelligenceJobData>(
    QUEUE_NAMES.PROFILE_INTELLIGENCE,
    async (job: Job<ProfileIntelligenceJobData>) => {
      log.info('AI worker — processing job', { jobId: job.id, userId: job.data.userId });
      await processProfileIntelligence(job.data);
    },
    {
      connection: { url: redisUrl },
      concurrency: 2,
    },
  );

  worker.on('completed', (job) => {
    log.info('AI job completed', { jobId: job.id, userId: job.data.userId });
  });

  worker.on('failed', (job, err) => {
    log.error('AI job failed', { jobId: job?.id, userId: job?.data?.userId, err });
  });

  return worker;
}

// ── Manual trigger helper ─────────────────────────────────────────────────────

/**
 * Immediately enqueues a profile intelligence job (no debounce, no delay).
 * Useful for admin-triggered recomputation.
 */
export async function triggerProfileIntelligenceNow(
  userId: string,
  redisUrl: string,
): Promise<string> {
  const queue = new Queue<ProfileIntelligenceJobData>(QUEUE_NAMES.PROFILE_INTELLIGENCE, {
    connection: { url: redisUrl },
  });

  try {
    const job = await queue.add(
      'profile-intelligence-manual',
      { userId },
      {
        attempts: 2,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );
    log.info('triggerProfileIntelligenceNow — job added', { userId, jobId: job.id });
    return job.id ?? '';
  } finally {
    await queue.close();
  }
}
