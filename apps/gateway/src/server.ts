import type { Worker } from 'bullmq';
import { getEnv } from '@abroad-matrimony/config';
import { logger, initTelemetry, shutdownTelemetry } from '@abroad-matrimony/logger';
import { connectDb, disconnectDb } from '@abroad-matrimony/db';
import { getRedisClient, closeRedisClient } from '@abroad-matrimony/cache';
import { initEventBus, shutdownEventBus } from '@abroad-matrimony/event-bus';
import { createScoreRecomputeWorker } from '@abroad-matrimony/matching';
import { createNotificationWorker } from '@abroad-matrimony/notification';
import { isFirebaseConfigured, initFirebase, shutdownFirebase } from '@abroad-matrimony/firebase';
import { isAiConfigured, createAiWorker } from '@abroad-matrimony/ai';
import { createWeeklyDropWorker } from '@abroad-matrimony/introductions';
import { createApp } from './app.js';

async function start(): Promise<void> {
  initTelemetry();

  const env = getEnv();
  await connectDb();

  getRedisClient();
  initEventBus(env.REDIS_URL);

  // Initialise Firebase Admin SDK (Firestore + FCM) — skipped when credentials absent
  if (isFirebaseConfigured()) {
    initFirebase();
  } else {
    logger.warn('Firebase credentials not set — messaging will use MockMessagingAdapter');
  }

  // Start matching worker (runs in-process; move to dedicated worker app in production)
  const scoreWorker: Worker = createScoreRecomputeWorker(env.REDIS_URL);

  // Start notification worker — handles EMAIL / SMS / PUSH jobs from the notification queue
  const notificationWorker: Worker = createNotificationWorker(env.REDIS_URL);

  // Start AI worker — handles profile intelligence updates (debounced 60s, concurrency 2)
  // No-op when OPENAI_API_KEY is absent; isAiConfigured() guard avoids unnecessary connection
  let aiWorker: Worker | null = null;
  if (isAiConfigured()) {
    aiWorker = createAiWorker(env.REDIS_URL);
    logger.info('AI worker started (OpenAI configured)');
  } else {
    logger.warn('OPENAI_API_KEY not set — AI worker not started; profile intelligence disabled');
  }

  // Start weekly introduction drop worker — fires Sunday 09:00 UTC via BullMQ cron
  const weeklyDropWorker: Worker = await createWeeklyDropWorker(env.REDIS_URL);
  logger.info('Weekly drop worker started (cron: 0 9 * * 0)');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Gateway listening`, { port: env.PORT, env: env.NODE_ENV });
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} — graceful shutdown`);
    server.close(async () => {
      await scoreWorker.close();
      await notificationWorker.close();
      if (aiWorker) await aiWorker.close();
      await weeklyDropWorker.close();
      await shutdownEventBus();
      await closeRedisClient();
      await disconnectDb();
      await shutdownFirebase();
      await shutdownTelemetry();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start gateway', { err });
  process.exit(1);
});
