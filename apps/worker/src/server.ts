import { getEnv } from '@abroad-matrimony/config';
import { logger, initTelemetry, shutdownTelemetry } from '@abroad-matrimony/logger';
import { connectDb, disconnectDb } from '@abroad-matrimony/db';
import { getRedisClient, closeRedisClient } from '@abroad-matrimony/cache';
import { initEventBus, shutdownEventBus } from '@abroad-matrimony/event-bus';
import { isFirebaseConfigured, initFirebase, shutdownFirebase } from '@abroad-matrimony/firebase';
import { startWorkers, type RunningWorkers } from '@abroad-matrimony/workers';
import { closeQueues } from '@abroad-matrimony/queue';
import { createHealthServer } from './health.js';

/**
 * Dedicated worker process (F-051 / ADR-023). Runs every BullMQ worker so the
 * gateway can scale on HTTP load alone. Deploy with GATEWAY_RUN_WORKERS=false
 * on the gateway, otherwise both processes consume the same queues.
 */
async function start(): Promise<void> {
  initTelemetry();

  const env = getEnv();
  let status: 'starting' | 'ok' | 'stopping' = 'starting';

  const health = createHealthServer(() => status);
  health.listen(env.WORKER_PORT, () => {
    logger.info('Worker health endpoint listening', { port: env.WORKER_PORT });
  });

  await connectDb();
  getRedisClient();
  // Workers publish follow-up CloudEvents (e.g. PROFILE_UPDATED), so the WAL must be live.
  initEventBus(env.REDIS_URL);

  if (isFirebaseConfigured()) {
    initFirebase();
  } else {
    logger.warn('Firebase credentials not set — push notifications use MockPushAdapter');
  }

  const workers: RunningWorkers = await startWorkers(env.REDIS_URL);
  status = 'ok';
  logger.info('Worker process ready', { env: env.NODE_ENV });

  async function shutdown(signal: string): Promise<void> {
    if (status === 'stopping') return;
    status = 'stopping';
    logger.info(`Received ${signal} — graceful shutdown`);

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000).unref();

    // Let in-flight jobs finish before closing the connections they use.
    await workers.stop();
    await closeQueues();
    await shutdownEventBus();
    await closeRedisClient();
    await disconnectDb();
    await shutdownFirebase();
    health.close();
    await shutdownTelemetry();
    logger.info('Shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start worker', { err });
  process.exit(1);
});
