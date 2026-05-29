import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockGetMatchTuning = jest.fn();
const mockSetMatchTuning = jest.fn();

jest.mock('@abroad-matrimony/matching', () => ({
  getMatchTuning:              (...a: unknown[]) => mockGetMatchTuning(...a),
  setMatchTuning:              (...a: unknown[]) => mockSetMatchTuning(...a),
  computeCompatibilityScore:   jest.fn().mockResolvedValue(0),
  getDiscoveryFeed:            jest.fn().mockResolvedValue({ profiles: [], cursor: null }),
  FeatureFlagService:          jest.fn(),
}));

// ── Standard gateway mocks ─────────────────────────────────────────────────────

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
  sendMagicLink:               jest.fn().mockResolvedValue({}),
  verifyMagicLink:             jest.fn().mockResolvedValue({}),
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

const app = createApp();

const USER_ID    = 'user-uuid-1';
const TUNING_DTO = { userId: USER_ID, weights: { faith: 1.5, kids: 2.0 } };

// ── GET /api/v1/matches/tuning ────────────────────────────────────────────────

describe('GET /api/v1/matches/tuning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with tuning DTO', async () => {
    mockGetMatchTuning.mockResolvedValue(TUNING_DTO);

    const res = await request(app).get('/api/v1/matches/tuning');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.weights).toEqual({ faith: 1.5, kids: 2.0 });
    expect(mockGetMatchTuning).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when service throws', async () => {
    mockGetMatchTuning.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/matches/tuning');
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/v1/matches/tuning ────────────────────────────────────────────────

describe('PUT /api/v1/matches/tuning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated tuning DTO', async () => {
    mockSetMatchTuning.mockResolvedValue(TUNING_DTO);

    const res = await request(app)
      .put('/api/v1/matches/tuning')
      .send({ weights: { faith: 1.5, kids: 2.0 } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSetMatchTuning).toHaveBeenCalledWith(USER_ID, { faith: 1.5, kids: 2.0 });
  });

  it('returns 400 when weights object is empty', async () => {
    const res = await request(app)
      .put('/api/v1/matches/tuning')
      .send({ weights: {} });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a weight value is below minimum (0.1)', async () => {
    const res = await request(app)
      .put('/api/v1/matches/tuning')
      .send({ weights: { faith: 0.05 } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a weight value exceeds maximum (3.0)', async () => {
    const res = await request(app)
      .put('/api/v1/matches/tuning')
      .send({ weights: { faith: 5.0 } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when weights field is missing', async () => {
    const res = await request(app).put('/api/v1/matches/tuning').send({});
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockSetMatchTuning.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .put('/api/v1/matches/tuning')
      .send({ weights: { faith: 1.5 } });
    expect(res.status).toBe(500);
  });
});
