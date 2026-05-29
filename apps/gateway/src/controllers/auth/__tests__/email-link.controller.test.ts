import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Auth mock (contains sendMagicLink / verifyMagicLink) ───────────────────────

const mockSendMagicLink  = jest.fn();
const mockVerifyMagicLink = jest.fn();

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  requireRole:              jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole:         jest.fn(() => (_req: any, _res: any, next: any) => next()),
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter:            jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService:         jest.fn().mockResolvedValue({}),
  tokenRefreshService:      jest.fn().mockResolvedValue({}),
  revokeForDevice:          jest.fn().mockResolvedValue(undefined),
  revokeAllForUser:         jest.fn().mockResolvedValue(undefined),
  OtpInvalidError:          class extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:         class extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  TokenInvalidError:        class extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:          class extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
  checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  adminLoginService:        jest.fn().mockResolvedValue({}),
  AdminCredentialsError:    class extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
  AdminTotpRequiredError:   class extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
  AdminTotpInvalidError:    class extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
  checkTrustedDeviceRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  trustedDeviceLoginService:   jest.fn().mockResolvedValue({}),
  DeviceNotTrustedError:       class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
  sendMagicLink:               (...a: unknown[]) => mockSendMagicLink(...a),
  verifyMagicLink:             (...a: unknown[]) => mockVerifyMagicLink(...a),
  MagicLinkUserNotFoundError:  class extends Error { constructor() { super(); this.name = 'MagicLinkUserNotFoundError'; } },
  MagicLinkInvalidError:       class extends Error { constructor() { super(); this.name = 'MagicLinkInvalidError'; } },
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

jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations: jest.fn().mockResolvedValue([]),
  getConversation: jest.fn().mockResolvedValue({}),
  getConversationMessages: jest.fn().mockResolvedValue({ messages: [], cursor: null }),
  sendMessage: jest.fn().mockResolvedValue({}),
  getUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead: jest.fn().mockResolvedValue(undefined),
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  createFirebaseToken: jest.fn().mockResolvedValue('mock-firebase-token'),
  FirebaseNotConfiguredError:  class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage: jest.fn().mockResolvedValue({ id: 'flag-1', status: 'OPEN' }),
  MessageNotFoundError:        class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:         class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:               class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  getAdminFlagSummary: jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag: jest.fn().mockResolvedValue({ id: 'flag-1', status: 'RESOLVED' }),
  FlagNotFoundError:           class extends Error { constructor() { super(); this.name = 'FlagNotFoundError'; } },
}));

jest.mock('@abroad-matrimony/payment', () => ({
  createMembershipCheckout:      jest.fn().mockResolvedValue({ checkoutUrl: '' }),
  createDiamondCheckout:         jest.fn().mockResolvedValue({ checkoutUrl: '' }),
  createRazorpayMembershipOrder: jest.fn().mockResolvedValue({}),
  captureRazorpayPayment:        jest.fn().mockResolvedValue(undefined),
  processStripeWebhook:          jest.fn().mockResolvedValue(undefined),
  processRazorpayWebhook:        jest.fn().mockResolvedValue(undefined),
  getActiveMembership:           jest.fn().mockResolvedValue(null),
  getDiamondBalance:             jest.fn().mockResolvedValue(0),
  spendDiamonds:                 jest.fn().mockResolvedValue(undefined),
  markPaymentRefunded:           jest.fn().mockResolvedValue(undefined),
  refundDiamonds:                jest.fn().mockResolvedValue(undefined),
  getCreditTransactions:         jest.fn().mockResolvedValue([]),
  DIAMOND_PACKAGES: {},
  PaymentSignatureError:         class extends Error { constructor() { super(); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:          class extends Error { constructor() { super(); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:    class extends Error { constructor() { super(); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:     class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError:  class extends Error { constructor() { super(); this.name = 'MembershipAlreadyActiveError'; } },
}));

// Re-import error classes from the auth mock so instanceof checks work
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMock = jest.requireMock('@abroad-matrimony/auth') as any;
const MagicLinkUserNotFoundError = authMock.MagicLinkUserNotFoundError as typeof Error;
const MagicLinkInvalidError      = authMock.MagicLinkInvalidError      as typeof Error;

const app = createApp();

const VALID_TOKEN   = 'a'.repeat(64);
const VALID_DEVICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TOKENS_DTO = { accessToken: 'tok-access', refreshToken: 'tok-refresh' };

// ── POST /api/v1/auth/email/link ──────────────────────────────────────────────

describe('POST /api/v1/auth/email/link', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with generic message on success', async () => {
    mockSendMagicLink.mockResolvedValue({ devToken: undefined });

    const res = await request(app)
      .post('/api/v1/auth/email/link')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.message).toMatch(/magic link/i);
  });

  it('returns devToken in dev environment', async () => {
    mockSendMagicLink.mockResolvedValue({ devToken: 'dev-token-123' });

    const res = await request(app)
      .post('/api/v1/auth/email/link')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.devToken).toBe('dev-token-123');
  });

  it('returns 200 even when user email is not found (anti-enumeration)', async () => {
    mockSendMagicLink.mockRejectedValueOnce(new MagicLinkUserNotFoundError());

    const res = await request(app)
      .post('/api/v1/auth/email/link')
      .send({ email: 'notfound@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/v1/auth/email/link').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/email/link')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockSendMagicLink.mockRejectedValueOnce(new Error('Email service down'));

    const res = await request(app)
      .post('/api/v1/auth/email/link')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/auth/email/verify ────────────────────────────────────────────

describe('POST /api/v1/auth/email/verify', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with token pair on valid token', async () => {
    mockVerifyMagicLink.mockResolvedValue(TOKENS_DTO);

    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: VALID_TOKEN, deviceId: VALID_DEVICE_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('tok-access');
    expect(mockVerifyMagicLink).toHaveBeenCalledWith(VALID_TOKEN, VALID_DEVICE_ID);
  });

  it('returns 401 when token is invalid or expired', async () => {
    mockVerifyMagicLink.mockRejectedValueOnce(new MagicLinkInvalidError());

    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: VALID_TOKEN, deviceId: VALID_DEVICE_ID });

    expect(res.status).toBe(401);
  });

  it('returns 400 when token is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: 'short', deviceId: VALID_DEVICE_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: VALID_TOKEN, deviceId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ deviceId: VALID_DEVICE_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: VALID_TOKEN });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockVerifyMagicLink.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: VALID_TOKEN, deviceId: VALID_DEVICE_ID });

    expect(res.status).toBe(500);
  });
});
