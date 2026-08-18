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
  getNotificationPreferences: jest.fn().mockResolvedValue({ emailEnabled: true, smsEnabled: true, pushEnabled: true, marketingEnabled: true }),
  updateNotificationPreferences: jest.fn(),
  processUnsubscribe: jest.fn(),
  resubscribeEmail: jest.fn(),
  UnsubscribeTokenInvalidError: class UnsubscribeTokenInvalidError extends Error {
    constructor() { super('UNSUBSCRIBE_TOKEN_INVALID'); this.name = 'UnsubscribeTokenInvalidError'; }
  },
}));

jest.mock('@abroad-matrimony/matching', () => ({
  getPartnerPreferences: jest.fn().mockResolvedValue({ ageMin: null, ageMax: null, countries: [], cities: [], religions: [] }),
  setPartnerPreferences: jest.fn(),
}));

const { processUnsubscribe, resubscribeEmail, UnsubscribeTokenInvalidError } = jest.requireMock('@abroad-matrimony/notification') as {
  processUnsubscribe: jest.Mock;
  resubscribeEmail: jest.Mock;
  UnsubscribeTokenInvalidError: new () => Error;
};

const app = createApp();

describe('GET /api/v1/auth/unsubscribe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — valid token', async () => {
    processUnsubscribe.mockResolvedValue({ userId: 'u1' });
    const res = await request(app).get('/api/v1/auth/unsubscribe?token=valid-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('400 — missing token query param', async () => {
    const res = await request(app).get('/api/v1/auth/unsubscribe');
    expect(res.status).toBe(400);
  });

  it('400 — invalid / tampered token', async () => {
    processUnsubscribe.mockRejectedValue(new UnsubscribeTokenInvalidError());
    const res = await request(app).get('/api/v1/auth/unsubscribe?token=bad-token');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/resubscribe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — resubscribes authenticated user', async () => {
    resubscribeEmail.mockResolvedValue(undefined);
    const res = await request(app).post('/api/v1/auth/resubscribe');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
