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
}));

jest.mock('@abroad-matrimony/matching', () => ({
  getPartnerPreferences: jest.fn(),
  setPartnerPreferences: jest.fn(),
}));

const { getPartnerPreferences, setPartnerPreferences } = jest.requireMock('@abroad-matrimony/matching') as {
  getPartnerPreferences: jest.Mock;
  setPartnerPreferences: jest.Mock;
};

const app = createApp();

const emptyPrefs = { ageMin: null, ageMax: null, countries: [], cities: [], religions: [] };

describe('GET /api/v1/profile/partner-preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns partner preferences', async () => {
    getPartnerPreferences.mockResolvedValue({ ageMin: 25, ageMax: 35, countries: ['GB'], cities: [], religions: [] });
    const res = await request(app).get('/api/v1/profile/partner-preferences');
    expect(res.status).toBe(200);
    expect(res.body.data.ageMin).toBe(25);
  });

  it('200 — returns empty defaults when no preferences saved', async () => {
    getPartnerPreferences.mockResolvedValue(emptyPrefs);
    const res = await request(app).get('/api/v1/profile/partner-preferences');
    expect(res.status).toBe(200);
    expect(res.body.data.countries).toEqual([]);
  });
});

describe('PUT /api/v1/profile/partner-preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — updates partner preferences', async () => {
    setPartnerPreferences.mockResolvedValue({ ageMin: 25, ageMax: 35, countries: ['DE'], cities: [], religions: [] });
    const res = await request(app).put('/api/v1/profile/partner-preferences').send({ ageMin: 25, ageMax: 35, countries: ['DE'] });
    expect(res.status).toBe(200);
    expect(res.body.data.ageMin).toBe(25);
  });

  it('400 — ageMin > ageMax', async () => {
    const res = await request(app).put('/api/v1/profile/partner-preferences').send({ ageMin: 40, ageMax: 30 });
    expect(res.status).toBe(400);
  });

  it('400 — ageMin below 18', async () => {
    const res = await request(app).put('/api/v1/profile/partner-preferences').send({ ageMin: 17 });
    expect(res.status).toBe(400);
  });
});
