import request from 'supertest';
import { createApp } from '../../../app.js';

const mockCheckAndIncrOtpRateLimit = jest.fn();
const mockGetOtpAdapter = jest.fn();
const mockSend = jest.fn();

jest.mock('@abroad-matrimony/auth', () => ({
  checkAndIncrOtpRateLimit: (...args: unknown[]) => mockCheckAndIncrOtpRateLimit(...args),
  getOtpAdapter: () => mockGetOtpAdapter(),
  // Pass-through stubs — not exercised by OTP request tests
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  otpVerifyService:    jest.fn().mockResolvedValue({}),
  tokenRefreshService: jest.fn().mockResolvedValue({}),
  revokeForDevice:     jest.fn().mockResolvedValue(undefined),
  revokeAllForUser:    jest.fn().mockResolvedValue(undefined),
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

describe('POST /api/v1/auth/otp/request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOtpAdapter.mockReturnValue({ send: mockSend });
    mockSend.mockResolvedValue(undefined);
    mockCheckAndIncrOtpRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 200 with message and expiresInSeconds for valid E.164 phone', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+919876543210' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBeDefined();
    expect(res.body.data.expiresInSeconds).toBe(600);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 400 when phone is missing', async () => {
    const res = await request(app).post('/api/v1/auth/otp/request').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when phone is not E.164 format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '09876543210' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when phone has no country code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '9876543210' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 with Retry-After header when rate limit exceeded', async () => {
    mockCheckAndIncrOtpRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 3540,
    });

    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+919876543210' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBe('3540');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 500 when OTP adapter throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Twilio unavailable'));

    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+919876543210' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('propagates requestId from X-Request-ID header', async () => {
    const customId = 'test-request-id-12345';

    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .set('X-Request-ID', customId)
      .send({ phone: '+919876543210' });

    expect(res.headers['x-request-id']).toBe(customId);
    expect(res.body.requestId).toBe(customId);
  });

  it('does not call OTP adapter when phone is invalid', async () => {
    await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: 'invalid' });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not call OTP adapter when rate limit is exceeded', async () => {
    mockCheckAndIncrOtpRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 100 });

    await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+919876543210' });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
