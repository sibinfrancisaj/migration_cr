import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListCurrentIntroductions  = jest.fn();
const mockListIntroductionHistory   = jest.fn();
const mockGetIntroductionDetail     = jest.fn();
const mockAcceptIntroduction        = jest.fn();
const mockDeclineIntroduction       = jest.fn();
const mockEarlyUnlockWeeklyIntros   = jest.fn();
const mockGenerateWhyThisMatchLLM   = jest.fn();
// Drop mocks
const mockListDropsForUser = jest.fn();
const mockGetDropDetail    = jest.fn();
const mockEarlyAccessDrop  = jest.fn();
const mockUnlockDropEarly  = jest.fn();

jest.mock('@abroad-matrimony/introductions', () => ({
  listCurrentIntroductions:         (...a: unknown[]) => mockListCurrentIntroductions(...a),
  listIntroductionHistory:          (...a: unknown[]) => mockListIntroductionHistory(...a),
  getIntroductionDetail:            (...a: unknown[]) => mockGetIntroductionDetail(...a),
  acceptIntroduction:               (...a: unknown[]) => mockAcceptIntroduction(...a),
  declineIntroduction:              (...a: unknown[]) => mockDeclineIntroduction(...a),
  earlyUnlockWeeklyIntros:          (...a: unknown[]) => mockEarlyUnlockWeeklyIntros(...a),
  generateWhyThisMatchLLM:          (...a: unknown[]) => mockGenerateWhyThisMatchLLM(...a),
  generateWhyThisMatch:             jest.fn().mockReturnValue({ headline: 'h', summary: 's', dimensions: [], isAiGenerated: false }),
  IntroductionNotFoundError:        class extends Error { constructor() { super('NOT_FOUND');         this.name = 'IntroductionNotFoundError'; } },
  IntroductionForbiddenError:       class extends Error { constructor() { super('FORBIDDEN');          this.name = 'IntroductionForbiddenError'; } },
  IntroductionExpiredError:         class extends Error { constructor() { super('EXPIRED');            this.name = 'IntroductionExpiredError'; } },
  IntroductionAlreadyRespondedError: class extends Error { constructor() { super('ALREADY_RESPONDED'); this.name = 'IntroductionAlreadyRespondedError'; } },
  EarlyUnlockInsufficientDiamondsError: class extends Error { constructor() { super('EARLY_UNLOCK_INSUFFICIENT_DIAMONDS'); this.name = 'EarlyUnlockInsufficientDiamondsError'; } },
  // Drop services
  listDropsForUser: (...a: unknown[]) => mockListDropsForUser(...a),
  getDropDetail:    (...a: unknown[]) => mockGetDropDetail(...a),
  earlyAccessDrop:  (...a: unknown[]) => mockEarlyAccessDrop(...a),
  unlockDropEarly:  (...a: unknown[]) => mockUnlockDropEarly(...a),
  IntroductionDropNotFoundError:    class extends Error { constructor() { super('DROP_NOT_FOUND');           this.name = 'IntroductionDropNotFoundError'; } },
  DropNotLiveError:                 class extends Error { constructor() { super('DROP_NOT_LIVE');            this.name = 'DropNotLiveError'; } },
  InsufficientDiamondsForDropError: class extends Error { constructor() { super('INSUFFICIENT_DIAMONDS');    this.name = 'InsufficientDiamondsForDropError'; } },
  AlreadyUnlockedError:             class extends Error { constructor() { super('ALREADY_UNLOCKED');         this.name = 'AlreadyUnlockedError'; } },
}));

// Phase 10 — matching lib mock (used by getMatchContext)
const mockGetMatchScore        = jest.fn();
const mockComputeAndSaveScore  = jest.fn();
jest.mock('@abroad-matrimony/matching', () => ({
  getMatchScore:       (...a: unknown[]) => mockGetMatchScore(...a),
  computeAndSaveScore: (...a: unknown[]) => mockComputeAndSaveScore(...a),
  UserProfileMissingError: class extends Error { constructor(public userId: string) { super(`PROFILE_MISSING:${userId}`); this.name = 'UserProfileMissingError'; } },
}));

// Cache mock (used by getMatchContext)
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
jest.mock('@abroad-matrimony/cache', () => ({
  cacheGet: (...a: unknown[]) => mockCacheGet(...a),
  cacheSet: (...a: unknown[]) => mockCacheSet(...a),
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
const EarlyUnlockInsufficientDiamondsError = introMock.EarlyUnlockInsufficientDiamondsError as typeof Error;
// Drop errors
const IntroductionDropNotFoundError    = introMock.IntroductionDropNotFoundError    as typeof Error;
const DropNotLiveError                 = introMock.DropNotLiveError                 as typeof Error;
const InsufficientDiamondsForDropError = introMock.InsufficientDiamondsForDropError as typeof Error;
const AlreadyUnlockedError             = introMock.AlreadyUnlockedError             as typeof Error;
// Matching errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const matchMock = jest.requireMock('@abroad-matrimony/matching') as any;
const UserProfileMissingError = matchMock.UserProfileMissingError as new (id: string) => Error;

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

// ── Drop endpoint fixtures ────────────────────────────────────────────────────

const DROP_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DROP_SUMMARY = { id: DROP_ID, name: 'London Drop', pairingCount: 3, isEarlyAccessed: false, isUnlocked: false };
const DROP_DETAIL  = { id: DROP_ID, name: 'London Drop', pairings: [] };

// ── GET /api/v1/introductions/drops ──────────────────────────────────────────

describe('GET /api/v1/introductions/drops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with drop summaries', async () => {
    mockListDropsForUser.mockResolvedValue([DROP_SUMMARY]);

    const res = await request(app).get('/api/v1/introductions/drops');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListDropsForUser).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with empty array when no drops', async () => {
    mockListDropsForUser.mockResolvedValue([]);
    const res = await request(app).get('/api/v1/introductions/drops');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockListDropsForUser.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/v1/introductions/drops');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/introductions/drops/:dropId ───────────────────────────────────

describe('GET /api/v1/introductions/drops/:dropId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with drop detail', async () => {
    mockGetDropDetail.mockResolvedValue(DROP_DETAIL);

    const res = await request(app).get(`/api/v1/introductions/drops/${DROP_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(DROP_ID);
    expect(mockGetDropDetail).toHaveBeenCalledWith(DROP_ID, USER_ID);
  });

  it('returns 404 when drop not found', async () => {
    mockGetDropDetail.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app).get(`/api/v1/introductions/drops/${DROP_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when dropId is not a UUID', async () => {
    const res = await request(app).get('/api/v1/introductions/drops/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/introductions/drops/:dropId/early-access ────────────────────

describe('POST /api/v1/introductions/drops/:dropId/early-access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with drop detail after early access', async () => {
    mockEarlyAccessDrop.mockResolvedValue(DROP_DETAIL);

    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/early-access`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.message).toBeDefined();
    expect(mockEarlyAccessDrop).toHaveBeenCalledWith(USER_ID, DROP_ID);
  });

  it('returns 404 when drop not found', async () => {
    mockEarlyAccessDrop.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/early-access`);
    expect(res.status).toBe(404);
  });

  it('returns 409 when drop is not LIVE or SCHEDULED', async () => {
    mockEarlyAccessDrop.mockRejectedValueOnce(new DropNotLiveError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/early-access`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when insufficient diamonds', async () => {
    mockEarlyAccessDrop.mockRejectedValueOnce(new InsufficientDiamondsForDropError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/early-access`);
    expect(res.status).toBe(409);
  });

  it('returns 400 when dropId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/introductions/drops/not-a-uuid/early-access');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/introductions/drops/:dropId/unlock ──────────────────────────

describe('POST /api/v1/introductions/drops/:dropId/unlock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with drop detail after unlock', async () => {
    mockUnlockDropEarly.mockResolvedValue(DROP_DETAIL);

    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/unlock`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.message).toBeDefined();
    expect(mockUnlockDropEarly).toHaveBeenCalledWith(USER_ID, DROP_ID);
  });

  it('returns 409 when already unlocked', async () => {
    mockUnlockDropEarly.mockRejectedValueOnce(new AlreadyUnlockedError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/unlock`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when drop is not LIVE or SCHEDULED', async () => {
    mockUnlockDropEarly.mockRejectedValueOnce(new DropNotLiveError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/unlock`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when insufficient diamonds', async () => {
    mockUnlockDropEarly.mockRejectedValueOnce(new InsufficientDiamondsForDropError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/unlock`);
    expect(res.status).toBe(409);
  });

  it('returns 404 when drop not found', async () => {
    mockUnlockDropEarly.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app).post(`/api/v1/introductions/drops/${DROP_ID}/unlock`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when dropId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/introductions/drops/not-a-uuid/unlock');
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/introductions/:introId (INTRO-003) ───────────────────────────

describe('GET /api/v1/introductions/:introId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with introduction detail', async () => {
    mockGetIntroductionDetail.mockResolvedValue(INTRO_DTO);

    const res = await request(app).get(`/api/v1/introductions/${INTRO_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(INTRO_ID);
    expect(mockGetIntroductionDetail).toHaveBeenCalledWith(INTRO_ID, USER_ID);
  });

  it('returns 404 when introduction does not exist', async () => {
    mockGetIntroductionDetail.mockRejectedValueOnce(new IntroductionNotFoundError());
    const res = await request(app).get(`/api/v1/introductions/${INTRO_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when introduction belongs to different user', async () => {
    mockGetIntroductionDetail.mockRejectedValueOnce(new IntroductionForbiddenError());
    const res = await request(app).get(`/api/v1/introductions/${INTRO_ID}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 when introId is not a UUID', async () => {
    const res = await request(app).get('/api/v1/introductions/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/introductions/unlock-early (INTRO-004) ──────────────────────

describe('POST /api/v1/introductions/unlock-early', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 when successfully unlocked', async () => {
    mockEarlyUnlockWeeklyIntros.mockResolvedValue({ unlockedCount: 3, alreadyUnlocked: false });

    const res = await request(app).post('/api/v1/introductions/unlock-early');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unlockedCount).toBe(3);
    expect(res.body.meta.message).toBeDefined();
    expect(mockEarlyUnlockWeeklyIntros).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with already-unlocked message when already done', async () => {
    mockEarlyUnlockWeeklyIntros.mockResolvedValue({ unlockedCount: 3, alreadyUnlocked: true });

    const res = await request(app).post('/api/v1/introductions/unlock-early');

    expect(res.status).toBe(200);
    expect(res.body.data.alreadyUnlocked).toBe(true);
  });

  it('returns 409 when insufficient diamonds', async () => {
    mockEarlyUnlockWeeklyIntros.mockRejectedValueOnce(new EarlyUnlockInsufficientDiamondsError());
    const res = await request(app).post('/api/v1/introductions/unlock-early');
    expect(res.status).toBe(409);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockEarlyUnlockWeeklyIntros.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/v1/introductions/unlock-early');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/profiles/:id/match-context (INTRO-007) ───────────────────────

const PROFILE_ID  = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const MATCH_SCORE = {
  userAId:    USER_ID,
  userBId:    PROFILE_ID,
  totalScore: 0.82,
  breakdown:  { verification: 1.0, settlementIntent: 0.8, realLifeAnswers: 0.7, profileCompleteness: 0.9, checkInRecency: 0.6, ageCompatibility: 1.0, groupMembership: 1.0, languageMatch: 1.0, faithAlignment: 0.9 },
  computedAt: new Date('2026-06-01T10:00:00Z'),
};

const WHY_THIS_MATCH = { headline: 'Strong match on Life Abroad Plan', summary: 'Summary text.', dimensions: [], isAiGenerated: false };

describe('GET /api/v1/profiles/:id/match-context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockGenerateWhyThisMatchLLM.mockResolvedValue(WHY_THIS_MATCH);
  });

  it('returns 200 with match context (score from cache)', async () => {
    mockGetMatchScore.mockResolvedValue(MATCH_SCORE);

    const res = await request(app).get(`/api/v1/profiles/${PROFILE_ID}/match-context`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalScore).toBe(0.82);
    expect(res.body.data.totalPct).toBe(82);
    expect(res.body.data.whyThisMatch).toBeDefined();
    expect(mockComputeAndSaveScore).not.toHaveBeenCalled();
  });

  it('computes score on demand when not cached in DB/Redis', async () => {
    mockGetMatchScore.mockResolvedValue(null);
    mockComputeAndSaveScore.mockResolvedValue(MATCH_SCORE);

    const res = await request(app).get(`/api/v1/profiles/${PROFILE_ID}/match-context`);

    expect(res.status).toBe(200);
    expect(mockComputeAndSaveScore).toHaveBeenCalledWith(USER_ID, PROFILE_ID);
  });

  it('returns cached match-context when found in Redis', async () => {
    const cachedCtx = { totalScore: 0.75, totalPct: 75, breakdown: {}, whyThisMatch: WHY_THIS_MATCH };
    mockCacheGet.mockResolvedValueOnce(cachedCtx);

    const res = await request(app).get(`/api/v1/profiles/${PROFILE_ID}/match-context`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalScore).toBe(0.75);
    expect(mockGetMatchScore).not.toHaveBeenCalled();
  });

  it('returns 400 when requesting match context with self', async () => {
    const res = await request(app).get(`/api/v1/profiles/${USER_ID}/match-context`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile user has no profile row', async () => {
    mockGetMatchScore.mockResolvedValue(null);
    mockComputeAndSaveScore.mockRejectedValueOnce(new UserProfileMissingError(PROFILE_ID));

    const res = await request(app).get(`/api/v1/profiles/${PROFILE_ID}/match-context`);
    expect(res.status).toBe(404);
  });

  it('returns 500 when getMatchScore throws unexpectedly', async () => {
    mockGetMatchScore.mockRejectedValueOnce(new Error('Redis down'));
    const res = await request(app).get(`/api/v1/profiles/${PROFILE_ID}/match-context`);
    expect(res.status).toBe(500);
  });
});
