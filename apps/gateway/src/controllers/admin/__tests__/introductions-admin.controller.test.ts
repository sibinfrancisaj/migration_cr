/**
 * IDROP-004 — Admin IntroductionDrop endpoints integration tests.
 *
 * Covers:
 *   GET   /admin/introductions/drops
 *   GET   /admin/introductions/drops/:dropId
 *   POST  /admin/introductions/drops/propose
 *   PATCH /admin/introductions/drops/:dropId/approve
 *   PATCH /admin/introductions/drops/:dropId/members
 *   PATCH /admin/introductions/drops/:dropId/schedule
 */
import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListAllDrops       = jest.fn();
const mockGetDropAdmin       = jest.fn();
const mockProposeNewDrop     = jest.fn();
const mockApproveDrop        = jest.fn();
const mockUpdateDropMembers  = jest.fn();
const mockScheduleDropRelease = jest.fn();

jest.mock('@abroad-matrimony/introductions', () => ({
  // User-facing stubs
  listCurrentIntroductions:         jest.fn().mockResolvedValue([]),
  listIntroductionHistory:          jest.fn().mockResolvedValue({ intros: [], total: 0 }),
  acceptIntroduction:               jest.fn().mockResolvedValue({}),
  declineIntroduction:              jest.fn().mockResolvedValue({}),
  listDropsForUser:                 jest.fn().mockResolvedValue([]),
  getDropDetail:                    jest.fn().mockResolvedValue({}),
  earlyAccessDrop:                  jest.fn().mockResolvedValue({}),
  unlockDropEarly:                  jest.fn().mockResolvedValue({}),
  // Admin functions (under test)
  listAllDrops:       (...a: unknown[]) => mockListAllDrops(...a),
  getDropAdmin:       (...a: unknown[]) => mockGetDropAdmin(...a),
  proposeNewDrop:     (...a: unknown[]) => mockProposeNewDrop(...a),
  approveDrop:        (...a: unknown[]) => mockApproveDrop(...a),
  updateDropMembers:  (...a: unknown[]) => mockUpdateDropMembers(...a),
  scheduleDropRelease: (...a: unknown[]) => mockScheduleDropRelease(...a),
  // Error classes
  IntroductionNotFoundError:        class extends Error { constructor() { super(); this.name = 'IntroductionNotFoundError'; } },
  IntroductionForbiddenError:       class extends Error { constructor() { super(); this.name = 'IntroductionForbiddenError'; } },
  IntroductionExpiredError:         class extends Error { constructor() { super(); this.name = 'IntroductionExpiredError'; } },
  IntroductionAlreadyRespondedError: class extends Error { constructor() { super(); this.name = 'IntroductionAlreadyRespondedError'; } },
  IntroductionDropNotFoundError:    class extends Error { constructor() { super('DROP_NOT_FOUND');    this.name = 'IntroductionDropNotFoundError'; } },
  DropNotLiveError:                 class extends Error { constructor() { super('DROP_NOT_LIVE');     this.name = 'DropNotLiveError'; } },
  InsufficientDiamondsForDropError: class extends Error { constructor() { super('INSUFFICIENT');     this.name = 'InsufficientDiamondsForDropError'; } },
  AlreadyUnlockedError:             class extends Error { constructor() { super('ALREADY_UNLOCKED'); this.name = 'AlreadyUnlockedError'; } },
  DropNotDraftError:                class extends Error { constructor() { super('NOT_DRAFT');         this.name = 'DropNotDraftError'; } },
  DropNotEditableError:             class extends Error { constructor() { super('NOT_EDITABLE');      this.name = 'DropNotEditableError'; } },
  DropMemberPoolTooSmallError:      class extends Error { constructor() { super('POOL_TOO_SMALL');    this.name = 'DropMemberPoolTooSmallError'; } },
}));

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  requireRole:    jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole: jest.fn(() => (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-uuid-1', role: 'MODERATOR', deviceId: 'device-uuid-admin' };
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
  DeviceNotTrustedError:       class extends Error { constructor() { super(); this.name = 'DeviceNotTrustedError'; } },
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
  listConversations:           jest.fn().mockResolvedValue([]),
  getConversation:             jest.fn().mockResolvedValue({}),
  getConversationMessages:     jest.fn().mockResolvedValue({ messages: [], cursor: null }),
  sendMessage:                 jest.fn().mockResolvedValue({}),
  getUploadUrl:                jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  markConversationRead:        jest.fn().mockResolvedValue(undefined),
  createFirebaseToken:         jest.fn().mockResolvedValue('mock-firebase-token'),
  flagMessage:                 jest.fn().mockResolvedValue({ id: 'flag-1', status: 'OPEN' }),
  getAdminFlagSummary:         jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag:                 jest.fn().mockResolvedValue({ id: 'flag-1', status: 'RESOLVED' }),
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  FirebaseNotConfiguredError:  class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  MessageNotFoundError:        class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:         class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:               class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
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

jest.mock('@abroad-matrimony/groups', () => ({
  listGroups:                      jest.fn().mockResolvedValue([]),
  getGroup:                        jest.fn().mockResolvedValue({}),
  joinGroup:                       jest.fn().mockResolvedValue(undefined),
  leaveGroup:                      jest.fn().mockResolvedValue(undefined),
  getGroupMembers:                 jest.fn().mockResolvedValue({ members: [], total: 0, page: 1, limit: 20 }),
  getGroupEvents:                  jest.fn().mockResolvedValue([]),
  listSuggestedGroups:             jest.fn().mockResolvedValue([]),
  getSuggestedGroupsForOnboarding: jest.fn().mockResolvedValue([]),
  createPost:                      jest.fn().mockResolvedValue({}),
  listPosts:                       jest.fn().mockResolvedValue({ posts: [], total: 0, page: 1, limit: 20 }),
  deletePost:                      jest.fn().mockResolvedValue(undefined),
  likePost:                        jest.fn().mockResolvedValue(undefined),
  unlikePost:                      jest.fn().mockResolvedValue(undefined),
  addComment:                      jest.fn().mockResolvedValue({}),
  listComments:                    jest.fn().mockResolvedValue({ comments: [], total: 0, page: 1, limit: 20 }),
  proposeGroup:                    jest.fn().mockResolvedValue({}),
  getGroupProposals:               jest.fn().mockResolvedValue([]),
  approveGroupProposal:            jest.fn().mockResolvedValue({}),
  rejectGroupProposal:             jest.fn().mockResolvedValue(undefined),
  pinPost:                         jest.fn().mockResolvedValue(undefined),
  unpinPost:                       jest.fn().mockResolvedValue(undefined),
  GroupNotFoundError:          class extends Error { constructor() { super(); this.name = 'GroupNotFoundError'; } },
  AlreadyGroupMemberError:     class extends Error { constructor() { super(); this.name = 'AlreadyGroupMemberError'; } },
  AlreadyInGroupError:         class extends Error { constructor() { super(); this.name = 'AlreadyInGroupError'; } },
  NotGroupMemberError:         class extends Error { constructor() { super(); this.name = 'NotGroupMemberError'; } },
  NotInGroupError:             class extends Error { constructor() { super(); this.name = 'NotInGroupError'; } },
  GroupFullError:              class extends Error { constructor() { super(); this.name = 'GroupFullError'; } },
  GroupAccessDeniedError:      class extends Error { constructor() { super(); this.name = 'GroupAccessDeniedError'; } },
  PostNotFoundError:           class extends Error { constructor() { super(); this.name = 'PostNotFoundError'; } },
  PostForbiddenError:          class extends Error { constructor() { super(); this.name = 'PostForbiddenError'; } },
  GroupProposalNotFoundError:  class extends Error { constructor() { super(); this.name = 'GroupProposalNotFoundError'; } },
  AlreadyProposedError:        class extends Error { constructor() { super(); this.name = 'AlreadyProposedError'; } },
  ProposalNotPendingError:     class extends Error { constructor() { super(); this.name = 'ProposalNotPendingError'; } },
}));

// ── Error class references from mocked module ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const introMock = jest.requireMock('@abroad-matrimony/introductions') as any;
const IntroductionDropNotFoundError = introMock.IntroductionDropNotFoundError as typeof Error;
const DropNotDraftError             = introMock.DropNotDraftError             as typeof Error;
const DropNotEditableError          = introMock.DropNotEditableError          as typeof Error;
const DropMemberPoolTooSmallError   = introMock.DropMemberPoolTooSmallError   as typeof Error;

const app = createApp();

const DROP_ID  = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const MEMBER_A = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_B = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const DROP_ADMIN_DTO = {
  id:              DROP_ID,
  name:            'London Drop',
  criteria:        {},
  status:          'DRAFT',
  memberPool:      [MEMBER_A, MEMBER_B],
  releaseAt:       null,
  expiresAt:       null,
  earlyAccessCost: 5,
  unlockCost:      10,
  pairingCount:    0,
  createdAt:       '2026-05-01T00:00:00.000Z',
};

// ── GET /admin/introductions/drops ────────────────────────────────────────────

describe('GET /admin/introductions/drops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with list of drops', async () => {
    mockListAllDrops.mockResolvedValue([DROP_ADMIN_DTO]);

    const res = await request(app).get('/admin/introductions/drops');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListAllDrops).toHaveBeenCalledWith({ status: undefined });
  });

  it('passes status filter to service', async () => {
    mockListAllDrops.mockResolvedValue([]);

    await request(app).get('/admin/introductions/drops?status=DRAFT');

    expect(mockListAllDrops).toHaveBeenCalledWith({ status: 'DRAFT' });
  });

  it('returns 400 for invalid status enum', async () => {
    const res = await request(app).get('/admin/introductions/drops?status=INVALID');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockListAllDrops.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/admin/introductions/drops');
    expect(res.status).toBe(500);
  });
});

// ── GET /admin/introductions/drops/:dropId ────────────────────────────────────

describe('GET /admin/introductions/drops/:dropId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with drop admin detail', async () => {
    mockGetDropAdmin.mockResolvedValue(DROP_ADMIN_DTO);

    const res = await request(app).get(`/admin/introductions/drops/${DROP_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(DROP_ID);
    expect(mockGetDropAdmin).toHaveBeenCalledWith(DROP_ID);
  });

  it('returns 404 when drop not found', async () => {
    mockGetDropAdmin.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app).get(`/admin/introductions/drops/${DROP_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when dropId is not a UUID', async () => {
    const res = await request(app).get('/admin/introductions/drops/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── POST /admin/introductions/drops/propose ───────────────────────────────────

describe('POST /admin/introductions/drops/propose', () => {
  beforeEach(() => jest.clearAllMocks());

  const validBody = {
    name:       'London Drop',
    memberPool: [MEMBER_A, MEMBER_B],
  };

  it('returns 201 with created DRAFT drop', async () => {
    mockProposeNewDrop.mockResolvedValue(DROP_ADMIN_DTO);

    const res = await request(app)
      .post('/admin/introductions/drops/propose')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
    expect(mockProposeNewDrop).toHaveBeenCalledWith(expect.objectContaining({ name: 'London Drop' }));
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/admin/introductions/drops/propose')
      .send({ memberPool: [MEMBER_A, MEMBER_B] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when memberPool has fewer than 2 users', async () => {
    const res = await request(app)
      .post('/admin/introductions/drops/propose')
      .send({ name: 'Drop', memberPool: [MEMBER_A] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when memberPool contains non-UUID entries', async () => {
    const res = await request(app)
      .post('/admin/introductions/drops/propose')
      .send({ name: 'Drop', memberPool: ['not-a-uuid', MEMBER_B] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when pool too small (service validation)', async () => {
    mockProposeNewDrop.mockRejectedValueOnce(new DropMemberPoolTooSmallError());
    const res = await request(app)
      .post('/admin/introductions/drops/propose')
      .send({ name: 'Drop', memberPool: [MEMBER_A, MEMBER_B] });
    expect(res.status).toBe(400);
  });
});

// ── PATCH /admin/introductions/drops/:dropId/approve ─────────────────────────

describe('PATCH /admin/introductions/drops/:dropId/approve', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with PENDING_APPROVAL drop', async () => {
    mockApproveDrop.mockResolvedValue({ ...DROP_ADMIN_DTO, status: 'PENDING_APPROVAL' });

    const res = await request(app).patch(`/admin/introductions/drops/${DROP_ID}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING_APPROVAL');
    expect(mockApproveDrop).toHaveBeenCalledWith(DROP_ID);
  });

  it('returns 404 when drop not found', async () => {
    mockApproveDrop.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app).patch(`/admin/introductions/drops/${DROP_ID}/approve`);
    expect(res.status).toBe(404);
  });

  it('returns 409 when drop is not DRAFT', async () => {
    mockApproveDrop.mockRejectedValueOnce(new DropNotDraftError());
    const res = await request(app).patch(`/admin/introductions/drops/${DROP_ID}/approve`);
    expect(res.status).toBe(409);
  });

  it('returns 400 when dropId is not a UUID', async () => {
    const res = await request(app).patch('/admin/introductions/drops/not-a-uuid/approve');
    expect(res.status).toBe(400);
  });
});

// ── PATCH /admin/introductions/drops/:dropId/members ─────────────────────────

describe('PATCH /admin/introductions/drops/:dropId/members', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated drop', async () => {
    mockUpdateDropMembers.mockResolvedValue(DROP_ADMIN_DTO);

    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/members`)
      .send({ memberPool: [MEMBER_A, MEMBER_B] });

    expect(res.status).toBe(200);
    expect(mockUpdateDropMembers).toHaveBeenCalledWith(DROP_ID, [MEMBER_A, MEMBER_B]);
  });

  it('returns 400 when memberPool has fewer than 2 entries', async () => {
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/members`)
      .send({ memberPool: [MEMBER_A] });
    expect(res.status).toBe(400);
  });

  it('returns 404 when drop not found', async () => {
    mockUpdateDropMembers.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/members`)
      .send({ memberPool: [MEMBER_A, MEMBER_B] });
    expect(res.status).toBe(404);
  });

  it('returns 409 when drop is not editable (LIVE)', async () => {
    mockUpdateDropMembers.mockRejectedValueOnce(new DropNotEditableError());
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/members`)
      .send({ memberPool: [MEMBER_A, MEMBER_B] });
    expect(res.status).toBe(409);
  });
});

// ── PATCH /admin/introductions/drops/:dropId/schedule ────────────────────────

describe('PATCH /admin/introductions/drops/:dropId/schedule', () => {
  beforeEach(() => jest.clearAllMocks());

  const releaseAt = '2026-06-15T12:00:00.000Z';

  it('returns 200 with updated drop', async () => {
    mockScheduleDropRelease.mockResolvedValue({ ...DROP_ADMIN_DTO, releaseAt });

    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/schedule`)
      .send({ releaseAt });

    expect(res.status).toBe(200);
    expect(mockScheduleDropRelease).toHaveBeenCalledWith(DROP_ID, new Date(releaseAt));
  });

  it('returns 400 when releaseAt is missing', async () => {
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/schedule`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when releaseAt is not a valid datetime', async () => {
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/schedule`)
      .send({ releaseAt: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when drop not found', async () => {
    mockScheduleDropRelease.mockRejectedValueOnce(new IntroductionDropNotFoundError());
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/schedule`)
      .send({ releaseAt });
    expect(res.status).toBe(404);
  });

  it('returns 409 when drop is not editable', async () => {
    mockScheduleDropRelease.mockRejectedValueOnce(new DropNotEditableError());
    const res = await request(app)
      .patch(`/admin/introductions/drops/${DROP_ID}/schedule`)
      .send({ releaseAt });
    expect(res.status).toBe(409);
  });
});
