import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListCurrentIntroductions  = jest.fn();
const mockListIntroductionHistory   = jest.fn();
const mockAcceptIntroduction        = jest.fn();
const mockDeclineIntroduction       = jest.fn();

jest.mock('@abroad-matrimony/introductions', () => ({
  listCurrentIntroductions:         (...a: unknown[]) => mockListCurrentIntroductions(...a),
  listIntroductionHistory:          (...a: unknown[]) => mockListIntroductionHistory(...a),
  acceptIntroduction:               (...a: unknown[]) => mockAcceptIntroduction(...a),
  declineIntroduction:              (...a: unknown[]) => mockDeclineIntroduction(...a),
  IntroductionNotFoundError:        class extends Error { constructor() { super('NOT_FOUND');         this.name = 'IntroductionNotFoundError'; } },
  IntroductionForbiddenError:       class extends Error { constructor() { super('FORBIDDEN');          this.name = 'IntroductionForbiddenError'; } },
  IntroductionExpiredError:         class extends Error { constructor() { super('EXPIRED');            this.name = 'IntroductionExpiredError'; } },
  IntroductionAlreadyRespondedError: class extends Error { constructor() { super('ALREADY_RESPONDED'); this.name = 'IntroductionAlreadyRespondedError'; } },
}));

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const introMock = jest.requireMock('@abroad-matrimony/introductions') as any;
const IntroductionNotFoundError         = introMock.IntroductionNotFoundError         as typeof Error;
const IntroductionForbiddenError        = introMock.IntroductionForbiddenError        as typeof Error;
const IntroductionExpiredError          = introMock.IntroductionExpiredError          as typeof Error;
const IntroductionAlreadyRespondedError = introMock.IntroductionAlreadyRespondedError as typeof Error;

const app = createApp();

const USER_ID  = 'user-uuid-1';
const INTRO_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INTRO_DTO = { id: INTRO_ID, status: 'PENDING', weekKey: '2025-W01' };

// ── GET /api/v1/introductions ─────────────────────────────────────────────────

describe('GET /api/v1/introductions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with current intros', async () => {
    mockListCurrentIntroductions.mockResolvedValue([INTRO_DTO]);

    const res = await request(app).get('/api/v1/introductions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListCurrentIntroductions).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with empty array when no intros', async () => {
    mockListCurrentIntroductions.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/introductions');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockListCurrentIntroductions.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/introductions');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/introductions/history ────────────────────────────────────────

describe('GET /api/v1/introductions/history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with paginated history', async () => {
    mockListIntroductionHistory.mockResolvedValue({ intros: [INTRO_DTO], total: 1 });

    const res = await request(app).get('/api/v1/introductions/history?page=1&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('returns 200 with default pagination when no query params', async () => {
    mockListIntroductionHistory.mockResolvedValue({ intros: [], total: 0 });

    const res = await request(app).get('/api/v1/introductions/history');

    expect(res.status).toBe(200);
    expect(mockListIntroductionHistory).toHaveBeenCalledWith(USER_ID, 1, 20);
  });

  it('returns 400 when limit exceeds maximum', async () => {
    const res = await request(app).get('/api/v1/introductions/history?limit=100');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/introductions/:introId/accept ───────────────────────────────

describe('POST /api/v1/introductions/:introId/accept', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with accepted intro DTO', async () => {
    mockAcceptIntroduction.mockResolvedValue({ ...INTRO_DTO, status: 'ACCEPTED' });

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/accept`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACCEPTED');
    expect(mockAcceptIntroduction).toHaveBeenCalledWith(INTRO_ID, USER_ID);
  });

  it('returns 404 when intro does not exist', async () => {
    mockAcceptIntroduction.mockRejectedValueOnce(new IntroductionNotFoundError());

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/accept`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when intro does not belong to this user', async () => {
    mockAcceptIntroduction.mockRejectedValueOnce(new IntroductionForbiddenError());

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/accept`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when intro has expired', async () => {
    mockAcceptIntroduction.mockRejectedValueOnce(new IntroductionExpiredError());

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/accept`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when already responded', async () => {
    mockAcceptIntroduction.mockRejectedValueOnce(new IntroductionAlreadyRespondedError());

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/accept`);
    expect(res.status).toBe(409);
  });

  it('returns 400 when introId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/introductions/not-a-uuid/accept');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/introductions/:introId/decline ──────────────────────────────

describe('POST /api/v1/introductions/:introId/decline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with declined intro DTO', async () => {
    mockDeclineIntroduction.mockResolvedValue({ ...INTRO_DTO, status: 'DECLINED' });

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/decline`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DECLINED');
  });

  it('returns 404 when intro does not exist', async () => {
    mockDeclineIntroduction.mockRejectedValueOnce(new IntroductionNotFoundError());

    const res = await request(app).post(`/api/v1/introductions/${INTRO_ID}/decline`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when introId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/introductions/not-a-uuid/decline');
    expect(res.status).toBe(400);
  });
});
