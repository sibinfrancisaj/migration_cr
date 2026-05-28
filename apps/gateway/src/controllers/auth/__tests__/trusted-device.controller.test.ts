import request from 'supertest';
import { createApp } from '../../../app.js';
import { UserRole } from '@abroad-matrimony/shared';

// ── Spies ─────────────────────────────────────────────────────────────────────

const mockTrustedDeviceLogin  = jest.fn();
const mockTrustedDeviceRateLimit = jest.fn();

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth:      (_req: any, _res: any, next: any) => next(),
  requireRole:      jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  checkAndIncrOtpRateLimit:      jest.fn().mockResolvedValue({ allowed: true }),
  checkTrustedDeviceRateLimit:   (...a: any[]) => mockTrustedDeviceRateLimit(...a),
  getOtpAdapter:                 jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService:              jest.fn().mockResolvedValue({}),
  trustedDeviceLoginService:     (...a: any[]) => mockTrustedDeviceLogin(...a),
  tokenRefreshService:           jest.fn().mockResolvedValue({}),
  revokeForDevice:               jest.fn().mockResolvedValue(undefined),
  revokeAllForUser:              jest.fn().mockResolvedValue(undefined),
  OtpInvalidError:          class extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:         class extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  DeviceNotTrustedError:    class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
  TokenInvalidError:        class extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:          class extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
  checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  adminLoginService:        jest.fn().mockResolvedValue({}),
  AdminCredentialsError:    class extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
  AdminTotpRequiredError:   class extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
  AdminTotpInvalidError:    class extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
}));

jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations:       jest.fn().mockResolvedValue([]),
  getConversation:         jest.fn().mockResolvedValue({}),
  getConversationMessages: jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:             jest.fn().mockResolvedValue({}),
  getUploadUrl:            jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  markConversationRead:    jest.fn().mockResolvedValue(undefined),
  createFirebaseToken:     jest.fn().mockResolvedValue('token'),
  FirebaseNotConfiguredError: class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage:             jest.fn().mockResolvedValue({}),
  MessageNotFoundError:    class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:     class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:           class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  getAdminFlagSummary:     jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag:             jest.fn().mockResolvedValue({}),
  FlagNotFoundError:       class extends Error { constructor() { super(); this.name = 'FlagNotFoundError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV:                'test',
    CORS_ORIGINS:            ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS:    60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX:      3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  phone:             '+919876543210',
  deviceFingerprint: '550e8400-e29b-41d4-a716-446655440000',
};

const TOKEN_RESULT = {
  accessToken:  'access-token-xyz',
  refreshToken: 'refresh-token-xyz',
  expiresIn:    900,
  user: {
    id:              'user-uuid-1',
    phone:           '+919876543210',
    role:            UserRole.USER,
    isPhoneVerified: true,
    isEmailVerified: false,
    createdAt:       new Date().toISOString(),
  },
};

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

describe('POST /api/v1/auth/trusted-device', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrustedDeviceRateLimit.mockResolvedValue({ allowed: true });
    mockTrustedDeviceLogin.mockResolvedValue(TOKEN_RESULT);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns 200 with JWT pair on trusted device', async () => {
    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('access-token-xyz');
    expect(res.body.data.user.id).toBe('user-uuid-1');
    expect(mockTrustedDeviceRateLimit).toHaveBeenCalledWith(VALID_BODY.phone);
    expect(mockTrustedDeviceLogin).toHaveBeenCalledWith({
      phone:             VALID_BODY.phone,
      deviceFingerprint: VALID_BODY.deviceFingerprint,
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send({ deviceFingerprint: VALID_BODY.deviceFingerprint });

    expect(res.status).toBe(400);
    expect(mockTrustedDeviceLogin).not.toHaveBeenCalled();
  });

  it('returns 400 when phone is not E.164', async () => {
    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send({ ...VALID_BODY, phone: '9876543210' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceFingerprint is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send({ phone: VALID_BODY.phone });

    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceFingerprint is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send({ ...VALID_BODY, deviceFingerprint: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  // ── Auth failures ──────────────────────────────────────────────────────────

  it('returns 401 when device is not trusted / unknown', async () => {
    const mock = jest.requireMock('@abroad-matrimony/auth') as {
      DeviceNotTrustedError: new () => Error;
    };
    mockTrustedDeviceLogin.mockRejectedValue(new mock.DeviceNotTrustedError());

    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    mockTrustedDeviceRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 1800 });

    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send(VALID_BODY);

    expect(res.status).toBe(429);
    expect(mockTrustedDeviceLogin).not.toHaveBeenCalled();
  });

  // ── Downstream error ───────────────────────────────────────────────────────

  it('returns 500 on unexpected service error', async () => {
    mockTrustedDeviceLogin.mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/v1/auth/trusted-device')
      .send(VALID_BODY);

    expect(res.status).toBe(500);
  });
});
