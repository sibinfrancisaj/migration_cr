import request from 'supertest';
import { createApp } from '../../../app.js';

const mockRevokeForDevice = jest.fn();
const mockRevokeAllForUser = jest.fn();

// requireAuth mock — attaches req.user and calls next() by default
let requireAuthBehavior: 'pass' | 'fail401' | 'fail403' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  revokeForDevice: (...args: unknown[]) => mockRevokeForDevice(...args),
  revokeAllForUser: (...args: unknown[]) => mockRevokeAllForUser(...args),
  // Middleware mock: controlled via requireAuthBehavior
  requireAuth: (req: any, res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Auth required.' } });
    }
    if (requireAuthBehavior === 'fail403') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Account suspended.' } });
    }
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  // Stub other exports used by the app module
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService: jest.fn().mockResolvedValue({}),
  tokenRefreshService: jest.fn().mockResolvedValue({}),
  OtpInvalidError:   class OtpInvalidError   extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:  class DeviceLimitError   extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  TokenInvalidError: class TokenInvalidError  extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:   class TokenReuseError    extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
  // Admin auth stubs
  checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  adminLoginService:        jest.fn().mockResolvedValue({}),
  AdminCredentialsError:  class AdminCredentialsError  extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
  AdminTotpRequiredError: class AdminTotpRequiredError extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
  AdminTotpInvalidError:  class AdminTotpInvalidError  extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX: 3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

const app = createApp();

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockRevokeForDevice.mockResolvedValue(undefined);
  });

  it('returns 204 No Content on successful logout', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('calls revokeForDevice with the userId and deviceId from req.user', async () => {
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token');

    expect(mockRevokeForDevice).toHaveBeenCalledWith('user-uuid-1', 'device-uuid-1');
  });

  it('returns 401 when Authorization header is missing', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .post('/api/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(mockRevokeForDevice).not.toHaveBeenCalled();
  });

  it('returns 403 when account is suspended', async () => {
    requireAuthBehavior = 'fail403';

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer suspended.token');

    expect(res.status).toBe(403);
    expect(mockRevokeForDevice).not.toHaveBeenCalled();
  });

  it('returns 500 when revokeForDevice throws', async () => {
    mockRevokeForDevice.mockRejectedValueOnce(new Error('Redis down'));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(500);
  });

  it('propagates X-Request-ID through the response', async () => {
    const customId = 'logout-test-id-1111';
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token')
      .set('X-Request-ID', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});

describe('POST /api/v1/auth/logout/all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockRevokeAllForUser.mockResolvedValue(undefined);
  });

  it('returns 204 No Content on successful logout-all', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
  });

  it('calls revokeAllForUser with the userId from req.user', async () => {
    await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token');

    expect(mockRevokeAllForUser).toHaveBeenCalledWith('user-uuid-1');
  });

  it('returns 401 when Authorization header is missing', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .post('/api/v1/auth/logout/all');

    expect(res.status).toBe(401);
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });

  it('returns 500 when revokeAllForUser throws', async () => {
    mockRevokeAllForUser.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(500);
  });

  it('propagates X-Request-ID through the response', async () => {
    const customId = 'logout-all-test-id-2222';
    const res = await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token')
      .set('X-Request-ID', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});
