/**
 * ADMIN-002 — User admin controller integration tests.
 */
import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockListUsers        = jest.fn();
const mockGetUserDetail    = jest.fn();
const mockSuspendUser      = jest.fn();
const mockUnsuspendUser    = jest.fn();
const mockBanUser          = jest.fn();
const mockWipeSeededUser   = jest.fn();

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth:    (req: any, _res: any, next: any) => { req.user = { id: 'u1', role: 'USER', deviceId: 'd1' }; next(); },
  requireRole:    jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole: jest.fn(() => (req: any, _res: any, next: any) => {
    req.admin = { id: 'admin-uuid-1', role: 'MODERATOR', email: 'mod@test.com' };
    next();
  }),
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter:            jest.fn().mockReturnValue({ send: jest.fn() }),
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
  // User admin (ADMIN-002)
  listUsers:          (...a: any[]) => mockListUsers(...a),
  getUserAdminDetail: (...a: any[]) => mockGetUserDetail(...a),
  suspendUser:        (...a: any[]) => mockSuspendUser(...a),
  unsuspendUser:      (...a: any[]) => mockUnsuspendUser(...a),
  banUser:            (...a: any[]) => mockBanUser(...a),
  wipeSeededUser:     (...a: any[]) => mockWipeSeededUser(...a),
  // Error classes
  UserNotFoundError:         class extends Error { constructor() { super(); this.name = 'UserNotFoundError'; } },
  UserAlreadySuspendedError: class extends Error { constructor() { super(); this.name = 'UserAlreadySuspendedError'; } },
  UserNotSuspendedError:     class extends Error { constructor() { super(); this.name = 'UserNotSuspendedError'; } },
  // Audit
  listAuditLogs:      jest.fn().mockResolvedValue({ entries: [], hasMore: false, nextCursor: null }),
  auditLog:           jest.fn().mockResolvedValue(undefined),
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
  listFeatureFlags:           jest.fn().mockResolvedValue([]),
  getFeatureFlag:             jest.fn().mockResolvedValue({}),
  createFeatureFlag:          jest.fn().mockResolvedValue({}),
  updateFeatureFlag:          jest.fn().mockResolvedValue({}),
  deleteFeatureFlag:          jest.fn().mockResolvedValue(undefined),
  FeatureFlagNotFoundError:   class extends Error { constructor() { super(); this.name = 'FeatureFlagNotFoundError'; } },
  FeatureFlagAlreadyExistsError: class extends Error { constructor() { super(); this.name = 'FeatureFlagAlreadyExistsError'; } },
  listSystemConfig:           jest.fn().mockResolvedValue([]),
  getSystemConfig:            jest.fn().mockResolvedValue({}),
  upsertSystemConfig:         jest.fn().mockResolvedValue({}),
  createSystemConfig:         jest.fn().mockResolvedValue({}),
  deleteSystemConfig:         jest.fn().mockResolvedValue(undefined),
  SystemConfigNotFoundError:        class extends Error { constructor() { super(); this.name = 'SystemConfigNotFoundError'; } },
  SystemConfigAlreadyExistsError:   class extends Error { constructor() { super(); this.name = 'SystemConfigAlreadyExistsError'; } },
  SystemConfigDeleteProtectedError: class extends Error { constructor() { super(); this.name = 'SystemConfigDeleteProtectedError'; } },
  SystemConfigValidationError:      class extends Error { constructor(m?: string) { super(m); this.name = 'SystemConfigValidationError'; } },
}));

jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations: jest.fn().mockResolvedValue([]),
  getConversation:   jest.fn().mockResolvedValue({}),
  getConversationMessages: jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:       jest.fn().mockResolvedValue({}),
  getUploadUrl:      jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError:  class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError: class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:  class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead:        jest.fn().mockResolvedValue(undefined),
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  createFirebaseToken:         jest.fn().mockResolvedValue('mock-token'),
  FirebaseNotConfiguredError:  class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage:                 jest.fn().mockResolvedValue({ id: 'flag-1' }),
  MessageNotFoundError:        class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:         class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:               class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  getAdminFlagSummary:         jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag:                 jest.fn().mockResolvedValue({ id: 'flag-1' }),
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
  DIAMOND_PACKAGES: {},
  PaymentSignatureError:        class extends Error { constructor() { super(); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:         class extends Error { constructor() { super(); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:   class extends Error { constructor() { super(); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:    class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError: class extends Error { constructor() { super(); this.name = 'MembershipAlreadyActiveError'; } },
}));

jest.mock('@abroad-matrimony/groups', () => ({
  listGroups: jest.fn().mockResolvedValue([]), getGroup: jest.fn().mockResolvedValue({}),
  joinGroup: jest.fn(), leaveGroup: jest.fn(), getGroupMembers: jest.fn().mockResolvedValue({ members: [], total: 0 }),
  getGroupEvents: jest.fn().mockResolvedValue([]), listSuggestedGroups: jest.fn().mockResolvedValue([]),
  getSuggestedGroupsForOnboarding: jest.fn().mockResolvedValue([]),
  createPost: jest.fn().mockResolvedValue({}), listPosts: jest.fn().mockResolvedValue({ posts: [], total: 0 }),
  deletePost: jest.fn(), likePost: jest.fn(), unlikePost: jest.fn(),
  addComment: jest.fn().mockResolvedValue({}), listComments: jest.fn().mockResolvedValue({ comments: [], total: 0 }),
  proposeGroup: jest.fn().mockResolvedValue({}),
  getGroupProposals: jest.fn().mockResolvedValue([]),
  approveGroupProposal: jest.fn().mockResolvedValue({}), rejectGroupProposal: jest.fn().mockResolvedValue({}),
  pinPost: jest.fn().mockResolvedValue(undefined), unpinPost: jest.fn().mockResolvedValue(undefined),
  listAdminGroups: jest.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
  getAdminGroup:   jest.fn().mockResolvedValue({}),
  createAdminGroup: jest.fn().mockResolvedValue({}), updateAdminGroup: jest.fn().mockResolvedValue({}),
  archiveAdminGroup: jest.fn().mockResolvedValue(undefined),
  GroupNotFoundError:         class extends Error { constructor() { super(); this.name = 'GroupNotFoundError'; } },
  AlreadyGroupMemberError:    class extends Error { constructor() { super(); this.name = 'AlreadyGroupMemberError'; } },
  AlreadyInGroupError:        class extends Error { constructor() { super(); this.name = 'AlreadyInGroupError'; } },
  NotGroupMemberError:        class extends Error { constructor() { super(); this.name = 'NotGroupMemberError'; } },
  NotInGroupError:            class extends Error { constructor() { super(); this.name = 'NotInGroupError'; } },
  GroupFullError:             class extends Error { constructor() { super(); this.name = 'GroupFullError'; } },
  GroupAccessDeniedError:     class extends Error { constructor() { super(); this.name = 'GroupAccessDeniedError'; } },
  PostNotFoundError:          class extends Error { constructor() { super(); this.name = 'PostNotFoundError'; } },
  PostForbiddenError:         class extends Error { constructor() { super(); this.name = 'PostForbiddenError'; } },
  GroupProposalNotFoundError: class extends Error { constructor() { super(); this.name = 'GroupProposalNotFoundError'; } },
  AlreadyProposedError:       class extends Error { constructor() { super(); this.name = 'AlreadyProposedError'; } },
  ProposalNotPendingError:    class extends Error { constructor() { super(); this.name = 'ProposalNotPendingError'; } },
  GroupAdminNotFoundError:    class extends Error { constructor() { super(); this.name = 'GroupAdminNotFoundError'; } },
  GroupAlreadyArchivedError:  class extends Error { constructor() { super(); this.name = 'GroupAlreadyArchivedError'; } },
}));

jest.mock('@abroad-matrimony/verification', () => ({
  submitVerification: jest.fn(), getVerificationStatus: jest.fn(), getTrustScore: jest.fn(),
  getVerificationUploadUrl: jest.fn(),
  listVerifications: jest.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
  getVerificationAdmin: jest.fn().mockResolvedValue({}),
  approveVerification: jest.fn().mockResolvedValue({}), rejectVerification: jest.fn().mockResolvedValue({}),
  VerificationAlreadySubmittedError:  class extends Error { constructor() { super(); this.name = 'VerificationAlreadySubmittedError'; } },
  VerificationNotFoundError:          class extends Error { constructor() { super(); this.name = 'VerificationNotFoundError'; } },
  VerificationRequestNotFoundError:   class extends Error { constructor() { super(); this.name = 'VerificationRequestNotFoundError'; } },
  VerificationAlreadyReviewedError:   class extends Error { constructor() { super(); this.name = 'VerificationAlreadyReviewedError'; } },
}));

jest.mock('@abroad-matrimony/analytics', () => ({
  getKpiDashboard:      jest.fn().mockResolvedValue({}),
  getCohortRetention:   jest.fn().mockResolvedValue([]),
  getGroupAnalytics:    jest.fn().mockResolvedValue({}),
  getDropAnalytics:     jest.fn().mockResolvedValue({}),
  getAiAnalytics:       jest.fn().mockResolvedValue({}),
  getDiamondAnalytics:  jest.fn().mockResolvedValue({}),
}));

jest.mock('@abroad-matrimony/gatherings', () => ({
  listEvents: jest.fn().mockResolvedValue([]), getEvent: jest.fn().mockResolvedValue({}),
  rsvpToEvent: jest.fn(), cancelRsvp: jest.fn(), getEventAttendees: jest.fn().mockResolvedValue([]),
  listAdminEvents: jest.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
  getAdminEvent:   jest.fn().mockResolvedValue({}),
  createEvent:     jest.fn().mockResolvedValue({}),
  updateEvent:     jest.fn().mockResolvedValue({}),
  archiveEvent:    jest.fn().mockResolvedValue(undefined),
  EventNotFoundError:         class extends Error { constructor() { super(); this.name = 'EventNotFoundError'; } },
  AlreadyRsvpdError:          class extends Error { constructor() { super(); this.name = 'AlreadyRsvpdError'; } },
  NotRsvpdError:              class extends Error { constructor() { super(); this.name = 'NotRsvpdError'; } },
  EventFullError:             class extends Error { constructor() { super(); this.name = 'EventFullError'; } },
  EventNotUpcomingError:      class extends Error { constructor() { super(); this.name = 'EventNotUpcomingError'; } },
  EventAdminNotFoundError:    class extends Error { constructor() { super(); this.name = 'EventAdminNotFoundError'; } },
  EventAlreadyArchivedError:  class extends Error { constructor() { super(); this.name = 'EventAlreadyArchivedError'; } },
}));

jest.mock('@abroad-matrimony/prompts', () => ({
  getCurrentPrompt: jest.fn(), respondToPrompt: jest.fn(), getPromptResponses: jest.fn(),
  resonateResponse: jest.fn(), unresonateResponse: jest.fn(),
  listAdminPrompts: jest.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
  getAdminPrompt:   jest.fn().mockResolvedValue({}),
  createPrompt:     jest.fn().mockResolvedValue({}),
  updatePrompt:     jest.fn().mockResolvedValue({}),
  PromptNotFoundError:         class extends Error { constructor() { super(); this.name = 'PromptNotFoundError'; } },
  PromptResponseNotFoundError: class extends Error { constructor() { super(); this.name = 'PromptResponseNotFoundError'; } },
  AlreadyRespondedError:       class extends Error { constructor() { super(); this.name = 'AlreadyRespondedError'; } },
  AlreadyResonatedError:       class extends Error { constructor() { super(); this.name = 'AlreadyResonatedError'; } },
  ResonateNotFoundError:       class extends Error { constructor() { super(); this.name = 'ResonateNotFoundError'; } },
  PromptAdminNotFoundError:    class extends Error { constructor() { super(); this.name = 'PromptAdminNotFoundError'; } },
  PromptAlreadyExistsError:    class extends Error { constructor() { super(); this.name = 'PromptAlreadyExistsError'; } },
}));

jest.mock('@abroad-matrimony/ai', () => ({
  isAiConfigured:               jest.fn().mockReturnValue(false),
  proposeIntroductionDrops:     jest.fn().mockResolvedValue([]),
  generateEventPreConnections:  jest.fn().mockResolvedValue(null),
  getEmbeddingStatus:           jest.fn().mockResolvedValue({ totalUsers: 0, withEmbedding: 0, pendingEmbedding: 0, staleCutoffDate: new Date().toISOString() }),
  listEmbeddings:               jest.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
  recomputeEmbedding:           jest.fn().mockResolvedValue({ jobId: 'pi:u1', queued: true }),
  recomputeAllStaleEmbeddings:  jest.fn().mockResolvedValue({ jobsQueued: 0 }),
  UserEmbeddingNotFoundError:   class extends Error { constructor() { super(); this.name = 'UserEmbeddingNotFoundError'; } },
}));

jest.mock('../../../services/seeder-monitoring.service.js', () => ({
  getSeederStatus: jest.fn().mockResolvedValue({ seededCounts: { users: 0 } }),
  flushAllSeeded:  jest.fn().mockResolvedValue({ deleted: { users: 0 } }),
}));

jest.mock('@abroad-matrimony/introductions', () => ({
  listCurrentIntroductions: jest.fn().mockResolvedValue([]),
  listIntroductionHistory:  jest.fn().mockResolvedValue([]),
  acceptIntroduction:       jest.fn().mockResolvedValue(undefined),
  declineIntroduction:      jest.fn().mockResolvedValue(undefined),
  getWeekKey:               jest.fn().mockReturnValue('2026-W22'),
  listDropsForUser:         jest.fn().mockResolvedValue([]),
  getDropDetail:            jest.fn().mockResolvedValue({}),
  earlyAccessDrop:          jest.fn().mockResolvedValue(undefined),
  unlockDropEarly:          jest.fn().mockResolvedValue(undefined),
  listAllDrops:             jest.fn().mockResolvedValue([]),
  getDropAdmin:             jest.fn().mockResolvedValue({}),
  approveDrop:              jest.fn().mockResolvedValue({}),
  updateDropMembers:        jest.fn().mockResolvedValue({}),
  scheduleDropRelease:      jest.fn().mockResolvedValue({}),
  proposeNewDrop:           jest.fn().mockResolvedValue({}),
  IntroductionNotFoundError:       class extends Error { constructor() { super(); this.name = 'IntroductionNotFoundError'; } },
  IntroductionAlreadyActedError:   class extends Error { constructor() { super(); this.name = 'IntroductionAlreadyActedError'; } },
  IntroductionDropNotFoundError:   class extends Error { constructor() { super(); this.name = 'IntroductionDropNotFoundError'; } },
  DropNotLiveError:                class extends Error { constructor() { super(); this.name = 'DropNotLiveError'; } },
  InsufficientDiamondsForDropError: class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsForDropError'; } },
  AlreadyUnlockedError:            class extends Error { constructor() { super(); this.name = 'AlreadyUnlockedError'; } },
  DropNotDraftError:               class extends Error { constructor() { super(); this.name = 'DropNotDraftError'; } },
  DropNotEditableError:            class extends Error { constructor() { super(); this.name = 'DropNotEditableError'; } },
  DropMemberPoolTooSmallError:     class extends Error { constructor() { super(); this.name = 'DropMemberPoolTooSmallError'; } },
}));

// ─────────────────────────────────────────────────────────────────────────────

const authMock = jest.requireMock('@abroad-matrimony/auth') as any;
const UserNotFoundError         = authMock.UserNotFoundError as typeof Error;
const UserAlreadySuspendedError = authMock.UserAlreadySuspendedError as typeof Error;
const UserNotSuspendedError     = authMock.UserNotSuspendedError as typeof Error;

const app = createApp();

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const MOCK_USER = { id: USER_ID, phone: '+447911123456', email: null, role: 'USER', isSeeded: false };
const MOCK_LIST = { users: [MOCK_USER], hasMore: false, nextCursor: null };

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListUsers.mockResolvedValue(MOCK_LIST);
  });

  it('returns 200 with user list', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users).toHaveLength(1);
    expect(mockListUsers).toHaveBeenCalled();
  });

  it('passes search and status query params', async () => {
    mockListUsers.mockResolvedValue({ users: [], hasMore: false, nextCursor: null });
    const res = await request(app).get('/admin/users?search=john&status=ACTIVE');
    expect(res.status).toBe(200);
    expect(mockListUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'john', status: 'ACTIVE' }));
  });

  it('returns 500 on unexpected service error', async () => {
    mockListUsers.mockRejectedValue(new Error('DB failure'));
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/users/:userId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserDetail.mockResolvedValue(MOCK_USER);
  });

  it('returns 200 with user detail', async () => {
    const res = await request(app).get(`/admin/users/${USER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(USER_ID);
  });

  it('returns 404 when user not found', async () => {
    mockGetUserDetail.mockRejectedValue(new UserNotFoundError());
    const res = await request(app).get(`/admin/users/${USER_ID}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /admin/users/:userId/suspend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSuspendUser.mockResolvedValue(undefined);
  });

  it('returns 200 on successful suspend', async () => {
    const res = await request(app)
      .put(`/admin/users/${USER_ID}/suspend`)
      .send({ reason: 'Inappropriate behaviour' });
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('User suspended');
    expect(mockSuspendUser).toHaveBeenCalledWith(USER_ID, 'admin-uuid-1', 'Inappropriate behaviour', expect.any(String));
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(app).put(`/admin/users/${USER_ID}/suspend`).send({});
    expect(res.status).toBe(400);
    expect(mockSuspendUser).not.toHaveBeenCalled();
  });

  it('returns 409 when user already suspended', async () => {
    mockSuspendUser.mockRejectedValue(new UserAlreadySuspendedError());
    const res = await request(app)
      .put(`/admin/users/${USER_ID}/suspend`)
      .send({ reason: 'Test' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when user not found', async () => {
    mockSuspendUser.mockRejectedValue(new UserNotFoundError());
    const res = await request(app)
      .put(`/admin/users/${USER_ID}/suspend`)
      .send({ reason: 'Test' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /admin/users/:userId/unsuspend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsuspendUser.mockResolvedValue(undefined);
  });

  it('returns 200 on successful unsuspend', async () => {
    const res = await request(app).put(`/admin/users/${USER_ID}/unsuspend`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('User unsuspended');
  });

  it('returns 409 when user is not suspended', async () => {
    mockUnsuspendUser.mockRejectedValue(new UserNotSuspendedError());
    const res = await request(app).put(`/admin/users/${USER_ID}/unsuspend`);
    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /admin/users/:userId/ban', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBanUser.mockResolvedValue(undefined);
  });

  it('returns 200 on successful ban', async () => {
    const res = await request(app)
      .put(`/admin/users/${USER_ID}/ban`)
      .send({ reason: 'Serious misconduct' });
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('User banned and tokens revoked');
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(app).put(`/admin/users/${USER_ID}/ban`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockBanUser.mockRejectedValue(new UserNotFoundError());
    const res = await request(app)
      .put(`/admin/users/${USER_ID}/ban`)
      .send({ reason: 'Test' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /admin/users/:userId/seeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWipeSeededUser.mockResolvedValue({ deletedEntityTypes: ['profile', 'user'] });
  });

  it('returns 200 with deleted entity types', async () => {
    const res = await request(app).delete(`/admin/users/${USER_ID}/seeded`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedEntityTypes).toContain('user');
  });

  it('returns 404 when user not found', async () => {
    mockWipeSeededUser.mockRejectedValue(new UserNotFoundError());
    const res = await request(app).delete(`/admin/users/${USER_ID}/seeded`);
    expect(res.status).toBe(404);
  });
});
