import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'db' });

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });
}

export const prisma: PrismaClient =
  process.env['NODE_ENV'] === 'production'
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());

if (process.env['NODE_ENV'] === 'development') {
  (prisma as PrismaClient & { $on: Function }).$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 1000) {
      log.warn('Slow query detected', { query: e.query, durationMs: e.duration });
    }
  });
}

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  log.info('Database connected');
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  log.info('Database disconnected');
}
