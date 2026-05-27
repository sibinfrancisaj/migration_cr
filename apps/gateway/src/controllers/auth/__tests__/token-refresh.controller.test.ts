import request from 'supertest';
import { createApp } from '../../../app.js';

const mockTokenRefreshService = jest.fn();

jest.mock('@abroad-matrimony/auth', () => {
  class TokenInvalidError extends Error {
    constructor() { super('TOKEN_INVALID'); this.name = 'TokenInvalidError'; }
  }
  class TokenReuseError extends Error {
    constructor() { super('TOKEN_REUSE_DETECTED'); this.name = 'TokenReuseError'; }
  }
  return {
    tokenRefreshService: (...args: unknown[]) => mockTokenRefreshService(...args),
    TokenInvalidError,
    TokenReuseError,
    // Pass-through stubs — not exercised by token refresh tests
    requireAuth:              (_req: unknown, _res: unknown, next: () => void) => next(),
    checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    getOtpAdapter:            jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
    otpVerifyService:         jest.fn().mockResolvedValue({}),
    revokeForDevice:          jest.fn().mockResolvedValue(undefined),
    revokeAllForUser:         jest.fn().mockResolvedValue(undefined),
    OtpInvalidError:  class OtpInvalidError  extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
    DeviceLimitError: class DeviceLimitError extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
    // Admin auth stubs
    checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    adminLoginService:        jest.fn().mockResolvedValue({}),
    AdminCredentialsError:  class AdminCredentialsError  extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
    AdminTotpRequiredError: class AdminTotpRequiredError extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
    AdminTotpInvalidError:  class AdminTotpInvalidError  extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
  };
});

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

const VALID_BODY = { refreshToken: 'valid.refresh.jwt.token' };

const SUCCESS_RESULT = {
  accessToken: 'new.access.token',
  refreshToken: 'new.refresh.token',
  expiresIn: 900,
};

function getMockErrors() {
  return jest.requireMock('@abroad-matrimony/auth') as {
    TokenInvalidError: new () => Error;
    TokenReuseError: new () => Error;
  };
}

describe('POST /api/v1/auth/token/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenRefreshService.mockResolvedValue(SUCCESS_RESULT);
  });

  it('returns 200 with new token pair on valid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('new.access.token');
    expect(res.body.data.refreshToken).toBe('new.refresh.token');
    expect(res.body.data.expiresIn).toBe(900);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 400 when refreshToken field is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when refreshToken is an empty string', async () => {
    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when refresh token JWT is invalid or expired', async () => {
    const { TokenInvalidError } = getMockErrors();
    mockTokenRefreshService.mockRejectedValueOnce(new TokenInvalidError());

    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 (not 409 or 403) on token reuse — same response as invalid to avoid leaking info', async () => {
    const { TokenReuseError } = getMockErrors();
    mockTokenRefreshService.mockRejectedValueOnce(new TokenReuseError());

    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 500 when a downstream dependency throws', async () => {
    mockTokenRefreshService.mockRejectedValueOnce(new Error('Redis connection lost'));

    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send(VALID_BODY);

    expect(res.status).toBe(500);
  });

  it('propagates X-Request-ID header through the response', async () => {
    const customId = 'refresh-test-id-7777';
    const res = await request(app)
      .post('/api/v1/auth/token/refresh')
      .set('X-Request-ID', customId)
      .send(VALID_BODY);

    expect(res.headers['x-request-id']).toBe(customId);
    expect(res.body.requestId).toBe(customId);
  });
});
