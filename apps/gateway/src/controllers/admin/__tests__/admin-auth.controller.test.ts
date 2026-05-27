import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service / rate-limit mocks ────────────────────────────────────────────────

const mockAdminLoginService      = jest.fn();
const mockCheckAdminRateLimit    = jest.fn();

// ── Mock @abroad-matrimony/auth ───────────────────────────────────────────────
// Error classes are defined inside the factory so the controller's `instanceof`
// checks operate against the same class references that we use to throw in tests.
// Access them via jest.requireMock() after the factory runs.

jest.mock('@abroad-matrimony/auth', () => {
  // Define concrete error classes so instanceof works across controller + test
  class AdminCredentialsError  extends Error { constructor() { super('ADMIN_INVALID_CREDENTIALS');  this.name = 'AdminCredentialsError';  } }
  class AdminTotpRequiredError extends Error { constructor() { super('ADMIN_TOTP_REQUIRED');         this.name = 'AdminTotpRequiredError'; } }
  class AdminTotpInvalidError  extends Error { constructor() { super('ADMIN_TOTP_INVALID');          this.name = 'AdminTotpInvalidError';  } }

  return {
    // ── user auth (stubs for existing routes) ──
    requireAuth: (_req: any, _res: any, next: any) => next(),
    checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    getOtpAdapter: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
    otpVerifyService:    jest.fn().mockResolvedValue({}),
    tokenRefreshService: jest.fn().mockResolvedValue({}),
    revokeForDevice:     jest.fn().mockResolvedValue(undefined),
    revokeAllForUser:    jest.fn().mockResolvedValue(undefined),
    OtpInvalidError:   class OtpInvalidError   extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
    DeviceLimitError:  class DeviceLimitError   extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
    TokenInvalidError: class TokenInvalidError  extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
    TokenReuseError:   class TokenReuseError    extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
    // ── admin auth ──
    checkAdminLoginRateLimit: (...args: unknown[]) => mockCheckAdminRateLimit(...args),
    adminLoginService:        (...args: unknown[]) => mockAdminLoginService(...args),
    AdminCredentialsError,
    AdminTotpRequiredError,
    AdminTotpInvalidError,
  };
});

// Typed accessor for mock error classes (resolved after mock is registered)
const getAuthErrors = () => jest.requireMock('@abroad-matrimony/auth') as {
  AdminCredentialsError:  new () => Error;
  AdminTotpRequiredError: new () => Error;
  AdminTotpInvalidError:  new () => Error;
};

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS:   60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX:      3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = { email: 'admin@abroadmatrimony.com', password: 'SecurePass123!' };

const LOGIN_RESULT = {
  accessToken: 'admin.jwt.token',
  expiresIn: 28800,
  admin: { id: 'admin-uuid-1', email: 'admin@abroadmatrimony.com', name: 'Super Admin', role: 'SUPERADMIN' },
};

const app = createApp();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /admin/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAdminRateLimit.mockResolvedValue({ allowed: true });
    mockAdminLoginService.mockResolvedValue(LOGIN_RESULT);
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  it('returns 200 with accessToken and admin data on valid credentials', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('admin.jwt.token');
    expect(res.body.data.expiresIn).toBe(28800);
    expect(res.body.data.admin.id).toBe('admin-uuid-1');
  });

  it('passes totpCode to adminLoginService when provided', async () => {
    await request(app)
      .post('/admin/auth/login')
      .send({ ...VALID_BODY, totpCode: '123456' });

    expect(mockAdminLoginService).toHaveBeenCalledWith(
      expect.objectContaining({ totpCode: '123456' }),
    );
  });

  // ── Validation errors ────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ password: 'pw' });

    expect(res.status).toBe(400);
    expect(mockAdminLoginService).not.toHaveBeenCalled();
  });

  it('returns 400 when email is not a valid address', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'not-an-email', password: 'pw' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'admin@abroadmatrimony.com' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when totpCode is not exactly 6 digits', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ ...VALID_BODY, totpCode: '12345' }); // 5 digits

    expect(res.status).toBe(400);
  });

  // ── Auth errors ──────────────────────────────────────────────────────────

  it('returns 401 when AdminCredentialsError is thrown', async () => {
    const { AdminCredentialsError } = getAuthErrors();
    mockAdminLoginService.mockRejectedValueOnce(new AdminCredentialsError());

    const res = await request(app)
      .post('/admin/auth/login')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 with FORBIDDEN when AdminTotpRequiredError is thrown', async () => {
    const { AdminTotpRequiredError } = getAuthErrors();
    mockAdminLoginService.mockRejectedValueOnce(new AdminTotpRequiredError());

    const res = await request(app)
      .post('/admin/auth/login')
      .send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 with FORBIDDEN when AdminTotpInvalidError is thrown', async () => {
    const { AdminTotpInvalidError } = getAuthErrors();
    mockAdminLoginService.mockRejectedValueOnce(new AdminTotpInvalidError());

    const res = await request(app)
      .post('/admin/auth/login')
      .send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ── Rate limit ───────────────────────────────────────────────────────────

  it('returns 429 with Retry-After header when rate limit exceeded', async () => {
    mockCheckAdminRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 600 });

    const res = await request(app)
      .post('/admin/auth/login')
      .send(VALID_BODY);

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('600');
    expect(mockAdminLoginService).not.toHaveBeenCalled();
  });

  // ── Unexpected error ─────────────────────────────────────────────────────

  it('returns 500 when adminLoginService throws an unexpected error', async () => {
    mockAdminLoginService.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .post('/admin/auth/login')
      .send(VALID_BODY);

    expect(res.status).toBe(500);
  });
});
