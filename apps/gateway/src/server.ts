import { getEnv } from '@abroad-matrimony/config';
import { logger, initTelemetry, shutdownTelemetry } from '@abroad-matrimony/logger';
import { connectDb, disconnectDb } from '@abroad-matrimony/db';
import { getRedisClient, closeRedisClient } from '@abroad-matrimony/cache';
import { initEventBus, shutdownEventBus } from '@abroad-matrimony/event-bus';
import { isFirebaseConfigured, initFirebase, shutdownFirebase } from '@abroad-matrimony/firebase';
import { startWorkers, type RunningWorkers } from '@abroad-matrimony/workers';
import { createApp } from './app.js';
import { RedisRateLimitStore } from './lib/redis-rate-limit.store.js';

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

  // BullMQ workers run here only until apps/worker is deployed (F-051 / ADR-023).
  // With apps/worker running, set GATEWAY_RUN_WORKERS=false so jobs aren't consumed by both.
  let workers: RunningWorkers | null = null;
  if (env.GATEWAY_RUN_WORKERS) {
    workers = await startWorkers(env.REDIS_URL);
  } else {
    logger.info('GATEWAY_RUN_WORKERS=false — workers run in apps/worker');
  }

  const app = createApp({ rateLimitStore: new RedisRateLimitStore(getRedisClient) });
  const server = app.listen(env.PORT, () => {
    logger.info(`Gateway listening`, { port: env.PORT, env: env.NODE_ENV });
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} — graceful shutdown`);
    server.close(async () => {
      await workers?.stop();
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
