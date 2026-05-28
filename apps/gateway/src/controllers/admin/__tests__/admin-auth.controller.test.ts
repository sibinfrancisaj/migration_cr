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
    requireRole:              jest.fn(() => (_req: any, _res: any, next: any) => next()),
    requireAdminRole:         jest.fn(() => (_req: any, _res: any, next: any) => next()),
    checkAdminLoginRateLimit: (...args: unknown[]) => mockCheckAdminRateLimit(...args),
    adminLoginService:        (...args: unknown[]) => mockAdminLoginService(...args),
    AdminCredentialsError,
    AdminTotpRequiredError,
    AdminTotpInvalidError,
    // ── trusted device (stubs) ──
    checkTrustedDeviceRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    trustedDeviceLoginService:   jest.fn().mockResolvedValue({}),
    DeviceNotTrustedError:       class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
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

// ── Messaging mock (conversations router registered in routes/index.ts) ────────
jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations:        jest.fn().mockResolvedValue([]),
  getConversation:          jest.fn().mockResolvedValue({}),
  getConversationMessages:  jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:              jest.fn().mockResolvedValue({}),
  getUploadUrl:             jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError: class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError: class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:  class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead:       jest.fn().mockResolvedValue(undefined),
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  createFirebaseToken:         jest.fn().mockResolvedValue('mock-firebase-token'),
  FirebaseNotConfiguredError:  class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage:                 jest.fn().mockResolvedValue({ id: 'flag-1', status: 'OPEN' }),
  MessageNotFoundError:        class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:         class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:               class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  getAdminFlagSummary:         jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag:                 jest.fn().mockResolvedValue({ id: 'flag-1', status: 'RESOLVED' }),
  FlagNotFoundError:           class extends Error { constructor() { super(); this.name = 'FlagNotFoundError'; } },
}));

// ── Payment mock (payment router registered in routes/index.ts) ───────────────
jest.mock('@abroad-matrimony/payment', () => ({
  createMembershipCheckout:      jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.mock/session', sessionId: 'cs_mock_123' }),
  createDiamondCheckout:         jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.mock/diamonds', sessionId: 'cs_mock_diamond' }),
  createRazorpayMembershipOrder: jest.fn().mockResolvedValue({ orderId: 'order_mock_123', amount: 99900, currency: 'INR', keyId: 'rzp_test_mock' }),
  captureRazorpayPayment:        jest.fn().mockResolvedValue(undefined),
  processStripeWebhook:          jest.fn().mockResolvedValue(undefined),
  processRazorpayWebhook:        jest.fn().mockResolvedValue(undefined),
  getActiveMembership:           jest.fn().mockResolvedValue(null),
  getDiamondBalance:             jest.fn().mockResolvedValue(0),
  spendDiamonds:                 jest.fn().mockResolvedValue(0),
  markPaymentRefunded:           jest.fn().mockResolvedValue(undefined),
  refundDiamonds:                jest.fn().mockResolvedValue(0),
  DIAMOND_PACKAGES:              { DIAMONDS_50: { packageKey: 'DIAMONDS_50', diamonds: 50, amountPaise: 49900, currency: 'INR', description: '50 Diamonds' } },
  PaymentSignatureError:         class extends Error { constructor() { super('Payment signature verification failed'); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:          class extends Error { constructor() { super('PAYMENT_NOT_FOUND'); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:    class extends Error { constructor() { super('INVALID_DIAMOND_PACKAGE'); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:     class extends Error { constructor() { super('INSUFFICIENT_DIAMONDS'); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError:  class extends Error { constructor() { super('MEMBERSHIP_ALREADY_ACTIVE'); this.name = 'MembershipAlreadyActiveError'; } },
}));

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
