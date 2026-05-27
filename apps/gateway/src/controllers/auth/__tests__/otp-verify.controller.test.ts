import request from 'supertest';
import { createApp } from '../../../app.js';
import { UserRole } from '@abroad-matrimony/shared';

const mockOtpVerifyService = jest.fn();

jest.mock('@abroad-matrimony/auth', () => {
  class OtpInvalidError extends Error {
    constructor() { super('OTP_INVALID'); this.name = 'OtpInvalidError'; }
  }
  class DeviceLimitError extends Error {
    constructor() { super('DEVICE_LIMIT_EXCEEDED'); this.name = 'DeviceLimitError'; }
  }
  return {
    checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    getOtpAdapter: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
    otpVerifyService: (...args: unknown[]) => mockOtpVerifyService(...args),
    OtpInvalidError,
    DeviceLimitError,
    // Pass-through stubs — not exercised by OTP verify tests
    requireAuth:         (_req: unknown, _res: unknown, next: () => void) => next(),
    tokenRefreshService: jest.fn().mockResolvedValue({}),
    revokeForDevice:     jest.fn().mockResolvedValue(undefined),
    revokeAllForUser:    jest.fn().mockResolvedValue(undefined),
    TokenInvalidError: class TokenInvalidError extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
    TokenReuseError:   class TokenReuseError   extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
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

const VALID_BODY = {
  phone: '+919876543210',
  code: '123456',
  deviceFingerprint: 'fp-abc-12345678',
};

const SUCCESS_RESULT = {
  accessToken: 'access.token',
  refreshToken: 'refresh.token',
  expiresIn: 900,
  user: {
    id: 'user-1',
    phone: '+919876543210',
    role: UserRole.USER,
    isPhoneVerified: true,
    isEmailVerified: false,
    createdAt: new Date().toISOString(),
  },
};

// Helper: get error constructors from the mock
function getMockErrors() {
  return jest.requireMock('@abroad-matrimony/auth') as {
    OtpInvalidError: new () => Error;
    DeviceLimitError: new () => Error;
  };
}

describe('POST /api/v1/auth/otp/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOtpVerifyService.mockResolvedValue(SUCCESS_RESULT);
  });

  it('returns 200 with tokens and user on valid OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('access.token');
    expect(res.body.data.refreshToken).toBe('refresh.token');
    expect(res.body.data.expiresIn).toBe(900);
    expect(res.body.data.user.id).toBe('user-1');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ code: '123456', deviceFingerprint: 'fp-abc-12345678' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when OTP code is not 6 digits', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ ...VALID_BODY, code: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when OTP code contains letters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ ...VALID_BODY, code: '12345a' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceFingerprint is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '+919876543210', code: '123456' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when OTP is invalid or expired', async () => {
    const { OtpInvalidError } = getMockErrors();
    mockOtpVerifyService.mockRejectedValueOnce(new OtpInvalidError());

    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when device limit is exceeded', async () => {
    const { DeviceLimitError } = getMockErrors();
    mockOtpVerifyService.mockRejectedValueOnce(new DeviceLimitError());

    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 500 when a downstream dependency throws', async () => {
    mockOtpVerifyService.mockRejectedValueOnce(new Error('DB connection failed'));

    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send(VALID_BODY);

    expect(res.status).toBe(500);
  });

  it('propagates X-Request-ID header through the response', async () => {
    const customId = 'verify-test-id-9999';
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('X-Request-ID', customId)
      .send(VALID_BODY);

    expect(res.headers['x-request-id']).toBe(customId);
    expect(res.body.requestId).toBe(customId);
  });
});
