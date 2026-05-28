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
