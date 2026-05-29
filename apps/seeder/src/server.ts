/**
 * Seeder app entry point.
 *
 * ⚠️  PRODUCTION GUARD — this process will exit immediately if NODE_ENV === 'production'.
 * The seeder is a developer tool and must NEVER run in production.
 */
import http from 'http';
import { createSeederApp } from './app.js';
import { getSeederEnv } from './lib/seeder-env.js';
import { seederLog } from './lib/seeder-logger.js';
import { warmPhotoCache } from './services/photo.service.js';
import { scheduleDripJob, startDripWorker, closeDripWorker } from './jobs/drip.job.js';
import { scheduleActivityJob, startActivityWorker, closeActivityWorker } from './jobs/activity.job.js';
import { startMatchRecomputeWorker, closeMatchRecomputeWorker } from './jobs/match-recompute.job.js';

// ── PRODUCTION GUARD ─────────────────────────────────────────────────────────
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
if (nodeEnv === 'production') {
  console.error('🚫 Seeder cannot run in production. Exiting immediately.');
  process.exit(1);
}

async function start(): Promise<void> {
  const env = getSeederEnv();

  seederLog.info('Starting seeder app', {
    port: env.SEEDER_PORT,
    gatewayUrl: env.GATEWAY_URL,
    nodeEnv,
  });

  // ── Photo cache warm-up ────────────────────────────────────────────────────
  await warmPhotoCache();

  // ── Start BullMQ workers ───────────────────────────────────────────────────
  startDripWorker();
  startActivityWorker();
  startMatchRecomputeWorker();

  // ── Schedule repeatable jobs ───────────────────────────────────────────────
  await scheduleDripJob();
  await scheduleActivityJob();

  // ── Start HTTP server ──────────────────────────────────────────────────────
  const app = createSeederApp();
  const server = http.createServer(app);

  server.listen(env.SEEDER_PORT, () => {
    seederLog.info(`Seeder control API listening on port ${env.SEEDER_PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    seederLog.info(`${signal} received — shutting down seeder`);

    server.close(() => {
      seederLog.info('HTTP server closed');
    });

    await Promise.allSettled([
      closeDripWorker(),
      closeActivityWorker(),
      closeMatchRecomputeWorker(),
    ]);

    seederLog.info('Seeder shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
}

start().catch((err) => {
  seederLog.error('Failed to start seeder', { err });
  process.exit(1);
});
