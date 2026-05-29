import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockSendConnectionRequest = jest.fn();
const mockListConnections        = jest.fn();
const mockAcceptConnection       = jest.fn();
const mockDeclineConnection      = jest.fn();
const mockWithdrawConnection     = jest.fn();

jest.mock('@abroad-matrimony/connections', () => ({
  sendConnectionRequest:        (...a: unknown[]) => mockSendConnectionRequest(...a),
  listConnections:              (...a: unknown[]) => mockListConnections(...a),
  acceptConnection:             (...a: unknown[]) => mockAcceptConnection(...a),
  declineConnection:            (...a: unknown[]) => mockDeclineConnection(...a),
  withdrawConnection:           (...a: unknown[]) => mockWithdrawConnection(...a),
  ConnectionAlreadyExistsError: class extends Error { constructor() { super('ALREADY_EXISTS'); this.name = 'ConnectionAlreadyExistsError'; } },
  ConnectionNotFoundError:      class extends Error { constructor() { super('NOT_FOUND');     this.name = 'ConnectionNotFoundError'; } },
  ConnectionForbiddenError:     class extends Error { constructor() { super('FORBIDDEN');     this.name = 'ConnectionForbiddenError'; } },
  ConnectionInvalidStatusError: class extends Error { constructor() { super('INVALID_STATUS');this.name = 'ConnectionInvalidStatusError'; } },
  BlockedUserError:             class extends Error { constructor() { super('BLOCKED');       this.name = 'BlockedUserError'; } },
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
  checkTrustedDeviceRateLimit:  jest.fn().mockResolvedValue({ allowed: true }),
  trustedDeviceLoginService:    jest.fn().mockResolvedValue({}),
  DeviceNotTrustedError:        class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
  sendMagicLink:                jest.fn().mockResolvedValue({}),
  verifyMagicLink:              jest.fn().mockResolvedValue({}),
  MagicLinkUserNotFoundError:   class extends Error { constructor() { super(); this.name = 'MagicLinkUserNotFoundError'; } },
  MagicLinkInvalidError:        class extends Error { constructor() { super(); this.name = 'MagicLinkInvalidError'; } },
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
  listConversations:           jest.fn().mockResolvedValue([]),
  getConversation:             jest.fn().mockResolvedValue({}),
  getConversationMessages:     jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:                 jest.fn().mockResolvedValue({}),
  getUploadUrl:                jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead:        jest.fn().mockResolvedValue(undefined),
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

// Re-import error classes from the mock so instanceof checks work
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connMock = jest.requireMock('@abroad-matrimony/connections') as any;
const ConnectionAlreadyExistsError = connMock.ConnectionAlreadyExistsError as typeof Error;
const ConnectionNotFoundError      = connMock.ConnectionNotFoundError      as typeof Error;
const ConnectionForbiddenError     = connMock.ConnectionForbiddenError     as typeof Error;
const ConnectionInvalidStatusError = connMock.ConnectionInvalidStatusError as typeof Error;
const BlockedUserError             = connMock.BlockedUserError             as typeof Error;

const app = createApp();

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID       = 'user-uuid-1';
const RECEIVER_ID   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONNECTION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const CONNECTION_DTO = {
  id: CONNECTION_ID,
  senderId: USER_ID,
  receiverId: RECEIVER_ID,
  status: 'PENDING',
  message: null,
  createdAt: new Date().toISOString(),
};

// ── POST /api/v1/connections ───────────────────────────────────────────────────

describe('POST /api/v1/connections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with connection DTO on success', async () => {
    mockSendConnectionRequest.mockResolvedValue(CONNECTION_DTO);

    const res = await request(app)
      .post('/api/v1/connections')
      .send({ receiverId: RECEIVER_ID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(CONNECTION_ID);
  });

  it('returns 201 with optional message', async () => {
    mockSendConnectionRequest.mockResolvedValue(CONNECTION_DTO);

    await request(app)
      .post('/api/v1/connections')
      .send({ receiverId: RECEIVER_ID, message: 'Hi there!' });

    expect(mockSendConnectionRequest).toHaveBeenCalledWith(USER_ID, RECEIVER_ID, 'Hi there!');
  });

  it('returns 400 when receiverId is missing', async () => {
    const res = await request(app).post('/api/v1/connections').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when receiverId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/connections').send({ receiverId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when connection already exists', async () => {
    mockSendConnectionRequest.mockRejectedValueOnce(new ConnectionAlreadyExistsError());

    const res = await request(app).post('/api/v1/connections').send({ receiverId: RECEIVER_ID });
    expect(res.status).toBe(409);
  });

  it('returns 403 when user is blocked', async () => {
    mockSendConnectionRequest.mockRejectedValueOnce(new BlockedUserError());

    const res = await request(app).post('/api/v1/connections').send({ receiverId: RECEIVER_ID });
    expect(res.status).toBe(403);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockSendConnectionRequest.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).post('/api/v1/connections').send({ receiverId: RECEIVER_ID });
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/connections ────────────────────────────────────────────────────

describe('GET /api/v1/connections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with connections list', async () => {
    mockListConnections.mockResolvedValue([CONNECTION_DTO]);

    const res = await request(app).get('/api/v1/connections');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('returns 200 with status filter', async () => {
    mockListConnections.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/connections?status=PENDING');

    expect(res.status).toBe(200);
    expect(mockListConnections).toHaveBeenCalledWith(USER_ID, 'PENDING');
  });

  it('returns 400 on invalid status value', async () => {
    const res = await request(app).get('/api/v1/connections?status=INVALID_STATUS');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty array when no connections', async () => {
    mockListConnections.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/connections');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── PUT /api/v1/connections/:connectionId/accept ───────────────────────────────

describe('PUT /api/v1/connections/:connectionId/accept', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with accepted connection', async () => {
    mockAcceptConnection.mockResolvedValue({ ...CONNECTION_DTO, status: 'ACCEPTED' });

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/accept`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACCEPTED');
  });

  it('returns 404 when connection does not exist', async () => {
    mockAcceptConnection.mockRejectedValueOnce(new ConnectionNotFoundError());

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/accept`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the receiver', async () => {
    mockAcceptConnection.mockRejectedValueOnce(new ConnectionForbiddenError());

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/accept`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when connection is not in PENDING state', async () => {
    mockAcceptConnection.mockRejectedValueOnce(new ConnectionInvalidStatusError());

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/accept`);
    expect(res.status).toBe(409);
  });

  it('returns 400 when connectionId is not a UUID', async () => {
    const res = await request(app).put('/api/v1/connections/not-a-uuid/accept');
    expect(res.status).toBe(400);
  });
});

// ── PUT /api/v1/connections/:connectionId/decline ──────────────────────────────

describe('PUT /api/v1/connections/:connectionId/decline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with declined connection', async () => {
    mockDeclineConnection.mockResolvedValue({ ...CONNECTION_DTO, status: 'DECLINED' });

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/decline`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DECLINED');
  });

  it('returns 404 when connection does not exist', async () => {
    mockDeclineConnection.mockRejectedValueOnce(new ConnectionNotFoundError());

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/decline`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the receiver', async () => {
    mockDeclineConnection.mockRejectedValueOnce(new ConnectionForbiddenError());

    const res = await request(app).put(`/api/v1/connections/${CONNECTION_ID}/decline`);
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/v1/connections/:connectionId ───────────────────────────────────

describe('DELETE /api/v1/connections/:connectionId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful withdrawal', async () => {
    mockWithdrawConnection.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/connections/${CONNECTION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when connection does not exist', async () => {
    mockWithdrawConnection.mockRejectedValueOnce(new ConnectionNotFoundError());

    const res = await request(app).delete(`/api/v1/connections/${CONNECTION_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the sender', async () => {
    mockWithdrawConnection.mockRejectedValueOnce(new ConnectionForbiddenError());

    const res = await request(app).delete(`/api/v1/connections/${CONNECTION_ID}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when connectionId is not a UUID', async () => {
    const res = await request(app).delete('/api/v1/connections/not-a-uuid');
    expect(res.status).toBe(400);
  });
});
