import request from 'supertest';
import { createApp } from '../../../app.js';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: { user: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', role: 'MEMBER' };
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdminRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: jest.fn().mockReturnValue({ PORT: 3000, CORS_ORIGINS: ['*'], REDIS_URL: 'redis://localhost:6379', SEEDER_SECRET: undefined }),
  FeatureFlagService: class { async isEnabled() { return false; } },
}));
jest.mock('@abroad-matrimony/db', () => ({ prisma: {} }));
jest.mock('@abroad-matrimony/cache', () => ({ getRedisClient: jest.fn() }));
jest.mock('@abroad-matrimony/event-bus', () => ({ publishEvent: jest.fn() }));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@abroad-matrimony/notification', () => ({
  enqueueNotification: jest.fn(),
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));

jest.mock('@abroad-matrimony/matching', () => ({
  getPartnerPreferences: jest.fn(),
  setPartnerPreferences: jest.fn(),
}));

const { getNotificationPreferences, updateNotificationPreferences } = jest.requireMock('@abroad-matrimony/notification') as {
  getNotificationPreferences: jest.Mock;
  updateNotificationPreferences: jest.Mock;
};

const app = createApp();

describe('GET /api/v1/notifications/preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns preferences', async () => {
    getNotificationPreferences.mockResolvedValue({ emailEnabled: true, smsEnabled: true, pushEnabled: true, marketingEnabled: true });
    const res = await request(app).get('/api/v1/notifications/preferences');
    expect(res.status).toBe(200);
    expect(res.body.data.emailEnabled).toBe(true);
  });

  it('500 — service error propagates', async () => {
    getNotificationPreferences.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/v1/notifications/preferences');
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/notifications/preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — updates preferences', async () => {
    updateNotificationPreferences.mockResolvedValue({ emailEnabled: false, smsEnabled: true, pushEnabled: true, marketingEnabled: true });
    const res = await request(app).put('/api/v1/notifications/preferences').send({ emailEnabled: false });
    expect(res.status).toBe(200);
    expect(res.body.data.emailEnabled).toBe(false);
  });

  it('400 — validation error when body is empty', async () => {
    const res = await request(app).put('/api/v1/notifications/preferences').send({});
    expect(res.status).toBe(400);
  });
});
