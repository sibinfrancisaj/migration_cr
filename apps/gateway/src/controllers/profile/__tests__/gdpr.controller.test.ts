import request from 'supertest';
import { createApp } from '../../../app.js';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: { user: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', role: 'MEMBER' };
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdminRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  exportUserData: jest.fn(),
  deleteAccount: jest.fn(),
  AccountAlreadyDeletedError: class AccountAlreadyDeletedError extends Error {
    constructor() { super('ACCOUNT_ALREADY_DELETED'); this.name = 'AccountAlreadyDeletedError'; }
  },
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
jest.mock('@abroad-matrimony/notification', () => ({ enqueueNotification: jest.fn(), getNotificationPreferences: jest.fn().mockResolvedValue({ emailEnabled: true, smsEnabled: true, pushEnabled: true, marketingEnabled: true }), updateNotificationPreferences: jest.fn() }));
jest.mock('@abroad-matrimony/matching', () => ({ getPartnerPreferences: jest.fn(), setPartnerPreferences: jest.fn() }));

const { exportUserData, deleteAccount, AccountAlreadyDeletedError } = jest.requireMock('@abroad-matrimony/auth') as {
  exportUserData: jest.Mock;
  deleteAccount: jest.Mock;
  AccountAlreadyDeletedError: new () => Error;
};

const app = createApp();

describe('POST /api/v1/profile/export-data', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns export summary', async () => {
    exportUserData.mockResolvedValue({ exportedAt: '2026-07-27T00:00:00.000Z', sections: ['account: 1 record'], note: 'Firestore...' });
    const res = await request(app).post('/api/v1/profile/export-data');
    expect(res.status).toBe(200);
    expect(res.body.data.sections).toBeDefined();
  });

  it('500 — passes unexpected errors to error handler', async () => {
    exportUserData.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/api/v1/profile/export-data');
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — deletes account successfully', async () => {
    deleteAccount.mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/profile');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('409 — AccountAlreadyDeletedError', async () => {
    deleteAccount.mockRejectedValue(new AccountAlreadyDeletedError());
    const res = await request(app).delete('/api/v1/profile');
    expect(res.status).toBe(409);
  });
});
