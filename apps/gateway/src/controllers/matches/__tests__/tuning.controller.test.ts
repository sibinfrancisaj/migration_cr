import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockGetMatchTuning        = jest.fn();
const mockSetMatchTuning        = jest.fn();
const mockGetTuningAsQuestions  = jest.fn();
const mockSetTuningFromQuestions = jest.fn();
const mockComputeTuningImpact   = jest.fn();
// enqueueScoreRecompute must return a Promise (fire-and-forget .catch() is called on it)
const mockEnqueueScoreRecompute = jest.fn().mockResolvedValue(undefined);

jest.mock('@abroad-matrimony/matching', () => ({
  getMatchTuning:              (...a: unknown[]) => mockGetMatchTuning(...a),
  setMatchTuning:              (...a: unknown[]) => mockSetMatchTuning(...a),
  getTuningAsQuestions:        (...a: unknown[]) => mockGetTuningAsQuestions(...a),
  setTuningFromQuestions:      (...a: unknown[]) => mockSetTuningFromQuestions(...a),
  computeTuningImpact:         (...a: unknown[]) => mockComputeTuningImpact(...a),
  enqueueScoreRecompute:       (...a: unknown[]) => mockEnqueueScoreRecompute(...a),
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
    REDIS_URL: 'redis://localhost:6379',
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

  it('fires recompute job after successful save (ALG-013)', async () => {
    mockSetMatchTuning.mockResolvedValue(TUNING_DTO);
    mockEnqueueScoreRecompute.mockResolvedValue(undefined);

    await request(app)
      .put('/api/v1/matches/tuning')
      .send({ weights: { faith: 1.5 } });

    // allow the fire-and-forget to be called
    await new Promise((r) => setTimeout(r, 10));
    expect(mockEnqueueScoreRecompute).toHaveBeenCalled();
  });
});

// ── GET /api/v1/profile/match-tuning ─────────────────────────────────────────

const QUESTIONS_DTO = {
  userId: USER_ID,
  settlementImportance: 4,
  familyImportance: 3,
  updatedAt: '2026-06-02T10:00:00.000Z',
};

describe('GET /api/v1/profile/match-tuning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with 2-question tuning DTO', async () => {
    mockGetTuningAsQuestions.mockResolvedValue(QUESTIONS_DTO);

    const res = await request(app).get('/api/v1/profile/match-tuning');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settlementImportance).toBe(4);
    expect(res.body.data.familyImportance).toBe(3);
    expect(mockGetTuningAsQuestions).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when service throws', async () => {
    mockGetTuningAsQuestions.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/profile/match-tuning');
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/profile/match-tuning ────────────────────────────────────────

describe('POST /api/v1/profile/match-tuning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with saved questions DTO', async () => {
    mockSetTuningFromQuestions.mockResolvedValue(QUESTIONS_DTO);
    mockEnqueueScoreRecompute.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/profile/match-tuning')
      .send({ settlementImportance: 4, familyImportance: 3 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSetTuningFromQuestions).toHaveBeenCalledWith(USER_ID, 4, 3);
  });

  it('returns 400 when settlementImportance is out of range', async () => {
    const res = await request(app)
      .post('/api/v1/profile/match-tuning')
      .send({ settlementImportance: 6, familyImportance: 3 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when familyImportance is missing', async () => {
    const res = await request(app)
      .post('/api/v1/profile/match-tuning')
      .send({ settlementImportance: 3 });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockSetTuningFromQuestions.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/v1/profile/match-tuning')
      .send({ settlementImportance: 4, familyImportance: 3 });
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/profile/match-tuning/impact ──────────────────────────────────

const IMPACT_DTO = {
  pairsAnalysed: 20,
  profilesUp: 5,
  profilesDown: 3,
  profilesUnchanged: 12,
  topGainers: [{ userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', currentScore: 0.6, projectedScore: 0.75 }],
};

describe('GET /api/v1/profile/match-tuning/impact', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with impact DTO', async () => {
    mockComputeTuningImpact.mockResolvedValue(IMPACT_DTO);

    const res = await request(app)
      .get('/api/v1/profile/match-tuning/impact?settlementImportance=4&familyImportance=3');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profilesUp).toBe(5);
    expect(mockComputeTuningImpact).toHaveBeenCalledWith(USER_ID, 4, 3);
  });

  it('returns 400 when settlementImportance is missing', async () => {
    const res = await request(app)
      .get('/api/v1/profile/match-tuning/impact?familyImportance=3');
    expect(res.status).toBe(400);
  });

  it('returns 400 when importance values are out of range', async () => {
    const res = await request(app)
      .get('/api/v1/profile/match-tuning/impact?settlementImportance=0&familyImportance=6');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockComputeTuningImpact.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/v1/profile/match-tuning/impact?settlementImportance=4&familyImportance=3');
    expect(res.status).toBe(500);
  });
});
