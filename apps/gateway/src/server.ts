import { getEnv } from '@abroad-matrimony/config';
import { logger, initTelemetry, shutdownTelemetry } from '@abroad-matrimony/logger';
import { connectDb, disconnectDb } from '@abroad-matrimony/db';
import { getRedisClient, closeRedisClient } from '@abroad-matrimony/cache';
import { initEventBus, shutdownEventBus } from '@abroad-matrimony/event-bus';
import { createApp } from './app.js';

async function start(): Promise<void> {
  initTelemetry();

  const env = getEnv();
  await connectDb();

  getRedisClient();
  initEventBus(env.REDIS_URL);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Gateway listening`, { port: env.PORT, env: env.NODE_ENV });
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} — graceful shutdown`);
    server.close(async () => {
      await shutdownEventBus();
      await closeRedisClient();
      await disconnectDb();
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
