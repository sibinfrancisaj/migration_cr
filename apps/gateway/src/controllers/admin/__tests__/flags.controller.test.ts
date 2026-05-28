import request from 'supertest';
import { createApp } from '../../../app.js';

// ─── Messaging mock ───────────────────────────────────────────────────────────

const mockGetAdminFlagSummary = jest.fn();
const mockResolveFlag         = jest.fn();

jest.mock('@abroad-matrimony/messaging', () => {
  class FlagNotFoundError extends Error {
    constructor() { super('FLAG_NOT_FOUND'); this.name = 'FlagNotFoundError'; }
  }
  return {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAdminFlagSummary:     (...a: any[]) => mockGetAdminFlagSummary(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveFlag:             (...a: any[]) => mockResolveFlag(...a),
    FlagNotFoundError,
    CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
    MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  };
});

// ─── Auth mock — admin with MODERATOR role ────────────────────────────────────

let requireAdminBehavior: 'pass' | 'fail401' | 'fail403' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole: jest.fn((role: string) => (req: any, res: any, next: any) => {
    if (requireAdminBehavior === 'fail401') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
    }
    if (requireAdminBehavior === 'fail403') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient role.' } });
    }
    req.admin     = { id: 'admin-uuid-1', role: role, email: 'mod@abroadmatrimony.com' };
    req.requestId = 'test-request-id';
    next();
  }),
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

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const FLAG_ID = '660e8400-e29b-41d4-a716-446655440001';

const FLAG_ROW = {
  id: FLAG_ID,
  reporterId:    'reporter-uuid',
  targetUserId:  USER_ID,
  targetEntityId: 'msg-uuid-1',
  reason:        'SPAM',
  description:   null,
  status:        'OPEN',
  actionTaken:   null,
  resolution:    null,
  resolvedAt:    null,
  createdAt:     '2026-05-28T00:00:00.000Z',
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /admin/users/:userId/flags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdminBehavior = 'pass';
    mockGetAdminFlagSummary.mockResolvedValue({ flags: [FLAG_ROW], total: 1 });
  });

  it('returns 200 with flag list', async () => {
    const res = await request(app)
      .get(`/admin/users/${USER_ID}/flags`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockGetAdminFlagSummary).toHaveBeenCalledWith(USER_ID, 1, 20);
  });

  it('passes custom pagination params', async () => {
    mockGetAdminFlagSummary.mockResolvedValue({ flags: [], total: 0 });

    await request(app)
      .get(`/admin/users/${USER_ID}/flags?page=2&limit=10`);

    expect(mockGetAdminFlagSummary).toHaveBeenCalledWith(USER_ID, 2, 10);
  });

  it('returns 403 when role is insufficient', async () => {
    requireAdminBehavior = 'fail403';

    const res = await request(app)
      .get(`/admin/users/${USER_ID}/flags`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when userId is not a UUID', async () => {
    const res = await request(app)
      .get('/admin/users/not-a-uuid/flags');

    expect(res.status).toBe(400);
  });
});

describe('PUT /admin/flags/:flagId', () => {
  const RESOLVED_FLAG = { ...FLAG_ROW, status: 'RESOLVED', moderatorId: 'admin-uuid-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    requireAdminBehavior = 'pass';
    mockResolveFlag.mockResolvedValue(RESOLVED_FLAG);
  });

  it('returns 200 with resolved flag on RESOLVED', async () => {
    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(mockResolveFlag).toHaveBeenCalledWith(
      FLAG_ID,
      'admin-uuid-1',
      expect.objectContaining({ status: 'RESOLVED' }),
    );
  });

  it('returns 200 with dismissed flag', async () => {
    mockResolveFlag.mockResolvedValue({ ...FLAG_ROW, status: 'DISMISSED' });

    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'DISMISSED', resolution: 'Not a violation' });

    expect(res.status).toBe(200);
    expect(mockResolveFlag).toHaveBeenCalledWith(
      FLAG_ID,
      'admin-uuid-1',
      expect.objectContaining({ status: 'DISMISSED', resolution: 'Not a violation' }),
    );
  });

  it('returns 200 with MESSAGE_REMOVED action', async () => {
    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'RESOLVED', actionTaken: 'MESSAGE_REMOVED' });

    expect(res.status).toBe(200);
    expect(mockResolveFlag).toHaveBeenCalledWith(
      FLAG_ID,
      'admin-uuid-1',
      expect.objectContaining({ status: 'RESOLVED', actionTaken: 'MESSAGE_REMOVED' }),
    );
  });

  it('returns 400 when status is missing', async () => {
    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when status is invalid', async () => {
    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when flagId is not a UUID', async () => {
    const res = await request(app)
      .put('/admin/flags/not-a-uuid')
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when role is insufficient', async () => {
    requireAdminBehavior = 'fail403';

    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when flag is not found', async () => {
    const mock = jest.requireMock('@abroad-matrimony/messaging') as {
      FlagNotFoundError: new () => Error;
    };
    mockResolveFlag.mockRejectedValue(new mock.FlagNotFoundError());

    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockResolveFlag.mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .put(`/admin/flags/${FLAG_ID}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(500);
  });
});
