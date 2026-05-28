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
    requireRole:              jest.fn(() => (_req: any, _res: any, next: any) => next()),
    requireAdminRole:         jest.fn(() => (_req: any, _res: any, next: any) => next()),
    checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    adminLoginService:        jest.fn().mockResolvedValue({}),
    AdminCredentialsError:  class AdminCredentialsError  extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
    AdminTotpRequiredError: class AdminTotpRequiredError extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
    AdminTotpInvalidError:  class AdminTotpInvalidError  extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
    checkTrustedDeviceRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    trustedDeviceLoginService:   jest.fn().mockResolvedValue({}),
    DeviceNotTrustedError:       class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
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
