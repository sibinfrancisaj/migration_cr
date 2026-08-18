import request from 'supertest';
import { createApp } from '../../../app.js';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdminRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: jest.fn().mockReturnValue({
    PORT: 3000, CORS_ORIGINS: ['*'], REDIS_URL: 'redis://localhost:6379', SEEDER_SECRET: undefined,
  }),
  FeatureFlagService: class { async isEnabled() { return false; } },
}));
jest.mock('@abroad-matrimony/db', () => ({ prisma: {} }));
jest.mock('@abroad-matrimony/cache', () => ({ getRedisClient: jest.fn() }));
jest.mock('@abroad-matrimony/event-bus', () => ({ publishEvent: jest.fn() }));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Mock the queue health service ─────────────────────────────────────────────

jest.mock('../../../services/queue-health.service.js', () => ({
  getQueueHealth: jest.fn(),
}));

const { getQueueHealth } = jest.requireMock('../../../services/queue-health.service.js') as {
  getQueueHealth: jest.Mock;
};

const MOCK_HEALTH = {
  queues: [
    { name: 'matching',            waiting: 0, active: 1, delayed: 0, failed: 0, paused: 0, workerCount: 1 },
    { name: 'notification',        waiting: 3, active: 0, delayed: 0, failed: 1, paused: 0, workerCount: 1 },
    { name: 'profile-intelligence',waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0, workerCount: 1 },
    { name: 'weekly-intros',       waiting: 0, active: 0, delayed: 1, failed: 0, paused: 0, workerCount: 1 },
    { name: 'events',              waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0, workerCount: 0 },
    { name: 'renewal-reminder',    waiting: 0, active: 0, delayed: 5, failed: 0, paused: 0, workerCount: 1 },
    { name: 'seeder:drip',         waiting: 0, active: 0, delayed: 1, failed: 0, paused: 0, workerCount: 1 },
    { name: 'seeder:activity',     waiting: 0, active: 0, delayed: 1, failed: 0, paused: 0, workerCount: 1 },
    { name: 'seeder:match-recompute', waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0, workerCount: 0 },
  ],
  checkedAt: '2026-07-28T09:00:00.000Z',
};

const app = createApp();

describe('GET /admin/system/queue-health', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns queue stats for all monitored queues', async () => {
    getQueueHealth.mockResolvedValue(MOCK_HEALTH);

    const res = await request(app).get('/admin/system/queue-health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.queues).toHaveLength(9);
    expect(res.body.data.checkedAt).toBe('2026-07-28T09:00:00.000Z');
  });

  it('includes expected queue names', async () => {
    getQueueHealth.mockResolvedValue(MOCK_HEALTH);

    const res = await request(app).get('/admin/system/queue-health');

    const names: string[] = res.body.data.queues.map((q: { name: string }) => q.name);
    expect(names).toContain('matching');
    expect(names).toContain('notification');
    expect(names).toContain('profile-intelligence');
    expect(names).toContain('weekly-intros');
    expect(names).toContain('renewal-reminder');
    expect(names).toContain('seeder:drip');
  });

  it('each queue entry has the required stat fields', async () => {
    getQueueHealth.mockResolvedValue(MOCK_HEALTH);

    const res = await request(app).get('/admin/system/queue-health');

    for (const q of res.body.data.queues) {
      expect(q).toHaveProperty('name');
      expect(q).toHaveProperty('waiting');
      expect(q).toHaveProperty('active');
      expect(q).toHaveProperty('delayed');
      expect(q).toHaveProperty('failed');
      expect(q).toHaveProperty('paused');
      expect(q).toHaveProperty('workerCount');
    }
  });

  it('500 — propagates errors from the service', async () => {
    getQueueHealth.mockRejectedValue(new Error('Redis connection refused'));

    const res = await request(app).get('/admin/system/queue-health');

    expect(res.status).toBe(500);
  });
});
