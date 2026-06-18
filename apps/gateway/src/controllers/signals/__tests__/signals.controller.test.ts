import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockGetSignals       = jest.fn();
const mockLogProfileView   = jest.fn();
const mockGetWeeklyMetrics = jest.fn();
const mockGetActionQueue   = jest.fn();
const mockGetMomentumData  = jest.fn();

jest.mock('@abroad-matrimony/trust', () => ({
  getSignals:         (...a: unknown[]) => mockGetSignals(...a),
  blockUser:          jest.fn().mockResolvedValue({}),
  unblockUser:        jest.fn().mockResolvedValue(undefined),
  listBlocks:         jest.fn().mockResolvedValue([]),
  reportUser:         jest.fn().mockResolvedValue({}),
  AlreadyBlockedError:  class extends Error { constructor() { super(); this.name = 'AlreadyBlockedError'; } },
  BlockNotFoundError:   class extends Error { constructor() { super(); this.name = 'BlockNotFoundError'; } },
  BlockSelfError:       class extends Error { constructor() { super(); this.name = 'BlockSelfError'; } },
  ReportSelfError:      class extends Error { constructor() { super(); this.name = 'ReportSelfError'; } },
}));

jest.mock('@abroad-matrimony/signals', () => ({
  logProfileView:   (...a: unknown[]) => mockLogProfileView(...a),
  getWeeklyMetrics: (...a: unknown[]) => mockGetWeeklyMetrics(...a),
  getActionQueue:   (...a: unknown[]) => mockGetActionQueue(...a),
  getMomentumData:  (...a: unknown[]) => mockGetMomentumData(...a),
  ViewSelfError:    class extends Error { constructor() { super('VIEW_SELF'); this.name = 'ViewSelfError'; } },
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
const SIGNAL_DTO = {
  userId: USER_ID,
  profileViewsLast7d: 12,
  connectionsAccepted: 3,
  resonatesReceived: 8,
};

// ── GET /api/v1/signals ───────────────────────────────────────────────────────

describe('GET /api/v1/signals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with signal DTO', async () => {
    mockGetSignals.mockResolvedValue(SIGNAL_DTO);

    const res = await request(app).get('/api/v1/signals');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profileViewsLast7d).toBe(12);
    expect(mockGetSignals).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with zeros when user has no activity', async () => {
    mockGetSignals.mockResolvedValue({ userId: USER_ID, profileViewsLast7d: 0 });

    const res = await request(app).get('/api/v1/signals');

    expect(res.status).toBe(200);
    expect(res.body.data.profileViewsLast7d).toBe(0);
  });

  it('returns 500 when service throws', async () => {
    mockGetSignals.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/signals');
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/profiles/:id/view ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signalsMock = jest.requireMock('@abroad-matrimony/signals') as any;
const ViewSelfError = signalsMock.ViewSelfError as typeof Error;

const PROFILE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('POST /api/v1/profiles/:id/view', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 when view is logged', async () => {
    mockLogProfileView.mockResolvedValue(undefined);

    const res = await request(app).post(`/api/v1/profiles/${PROFILE_UUID}/view`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.message).toBeDefined();
    expect(mockLogProfileView).toHaveBeenCalledWith(USER_ID, PROFILE_UUID);
  });

  it('returns 400 when trying to view own profile', async () => {
    mockLogProfileView.mockRejectedValueOnce(new ViewSelfError());

    const res = await request(app).post(`/api/v1/profiles/${PROFILE_UUID}/view`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const res = await request(app).post('/api/v1/profiles/not-a-uuid/view');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockLogProfileView.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).post(`/api/v1/profiles/${PROFILE_UUID}/view`);
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/signals/week ──────────────────────────────────────────────────

const WEEKLY_DTO = {
  weekOf: '2026-05-26',
  metrics: [
    { key: 'profileViews', label: 'Profile Views', value: 10, delta: 4 },
  ],
};

describe('GET /api/v1/signals/week', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with weekly metrics', async () => {
    mockGetWeeklyMetrics.mockResolvedValue(WEEKLY_DTO);

    const res = await request(app).get('/api/v1/signals/week');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.weekOf).toBe('2026-05-26');
    expect(mockGetWeeklyMetrics).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when service throws', async () => {
    mockGetWeeklyMetrics.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/signals/week');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/signals/action-queue ─────────────────────────────────────────

const ACTION_ITEMS = [
  { type: 'RESPOND_TO_INTRO', label: 'Respond to introduction', priority: 1, targetUserId: PROFILE_UUID, expiresAt: null },
];

describe('GET /api/v1/signals/action-queue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with action queue items', async () => {
    mockGetActionQueue.mockResolvedValue(ACTION_ITEMS);

    const res = await request(app).get('/api/v1/signals/action-queue');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockGetActionQueue).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with empty array when no actions', async () => {
    mockGetActionQueue.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/signals/action-queue');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockGetActionQueue.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/signals/action-queue');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/signals/momentum ─────────────────────────────────────────────

const MOMENTUM_DATA = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-05-${String(26 + i).padStart(2, '0')}`,
  views: i * 2,
}));

describe('GET /api/v1/signals/momentum', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with 7 daily data points', async () => {
    mockGetMomentumData.mockResolvedValue(MOMENTUM_DATA);

    const res = await request(app).get('/api/v1/signals/momentum');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(7);
    expect(mockGetMomentumData).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when service throws', async () => {
    mockGetMomentumData.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/signals/momentum');
    expect(res.status).toBe(500);
  });
});
