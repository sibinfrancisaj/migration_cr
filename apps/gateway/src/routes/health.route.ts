import { Router } from 'express';
import { getRedisClient } from '@abroad-matrimony/cache';
import { prisma } from '@abroad-matrimony/db';
import type { ApiResponse } from '@abroad-matrimony/shared';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['database'] = 'ok';
  } catch {
    checks['database'] = 'error';
  }

  try {
    await getRedisClient().ping();
    checks['redis'] = 'ok';
  } catch {
    checks['redis'] = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 200 : 503;

  const body: ApiResponse = {
    success: allOk,
    data: { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
  };
  res.status(status).json(body);
});
