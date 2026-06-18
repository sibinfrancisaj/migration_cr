import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockBlockUser          = jest.fn();
const mockUnblockUser        = jest.fn();
const mockListBlocks         = jest.fn();
const mockReportUser         = jest.fn();
const mockGetTrustCenter     = jest.fn();
const mockSetPrivacyControls = jest.fn();
const mockPauseVisibility    = jest.fn();
const mockResumeVisibility   = jest.fn();
const mockGetAccessLevels    = jest.fn();

jest.mock('@abroad-matrimony/trust', () => ({
  blockUser:                (...a: unknown[]) => mockBlockUser(...a),
  unblockUser:              (...a: unknown[]) => mockUnblockUser(...a),
  listBlocks:               (...a: unknown[]) => mockListBlocks(...a),
  reportUser:               (...a: unknown[]) => mockReportUser(...a),
  getSignals:               jest.fn().mockResolvedValue({}),
  getTrustCenter:           (...a: unknown[]) => mockGetTrustCenter(...a),
  setPrivacyControls:       (...a: unknown[]) => mockSetPrivacyControls(...a),
  pauseVisibility:          (...a: unknown[]) => mockPauseVisibility(...a),
  resumeVisibility:         (...a: unknown[]) => mockResumeVisibility(...a),
  getAccessLevelDefinitions: (...a: unknown[]) => mockGetAccessLevels(...a),
  AlreadyBlockedError:          class extends Error { constructor() { super('ALREADY_BLOCKED'); this.name = 'AlreadyBlockedError'; } },
  BlockNotFoundError:           class extends Error { constructor() { super('NOT_FOUND');       this.name = 'BlockNotFoundError'; } },
  BlockSelfError:               class extends Error { constructor() { super('BLOCK_SELF');      this.name = 'BlockSelfError'; } },
  ReportSelfError:              class extends Error { constructor() { super('REPORT_SELF');     this.name = 'ReportSelfError'; } },
  TrustCenterNotFoundError:     class extends Error { constructor() { super('NOT_FOUND');       this.name = 'TrustCenterNotFoundError'; } },
  PrivacyProfileNotFoundError:  class extends Error { constructor() { super('NOT_FOUND');       this.name = 'PrivacyProfileNotFoundError'; } },
  PauseProfileNotFoundError:    class extends Error { constructor() { super('NOT_FOUND');       this.name = 'PauseProfileNotFoundError'; } },
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
const trustMock = jest.requireMock('@abroad-matrimony/trust') as any;
const AlreadyBlockedError         = trustMock.AlreadyBlockedError         as typeof Error;
const BlockNotFoundError          = trustMock.BlockNotFoundError          as typeof Error;
const BlockSelfError              = trustMock.BlockSelfError              as typeof Error;
const ReportSelfError             = trustMock.ReportSelfError             as typeof Error;
const TrustCenterNotFoundError    = trustMock.TrustCenterNotFoundError    as typeof Error;
const PrivacyProfileNotFoundError = trustMock.PrivacyProfileNotFoundError as typeof Error;
const PauseProfileNotFoundError   = trustMock.PauseProfileNotFoundError   as typeof Error;

const app = createApp();

const USER_ID    = 'user-uuid-1';
const TARGET_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BLOCK_DTO  = { id: 'block-1', blockerId: USER_ID, blockedId: TARGET_ID };
const REPORT_DTO = { id: 'report-1', reporterId: USER_ID, targetUserId: TARGET_ID, reason: 'SPAM' };

// ── POST /api/v1/trust/block ──────────────────────────────────────────────────

describe('POST /api/v1/trust/block', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with block DTO on success', async () => {
    mockBlockUser.mockResolvedValue(BLOCK_DTO);

    const res = await request(app)
      .post('/api/v1/trust/block')
      .send({ userId: TARGET_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.blockedId).toBe(TARGET_ID);
    expect(mockBlockUser).toHaveBeenCalledWith(USER_ID, TARGET_ID, undefined);
  });

  it('returns 200 with optional reason', async () => {
    mockBlockUser.mockResolvedValue(BLOCK_DTO);

    await request(app)
      .post('/api/v1/trust/block')
      .send({ userId: TARGET_ID, reason: 'Spam messages' });

    expect(mockBlockUser).toHaveBeenCalledWith(USER_ID, TARGET_ID, 'Spam messages');
  });

  it('returns 409 when user is already blocked', async () => {
    mockBlockUser.mockRejectedValueOnce(new AlreadyBlockedError());

    const res = await request(app)
      .post('/api/v1/trust/block')
      .send({ userId: TARGET_ID });
    expect(res.status).toBe(409);
  });

  it('returns 400 when trying to block yourself', async () => {
    mockBlockUser.mockRejectedValueOnce(new BlockSelfError());

    const res = await request(app)
      .post('/api/v1/trust/block')
      .send({ userId: TARGET_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/api/v1/trust/block').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when userId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/trust/block')
      .send({ userId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockBlockUser.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/v1/trust/block')
      .send({ userId: TARGET_ID });
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/v1/trust/block/:userId ───────────────────────────────────────

describe('DELETE /api/v1/trust/block/:userId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful unblock', async () => {
    mockUnblockUser.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/trust/block/${TARGET_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(mockUnblockUser).toHaveBeenCalledWith(USER_ID, TARGET_ID);
  });

  it('returns 404 when block does not exist', async () => {
    mockUnblockUser.mockRejectedValueOnce(new BlockNotFoundError());

    const res = await request(app).delete(`/api/v1/trust/block/${TARGET_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when userId is not a UUID', async () => {
    const res = await request(app).delete('/api/v1/trust/block/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/trust/blocks ──────────────────────────────────────────────────

describe('GET /api/v1/trust/blocks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with list of blocks', async () => {
    mockListBlocks.mockResolvedValue([BLOCK_DTO]);

    const res = await request(app).get('/api/v1/trust/blocks');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListBlocks).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with empty list when no blocks', async () => {
    mockListBlocks.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/trust/blocks');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── POST /api/v1/trust/report ─────────────────────────────────────────────────

describe('POST /api/v1/trust/report', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with report DTO on success', async () => {
    mockReportUser.mockResolvedValue(REPORT_DTO);

    const res = await request(app)
      .post('/api/v1/trust/report')
      .send({ targetUserId: TARGET_ID, reason: 'SPAM' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reason).toBe('SPAM');
    expect(mockReportUser).toHaveBeenCalledWith(USER_ID, TARGET_ID, 'SPAM', undefined);
  });

  it('returns 201 with optional description', async () => {
    mockReportUser.mockResolvedValue(REPORT_DTO);

    await request(app)
      .post('/api/v1/trust/report')
      .send({ targetUserId: TARGET_ID, reason: 'SPAM', description: 'Sends unsolicited msgs' });

    expect(mockReportUser).toHaveBeenCalledWith(USER_ID, TARGET_ID, 'SPAM', 'Sends unsolicited msgs');
  });

  it('returns 400 when trying to report yourself', async () => {
    mockReportUser.mockRejectedValueOnce(new ReportSelfError());

    const res = await request(app)
      .post('/api/v1/trust/report')
      .send({ targetUserId: TARGET_ID, reason: 'SPAM' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when targetUserId is missing', async () => {
    const res = await request(app).post('/api/v1/trust/report').send({ reason: 'SPAM' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is not a valid FlagReason enum', async () => {
    const res = await request(app)
      .post('/api/v1/trust/report')
      .send({ targetUserId: TARGET_ID, reason: 'INVALID_REASON' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockReportUser.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/v1/trust/report')
      .send({ targetUserId: TARGET_ID, reason: 'SPAM' });
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/trust ─────────────────────────────────────────────────────────

const TRUST_CENTER_DTO = {
  trustScore: 65,
  maxScore: 100,
  layers: [
    { key: 'PHONE_VERIFIED', label: 'Phone verified', completed: true, points: 20 },
    { key: 'ID_VERIFIED',    label: 'Identity verified', completed: false, points: 25 },
  ],
  isPaused: false,
  privacySettings: {
    showPhotosBeforeMutual: true,
    showBioBeforeMutual: true,
    showAnswersBeforeMutual: false,
  },
};

describe('GET /api/v1/trust', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with trust center DTO', async () => {
    mockGetTrustCenter.mockResolvedValue(TRUST_CENTER_DTO);

    const res = await request(app).get('/api/v1/trust');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trustScore).toBe(65);
    expect(res.body.data.layers).toHaveLength(2);
    expect(mockGetTrustCenter).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 404 when profile not found', async () => {
    mockGetTrustCenter.mockRejectedValueOnce(new TrustCenterNotFoundError());

    const res = await request(app).get('/api/v1/trust');
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws', async () => {
    mockGetTrustCenter.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/trust');
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/v1/profile/privacy-controls ─────────────────────────────────────

const PRIVACY_DTO = {
  showPhotosBeforeMutual: true,
  showBioBeforeMutual: false,
  showAnswersBeforeMutual: false,
};

describe('PUT /api/v1/profile/privacy-controls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated privacy settings', async () => {
    mockSetPrivacyControls.mockResolvedValue(PRIVACY_DTO);

    const res = await request(app)
      .put('/api/v1/profile/privacy-controls')
      .send({ showBioBeforeMutual: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.showBioBeforeMutual).toBe(false);
    expect(mockSetPrivacyControls).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ showBioBeforeMutual: false }),
    );
  });

  it('returns 400 when no settings are provided', async () => {
    const res = await request(app)
      .put('/api/v1/profile/privacy-controls')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when setting value is not boolean', async () => {
    const res = await request(app)
      .put('/api/v1/profile/privacy-controls')
      .send({ showPhotosBeforeMutual: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile not found', async () => {
    mockSetPrivacyControls.mockRejectedValueOnce(new PrivacyProfileNotFoundError());

    const res = await request(app)
      .put('/api/v1/profile/privacy-controls')
      .send({ showPhotosBeforeMutual: false });
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws', async () => {
    mockSetPrivacyControls.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .put('/api/v1/profile/privacy-controls')
      .send({ showAnswersBeforeMutual: true });
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/profile/pause-visibility ────────────────────────────────────

describe('POST /api/v1/profile/pause-visibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with isPaused: true', async () => {
    mockPauseVisibility.mockResolvedValue({ isPaused: true });

    const res = await request(app).post('/api/v1/profile/pause-visibility');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isPaused).toBe(true);
    expect(mockPauseVisibility).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 404 when profile not found', async () => {
    mockPauseVisibility.mockRejectedValueOnce(new PauseProfileNotFoundError());

    const res = await request(app).post('/api/v1/profile/pause-visibility');
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws', async () => {
    mockPauseVisibility.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).post('/api/v1/profile/pause-visibility');
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/v1/profile/pause-visibility ───────────────────────────────────

describe('DELETE /api/v1/profile/pause-visibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with isPaused: false', async () => {
    mockResumeVisibility.mockResolvedValue({ isPaused: false });

    const res = await request(app).delete('/api/v1/profile/pause-visibility');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isPaused).toBe(false);
    expect(mockResumeVisibility).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 404 when profile not found', async () => {
    mockResumeVisibility.mockRejectedValueOnce(new PauseProfileNotFoundError());

    const res = await request(app).delete('/api/v1/profile/pause-visibility');
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws', async () => {
    mockResumeVisibility.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).delete('/api/v1/profile/pause-visibility');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/profile/access-levels ─────────────────────────────────────────

const ACCESS_LEVELS = [
  { key: 'PUBLIC',  label: 'Public',        description: 'Visible to everyone', visibleFields: ['name', 'age'] },
  { key: 'TRUSTED', label: 'Trusted',       description: 'After connection',    visibleFields: ['bio', 'photos'] },
  { key: 'FAMILY',  label: 'Family-aware',  description: 'Extended detail',     visibleFields: ['contactDetails'] },
];

describe('GET /api/v1/profile/access-levels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with 3 access level definitions', async () => {
    mockGetAccessLevels.mockReturnValue(ACCESS_LEVELS);

    const res = await request(app).get('/api/v1/profile/access-levels');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data[0].key).toBe('PUBLIC');
  });

  it('returns 500 when service throws', async () => {
    mockGetAccessLevels.mockImplementationOnce(() => { throw new Error('Unexpected'); });

    const res = await request(app).get('/api/v1/profile/access-levels');
    expect(res.status).toBe(500);
  });
});
