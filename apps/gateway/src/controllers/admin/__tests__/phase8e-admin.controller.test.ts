/**
 * Phase 8e — Admin API integration tests (batch).
 * Covers ADMIN-003 through ADMIN-017 endpoint controllers.
 */
import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Shared mock functions ──────────────────────────────────────────────────────

// ADMIN-003 Feature Flags
const mockListFeatureFlags  = jest.fn();
const mockGetFeatureFlag    = jest.fn();
const mockCreateFeatureFlag = jest.fn();
const mockUpdateFeatureFlag = jest.fn();
const mockDeleteFeatureFlag = jest.fn();

// ADMIN-005 Audit log
const mockListAuditLogs = jest.fn();

// ADMIN-007 Analytics
const mockGetKpi            = jest.fn();
const mockGetCohort         = jest.fn();
const mockGetGroupAnalytics = jest.fn();
const mockGetDropAnalytics  = jest.fn();
const mockGetAiAnalytics    = jest.fn();
const mockGetDiamondAnalytics = jest.fn();

// ADMIN-008 Events
const mockListAdminEvents = jest.fn();
const mockGetAdminEvent   = jest.fn();
const mockCreateEvent     = jest.fn();
const mockUpdateEvent     = jest.fn();
const mockArchiveEvent    = jest.fn();

// ADMIN-009 Prompts
const mockListAdminPrompts = jest.fn();
const mockGetAdminPrompt   = jest.fn();
const mockCreatePrompt     = jest.fn();
const mockUpdatePrompt     = jest.fn();

// ADMIN-010 Group CRUD
const mockListAdminGroups   = jest.fn();
const mockGetAdminGroup     = jest.fn();
const mockCreateAdminGroup  = jest.fn();
const mockUpdateAdminGroup  = jest.fn();
const mockArchiveAdminGroup = jest.fn();

// ADMIN-012 AI proposals
const mockProposeDrops           = jest.fn();
const mockGeneratePreConnections = jest.fn();

// ADMIN-014 System config
const mockListSystemConfig  = jest.fn();
const mockGetSystemConfig   = jest.fn();
const mockUpsertSystemConfig = jest.fn();
const mockCreateSystemConfig = jest.fn();
const mockDeleteSystemConfig = jest.fn();

// ADMIN-015 Seeder monitoring
const mockGetSeederStatus = jest.fn();
const mockFlushAllSeeded  = jest.fn();

// ADMIN-016 AI monitoring
const mockGetEmbeddingStatus          = jest.fn();
const mockListEmbeddings              = jest.fn();
const mockRecomputeEmbedding          = jest.fn();
const mockRecomputeAllStaleEmbeddings = jest.fn();

// ADMIN-004 Verification
const mockListVerifications   = jest.fn();
const mockGetVerificationAdmin = jest.fn();
const mockApproveVerification = jest.fn();
const mockRejectVerification  = jest.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', role: 'USER', deviceId: 'd1' };
    next();
  },
  requireRole:      jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole: jest.fn(() => (req: any, _res: any, next: any) => {
    req.admin = { id: 'admin-uuid-1', role: 'SUPERADMIN', email: 'admin@test.com' };
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
  listUsers:          jest.fn().mockResolvedValue({ users: [], hasMore: false, nextCursor: null }),
  getUserAdminDetail: jest.fn().mockResolvedValue({}),
  suspendUser:        jest.fn().mockResolvedValue(undefined),
  unsuspendUser:      jest.fn().mockResolvedValue(undefined),
  banUser:            jest.fn().mockResolvedValue(undefined),
  wipeSeededUser:     jest.fn().mockResolvedValue({ deletedEntityTypes: [] }),
  UserNotFoundError:         class extends Error { constructor() { super(); this.name = 'UserNotFoundError'; } },
  UserAlreadySuspendedError: class extends Error { constructor() { super(); this.name = 'UserAlreadySuspendedError'; } },
  UserNotSuspendedError:     class extends Error { constructor() { super(); this.name = 'UserNotSuspendedError'; } },
  listAuditLogs: (...a: any[]) => mockListAuditLogs(...a),
  auditLog:      jest.fn().mockResolvedValue(undefined),
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
  listFeatureFlags:  (...a: any[]) => mockListFeatureFlags(...a),
  getFeatureFlag:    (...a: any[]) => mockGetFeatureFlag(...a),
  createFeatureFlag: (...a: any[]) => mockCreateFeatureFlag(...a),
  updateFeatureFlag: (...a: any[]) => mockUpdateFeatureFlag(...a),
  deleteFeatureFlag: (...a: any[]) => mockDeleteFeatureFlag(...a),
  FeatureFlagNotFoundError:      class extends Error { constructor() { super(); this.name = 'FeatureFlagNotFoundError'; } },
  FeatureFlagAlreadyExistsError: class extends Error { constructor() { super(); this.name = 'FeatureFlagAlreadyExistsError'; } },
  listSystemConfig:   (...a: any[]) => mockListSystemConfig(...a),
  getSystemConfig:    (...a: any[]) => mockGetSystemConfig(...a),
  upsertSystemConfig: (...a: any[]) => mockUpsertSystemConfig(...a),
  createSystemConfig: (...a: any[]) => mockCreateSystemConfig(...a),
  deleteSystemConfig: (...a: any[]) => mockDeleteSystemConfig(...a),
  SystemConfigNotFoundError:        class extends Error { constructor() { super(); this.name = 'SystemConfigNotFoundError'; } },
  SystemConfigAlreadyExistsError:   class extends Error { constructor() { super(); this.name = 'SystemConfigAlreadyExistsError'; } },
  SystemConfigDeleteProtectedError: class extends Error { constructor() { super(); this.name = 'SystemConfigDeleteProtectedError'; } },
  SystemConfigValidationError:      class extends Error { constructor(m?: string) { super(m); this.name = 'SystemConfigValidationError'; } },
}));

jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations:         jest.fn().mockResolvedValue([]),
  getConversation:           jest.fn().mockResolvedValue({}),
  getConversationMessages:   jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:               jest.fn().mockResolvedValue({}),
  getUploadUrl:              jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError: class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError: class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:  class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead:        jest.fn().mockResolvedValue(undefined),
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  createFirebaseToken:  jest.fn().mockResolvedValue('token'),
  FirebaseNotConfiguredError: class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage:         jest.fn().mockResolvedValue({ id: 'flag-1' }),
  MessageNotFoundError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:  class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:        class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  getAdminFlagSummary:  jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag:          jest.fn().mockResolvedValue({ id: 'flag-1' }),
  FlagNotFoundError:    class extends Error { constructor() { super(); this.name = 'FlagNotFoundError'; } },
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
  joinGroup: jest.fn(), leaveGroup: jest.fn(),
  getGroupMembers: jest.fn().mockResolvedValue({ members: [], total: 0, page: 1, limit: 20 }),
  getGroupEvents: jest.fn().mockResolvedValue([]),
  listSuggestedGroups: jest.fn().mockResolvedValue([]),
  getSuggestedGroupsForOnboarding: jest.fn().mockResolvedValue([]),
  createPost: jest.fn().mockResolvedValue({}), listPosts: jest.fn().mockResolvedValue({ posts: [], total: 0 }),
  deletePost: jest.fn(), likePost: jest.fn(), unlikePost: jest.fn(),
  addComment: jest.fn().mockResolvedValue({}), listComments: jest.fn().mockResolvedValue({ comments: [], total: 0 }),
  proposeGroup: jest.fn().mockResolvedValue({}),
  getGroupProposals:    jest.fn().mockResolvedValue([]),
  approveGroupProposal: jest.fn().mockResolvedValue({}),
  rejectGroupProposal:  jest.fn().mockResolvedValue({}),
  pinPost: jest.fn().mockResolvedValue(undefined), unpinPost: jest.fn().mockResolvedValue(undefined),
  listAdminGroups:   (...a: any[]) => mockListAdminGroups(...a),
  getAdminGroup:     (...a: any[]) => mockGetAdminGroup(...a),
  createAdminGroup:  (...a: any[]) => mockCreateAdminGroup(...a),
  updateAdminGroup:  (...a: any[]) => mockUpdateAdminGroup(...a),
  archiveAdminGroup: (...a: any[]) => mockArchiveAdminGroup(...a),
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
  submitVerification: jest.fn(), getVerificationStatus: jest.fn(),
  getTrustScore: jest.fn(), getVerificationUploadUrl: jest.fn(),
  listVerifications:    (...a: any[]) => mockListVerifications(...a),
  getVerificationAdmin: (...a: any[]) => mockGetVerificationAdmin(...a),
  approveVerification:  (...a: any[]) => mockApproveVerification(...a),
  rejectVerification:   (...a: any[]) => mockRejectVerification(...a),
  VerificationAlreadySubmittedError: class extends Error { constructor() { super(); this.name = 'VerificationAlreadySubmittedError'; } },
  VerificationNotFoundError:         class extends Error { constructor() { super(); this.name = 'VerificationNotFoundError'; } },
  VerificationRequestNotFoundError:  class extends Error { constructor() { super(); this.name = 'VerificationRequestNotFoundError'; } },
  VerificationAlreadyReviewedError:  class extends Error { constructor() { super(); this.name = 'VerificationAlreadyReviewedError'; } },
}));

jest.mock('@abroad-matrimony/analytics', () => ({
  getKpiDashboard:      (...a: any[]) => mockGetKpi(...a),
  getCohortRetention:   (...a: any[]) => mockGetCohort(...a),
  getGroupAnalytics:    (...a: any[]) => mockGetGroupAnalytics(...a),
  getDropAnalytics:     (...a: any[]) => mockGetDropAnalytics(...a),
  getAiAnalytics:       (...a: any[]) => mockGetAiAnalytics(...a),
  getDiamondAnalytics:  (...a: any[]) => mockGetDiamondAnalytics(...a),
}));

jest.mock('@abroad-matrimony/gatherings', () => ({
  listEvents: jest.fn().mockResolvedValue([]), getEvent: jest.fn().mockResolvedValue({}),
  rsvpToEvent: jest.fn(), cancelRsvp: jest.fn(), getEventAttendees: jest.fn().mockResolvedValue([]),
  listAdminEvents: (...a: any[]) => mockListAdminEvents(...a),
  getAdminEvent:   (...a: any[]) => mockGetAdminEvent(...a),
  createEvent:     (...a: any[]) => mockCreateEvent(...a),
  updateEvent:     (...a: any[]) => mockUpdateEvent(...a),
  archiveEvent:    (...a: any[]) => mockArchiveEvent(...a),
  EventNotFoundError:        class extends Error { constructor() { super(); this.name = 'EventNotFoundError'; } },
  AlreadyRsvpdError:         class extends Error { constructor() { super(); this.name = 'AlreadyRsvpdError'; } },
  NotRsvpdError:             class extends Error { constructor() { super(); this.name = 'NotRsvpdError'; } },
  EventFullError:            class extends Error { constructor() { super(); this.name = 'EventFullError'; } },
  EventNotUpcomingError:     class extends Error { constructor() { super(); this.name = 'EventNotUpcomingError'; } },
  EventAdminNotFoundError:   class extends Error { constructor() { super(); this.name = 'EventAdminNotFoundError'; } },
  EventAlreadyArchivedError: class extends Error { constructor() { super(); this.name = 'EventAlreadyArchivedError'; } },
}));

jest.mock('@abroad-matrimony/prompts', () => ({
  getCurrentPrompt: jest.fn(), respondToPrompt: jest.fn(),
  getPromptResponses: jest.fn(), resonateResponse: jest.fn(), unresonateResponse: jest.fn(),
  listAdminPrompts: (...a: any[]) => mockListAdminPrompts(...a),
  getAdminPrompt:   (...a: any[]) => mockGetAdminPrompt(...a),
  createPrompt:     (...a: any[]) => mockCreatePrompt(...a),
  updatePrompt:     (...a: any[]) => mockUpdatePrompt(...a),
  PromptNotFoundError:         class extends Error { constructor() { super(); this.name = 'PromptNotFoundError'; } },
  PromptResponseNotFoundError: class extends Error { constructor() { super(); this.name = 'PromptResponseNotFoundError'; } },
  AlreadyRespondedError:       class extends Error { constructor() { super(); this.name = 'AlreadyRespondedError'; } },
  AlreadyResonatedError:       class extends Error { constructor() { super(); this.name = 'AlreadyResonatedError'; } },
  ResonateNotFoundError:       class extends Error { constructor() { super(); this.name = 'ResonateNotFoundError'; } },
  PromptAdminNotFoundError:    class extends Error { constructor() { super(); this.name = 'PromptAdminNotFoundError'; } },
  PromptAlreadyExistsError:    class extends Error { constructor() { super(); this.name = 'PromptAlreadyExistsError'; } },
}));

jest.mock('@abroad-matrimony/ai', () => ({
  isAiConfigured:              jest.fn().mockReturnValue(false),
  proposeIntroductionDrops:    (...a: any[]) => mockProposeDrops(...a),
  generateEventPreConnections: (...a: any[]) => mockGeneratePreConnections(...a),
  getEmbeddingStatus:          (...a: any[]) => mockGetEmbeddingStatus(...a),
  listEmbeddings:              (...a: any[]) => mockListEmbeddings(...a),
  recomputeEmbedding:          (...a: any[]) => mockRecomputeEmbedding(...a),
  recomputeAllStaleEmbeddings: (...a: any[]) => mockRecomputeAllStaleEmbeddings(...a),
  UserEmbeddingNotFoundError:  class extends Error { constructor() { super(); this.name = 'UserEmbeddingNotFoundError'; } },
}));

jest.mock('../../../services/seeder-monitoring.service.js', () => ({
  getSeederStatus: (...a: any[]) => mockGetSeederStatus(...a),
  flushAllSeeded:  (...a: any[]) => mockFlushAllSeeded(...a),
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
  IntroductionNotFoundError:        class extends Error { constructor() { super(); this.name = 'IntroductionNotFoundError'; } },
  IntroductionAlreadyActedError:    class extends Error { constructor() { super(); this.name = 'IntroductionAlreadyActedError'; } },
  IntroductionDropNotFoundError:    class extends Error { constructor() { super(); this.name = 'IntroductionDropNotFoundError'; } },
  DropNotLiveError:                 class extends Error { constructor() { super(); this.name = 'DropNotLiveError'; } },
  InsufficientDiamondsForDropError: class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsForDropError'; } },
  AlreadyUnlockedError:             class extends Error { constructor() { super(); this.name = 'AlreadyUnlockedError'; } },
  DropNotDraftError:                class extends Error { constructor() { super(); this.name = 'DropNotDraftError'; } },
  DropNotEditableError:             class extends Error { constructor() { super(); this.name = 'DropNotEditableError'; } },
  DropMemberPoolTooSmallError:      class extends Error { constructor() { super(); this.name = 'DropMemberPoolTooSmallError'; } },
}));

// ─── App + shared fixtures ────────────────────────────────────────────────────

const app = createApp();

const configMock = jest.requireMock('@abroad-matrimony/config') as any;
const FeatureFlagNotFoundError        = configMock.FeatureFlagNotFoundError as typeof Error;
const FeatureFlagAlreadyExistsError   = configMock.FeatureFlagAlreadyExistsError as typeof Error;
const SystemConfigNotFoundError       = configMock.SystemConfigNotFoundError as typeof Error;
const SystemConfigDeleteProtectedError = configMock.SystemConfigDeleteProtectedError as typeof Error;

const verificationMock = jest.requireMock('@abroad-matrimony/verification') as any;
const VerificationRequestNotFoundError = verificationMock.VerificationRequestNotFoundError as typeof Error;
const VerificationAlreadyReviewedError = verificationMock.VerificationAlreadyReviewedError as typeof Error;

const gatheringsMock = jest.requireMock('@abroad-matrimony/gatherings') as any;
const EventAdminNotFoundError   = gatheringsMock.EventAdminNotFoundError as typeof Error;
const EventAlreadyArchivedError = gatheringsMock.EventAlreadyArchivedError as typeof Error;

const promptsMock = jest.requireMock('@abroad-matrimony/prompts') as any;
const PromptAdminNotFoundError  = promptsMock.PromptAdminNotFoundError as typeof Error;
const PromptAlreadyExistsError  = promptsMock.PromptAlreadyExistsError as typeof Error;

const groupsMock = jest.requireMock('@abroad-matrimony/groups') as any;
const GroupAdminNotFoundError   = groupsMock.GroupAdminNotFoundError as typeof Error;
const GroupAlreadyArchivedError = groupsMock.GroupAlreadyArchivedError as typeof Error;

const aiMock = jest.requireMock('@abroad-matrimony/ai') as any;
const UserEmbeddingNotFoundError = aiMock.UserEmbeddingNotFoundError as typeof Error;

const FLAG_KEY    = 'new-feature-2026';
const CONFIG_KEY  = 'SUGGESTED_GROUPS_MAX';
const REQUEST_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EVENT_ID    = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROMPT_ID   = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const GROUP_ID    = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const USER_ID     = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const MOCK_FLAG = { id: '1', key: FLAG_KEY, description: 'Test', enabled: true, rolloutPercentage: 100, allowedUserIds: [], allowedEnvironments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const MOCK_CONFIG = { key: CONFIG_KEY, value: '20', description: null, updatedAt: new Date().toISOString() };
const MOCK_EVENT = { id: EVENT_ID, title: 'Annual Gala', status: 'UPCOMING', startAt: new Date().toISOString(), rsvpCount: 0 };
const MOCK_PROMPT = { id: PROMPT_ID, weekKey: '2026-W22', question: 'What inspires you?', responseCount: 0 };
const MOCK_GROUP = { id: GROUP_ID, name: 'UK Indians', type: 'REGIONAL', status: 'ACTIVE', memberCount: 10 };

// ─── ADMIN-003: Feature Flags ─────────────────────────────────────────────────

describe('GET /admin/feature-flags', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListFeatureFlags.mockResolvedValue([MOCK_FLAG]); });

  it('returns 200 with flags list', async () => {
    const res = await request(app).get('/admin/feature-flags');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockListFeatureFlags).toHaveBeenCalled();
  });

  it('returns 500 on service error', async () => {
    mockListFeatureFlags.mockRejectedValue(new Error('DB fail'));
    const res = await request(app).get('/admin/feature-flags');
    expect(res.status).toBe(500);
  });
});

describe('GET /admin/feature-flags/:flagKey', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetFeatureFlag.mockResolvedValue(MOCK_FLAG); });

  it('returns 200 with flag', async () => {
    const res = await request(app).get(`/admin/feature-flags/${FLAG_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.key).toBe(FLAG_KEY);
  });

  it('returns 404 when not found', async () => {
    mockGetFeatureFlag.mockRejectedValue(new FeatureFlagNotFoundError());
    const res = await request(app).get(`/admin/feature-flags/${FLAG_KEY}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /admin/feature-flags', () => {
  beforeEach(() => { jest.clearAllMocks(); mockCreateFeatureFlag.mockResolvedValue(MOCK_FLAG); });

  it('returns 201 with created flag', async () => {
    const res = await request(app).post('/admin/feature-flags').send({ key: FLAG_KEY, enabled: true });
    expect(res.status).toBe(201);
    expect(mockCreateFeatureFlag).toHaveBeenCalled();
  });

  it('returns 400 when key is missing', async () => {
    const res = await request(app).post('/admin/feature-flags').send({ enabled: true });
    expect(res.status).toBe(400);
  });

  it('returns 409 when flag already exists', async () => {
    mockCreateFeatureFlag.mockRejectedValue(new FeatureFlagAlreadyExistsError());
    const res = await request(app).post('/admin/feature-flags').send({ key: FLAG_KEY });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /admin/feature-flags/:flagKey', () => {
  beforeEach(() => { jest.clearAllMocks(); mockUpdateFeatureFlag.mockResolvedValue({ ...MOCK_FLAG, enabled: false }); });

  it('returns 200 with updated flag', async () => {
    const res = await request(app).patch(`/admin/feature-flags/${FLAG_KEY}`).send({ enabled: false });
    expect(res.status).toBe(200);
    expect(mockUpdateFeatureFlag).toHaveBeenCalledWith(FLAG_KEY, expect.objectContaining({ enabled: false }));
  });

  it('returns 404 when not found', async () => {
    mockUpdateFeatureFlag.mockRejectedValue(new FeatureFlagNotFoundError());
    const res = await request(app).patch(`/admin/feature-flags/${FLAG_KEY}`).send({ enabled: false });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /admin/feature-flags/:flagKey', () => {
  beforeEach(() => { jest.clearAllMocks(); mockDeleteFeatureFlag.mockResolvedValue(undefined); });

  it('returns 200 on success', async () => {
    const res = await request(app).delete(`/admin/feature-flags/${FLAG_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Feature flag deleted');
  });

  it('returns 404 when not found', async () => {
    mockDeleteFeatureFlag.mockRejectedValue(new FeatureFlagNotFoundError());
    const res = await request(app).delete(`/admin/feature-flags/${FLAG_KEY}`);
    expect(res.status).toBe(404);
  });
});

// ─── ADMIN-004: Verification ──────────────────────────────────────────────────

describe('GET /admin/verification', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListVerifications.mockResolvedValue({ items: [], hasMore: false, nextCursor: null }); });

  it('returns 200 with empty list', async () => {
    const res = await request(app).get('/admin/verification');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('GET /admin/verification/:requestId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetVerificationAdmin.mockResolvedValue({ id: REQUEST_ID, status: 'PENDING' }); });

  it('returns 200 with verification detail', async () => {
    const res = await request(app).get(`/admin/verification/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(REQUEST_ID);
  });

  it('returns 404 when not found', async () => {
    mockGetVerificationAdmin.mockRejectedValue(new VerificationRequestNotFoundError());
    const res = await request(app).get(`/admin/verification/${REQUEST_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /admin/verification/:requestId/approve', () => {
  beforeEach(() => { jest.clearAllMocks(); mockApproveVerification.mockResolvedValue({ id: REQUEST_ID, status: 'APPROVED' }); });

  it('returns 200 on success', async () => {
    const res = await request(app).post(`/admin/verification/${REQUEST_ID}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Verification approved');
  });

  it('returns 409 when already reviewed', async () => {
    mockApproveVerification.mockRejectedValue(new VerificationAlreadyReviewedError());
    const res = await request(app).post(`/admin/verification/${REQUEST_ID}/approve`);
    expect(res.status).toBe(409);
  });
});

describe('POST /admin/verification/:requestId/reject', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRejectVerification.mockResolvedValue({ id: REQUEST_ID, status: 'REJECTED' }); });

  it('returns 200 on success', async () => {
    const res = await request(app).post(`/admin/verification/${REQUEST_ID}/reject`).send({ reason: 'Document unclear' });
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Verification rejected');
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(app).post(`/admin/verification/${REQUEST_ID}/reject`).send({});
    expect(res.status).toBe(400);
  });
});

// ─── ADMIN-005: Audit Log ─────────────────────────────────────────────────────

describe('GET /admin/audit-log', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListAuditLogs.mockResolvedValue({ entries: [], hasMore: false, nextCursor: null }); });

  it('returns 200 with audit log entries', async () => {
    const res = await request(app).get('/admin/audit-log');
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(0);
    expect(mockListAuditLogs).toHaveBeenCalled();
  });

  it('passes filter params to service', async () => {
    const res = await request(app).get('/admin/audit-log?action=SUSPEND_USER&entity=User');
    expect(res.status).toBe(200);
    expect(mockListAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUSPEND_USER', entity: 'User' }));
  });
});

// ─── ADMIN-007: Analytics ─────────────────────────────────────────────────────

describe('GET /admin/analytics/kpi', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetKpi.mockResolvedValue({ period: { from: '', to: '' }, users: { newRegistrations: 10 } }); });

  it('returns 200 with KPI data', async () => {
    const res = await request(app).get('/admin/analytics/kpi');
    expect(res.status).toBe(200);
    expect(res.body.data.users.newRegistrations).toBe(10);
  });
});

describe('GET /admin/analytics/cohort', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetCohort.mockResolvedValue([{ cohortDate: '2026-01-01', registered: 5 }]); });

  it('returns 200 with cohort data', async () => {
    const res = await request(app).get('/admin/analytics/cohort');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /admin/analytics/groups', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetGroupAnalytics.mockResolvedValue({ postCount: 5 }); });

  it('returns 200 with group analytics', async () => {
    const res = await request(app).get('/admin/analytics/groups');
    expect(res.status).toBe(200);
    expect(res.body.data.postCount).toBe(5);
  });
});

describe('GET /admin/analytics/drops', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetDropAnalytics.mockResolvedValue({ introAcceptRate: '70%' }); });

  it('returns 200 with drop analytics', async () => {
    const res = await request(app).get('/admin/analytics/drops');
    expect(res.status).toBe(200);
    expect(res.body.data.introAcceptRate).toBe('70%');
  });
});

describe('GET /admin/analytics/ai', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetAiAnalytics.mockResolvedValue({ embeddingCoveragePercent: '80%' }); });

  it('returns 200 with AI analytics', async () => {
    const res = await request(app).get('/admin/analytics/ai');
    expect(res.status).toBe(200);
    expect(res.body.data.embeddingCoveragePercent).toBe('80%');
  });
});

describe('GET /admin/analytics/diamonds', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetDiamondAnalytics.mockResolvedValue({ totalSpentPaise: 5000 }); });

  it('returns 200 with diamond analytics', async () => {
    const res = await request(app).get('/admin/analytics/diamonds');
    expect(res.status).toBe(200);
    expect(res.body.data.totalSpentPaise).toBe(5000);
  });
});

// ─── ADMIN-008: Events ────────────────────────────────────────────────────────

describe('GET /admin/events', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListAdminEvents.mockResolvedValue({ items: [MOCK_EVENT], hasMore: false, nextCursor: null }); });

  it('returns 200 with events list', async () => {
    const res = await request(app).get('/admin/events');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('POST /admin/events', () => {
  beforeEach(() => { jest.clearAllMocks(); mockCreateEvent.mockResolvedValue(MOCK_EVENT); });

  it('returns 201 with created event', async () => {
    const res = await request(app).post('/admin/events').send({ title: 'Annual Gala', startAt: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(201);
    expect(mockCreateEvent).toHaveBeenCalled();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/admin/events').send({ startAt: new Date().toISOString() });
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/events/:eventId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetAdminEvent.mockResolvedValue(MOCK_EVENT); });

  it('returns 200 with event detail', async () => {
    const res = await request(app).get(`/admin/events/${EVENT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(EVENT_ID);
  });

  it('returns 404 when not found', async () => {
    mockGetAdminEvent.mockRejectedValue(new EventAdminNotFoundError());
    const res = await request(app).get(`/admin/events/${EVENT_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /admin/events/:eventId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockUpdateEvent.mockResolvedValue(MOCK_EVENT); });

  it('returns 200 with updated event', async () => {
    const res = await request(app).patch(`/admin/events/${EVENT_ID}`).send({ title: 'Updated Gala' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /admin/events/:eventId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockArchiveEvent.mockResolvedValue(undefined); });

  it('returns 200 on success', async () => {
    const res = await request(app).delete(`/admin/events/${EVENT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Event archived');
  });

  it('returns 409 when already archived', async () => {
    mockArchiveEvent.mockRejectedValue(new EventAlreadyArchivedError());
    const res = await request(app).delete(`/admin/events/${EVENT_ID}`);
    expect(res.status).toBe(409);
  });
});

// ─── ADMIN-009: Prompts ───────────────────────────────────────────────────────

describe('GET /admin/prompts', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListAdminPrompts.mockResolvedValue({ items: [MOCK_PROMPT], hasMore: false, nextCursor: null }); });

  it('returns 200 with prompts list', async () => {
    const res = await request(app).get('/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('POST /admin/prompts', () => {
  beforeEach(() => { jest.clearAllMocks(); mockCreatePrompt.mockResolvedValue(MOCK_PROMPT); });

  it('returns 201 with created prompt', async () => {
    const res = await request(app).post('/admin/prompts').send({ question: 'What inspires you?' });
    expect(res.status).toBe(201);
  });

  it('returns 409 when prompt already exists for week', async () => {
    mockCreatePrompt.mockRejectedValue(new PromptAlreadyExistsError());
    const res = await request(app).post('/admin/prompts').send({ question: 'What inspires you?' });
    expect(res.status).toBe(409);
  });
});

describe('GET /admin/prompts/:promptId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetAdminPrompt.mockResolvedValue(MOCK_PROMPT); });

  it('returns 200 with prompt detail', async () => {
    const res = await request(app).get(`/admin/prompts/${PROMPT_ID}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockGetAdminPrompt.mockRejectedValue(new PromptAdminNotFoundError());
    const res = await request(app).get(`/admin/prompts/${PROMPT_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /admin/prompts/:promptId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockUpdatePrompt.mockResolvedValue(MOCK_PROMPT); });

  it('returns 200 on success', async () => {
    const res = await request(app).patch(`/admin/prompts/${PROMPT_ID}`).send({ theme: 'Culture' });
    expect(res.status).toBe(200);
  });
});

// ─── ADMIN-010: Group CRUD ────────────────────────────────────────────────────

describe('GET /admin/groups', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListAdminGroups.mockResolvedValue({ items: [MOCK_GROUP], hasMore: false, nextCursor: null }); });

  it('returns 200 with groups list', async () => {
    const res = await request(app).get('/admin/groups');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('POST /admin/groups', () => {
  beforeEach(() => { jest.clearAllMocks(); mockCreateAdminGroup.mockResolvedValue(MOCK_GROUP); });

  it('returns 201 with created group', async () => {
    const res = await request(app).post('/admin/groups').send({ name: 'UK Indians', type: 'REGIONAL' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/admin/groups').send({ type: 'REGIONAL' });
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid group type', async () => {
    const res = await request(app).post('/admin/groups').send({ name: 'Test', type: 'INVALID' });
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/groups/:groupId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetAdminGroup.mockResolvedValue(MOCK_GROUP); });

  it('returns 200 with group detail', async () => {
    const res = await request(app).get(`/admin/groups/${GROUP_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('UK Indians');
  });

  it('returns 404 when not found', async () => {
    mockGetAdminGroup.mockRejectedValue(new GroupAdminNotFoundError());
    const res = await request(app).get(`/admin/groups/${GROUP_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /admin/groups/:groupId', () => {
  beforeEach(() => { jest.clearAllMocks(); mockArchiveAdminGroup.mockResolvedValue(undefined); });

  it('returns 200 on success', async () => {
    const res = await request(app).delete(`/admin/groups/${GROUP_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Group archived');
  });

  it('returns 409 when already archived', async () => {
    mockArchiveAdminGroup.mockRejectedValue(new GroupAlreadyArchivedError());
    const res = await request(app).delete(`/admin/groups/${GROUP_ID}`);
    expect(res.status).toBe(409);
  });
});

// ─── ADMIN-012: AI Proposals ──────────────────────────────────────────────────

describe('POST /admin/ai/drops/propose', () => {
  beforeEach(() => { jest.clearAllMocks(); mockProposeDrops.mockResolvedValue([{ id: 'draft-1' }]); });

  it('returns 200 with proposed drops', async () => {
    const res = await request(app).post('/admin/ai/drops/propose').send({ region: 'United Kingdom' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 400 when region is missing', async () => {
    const res = await request(app).post('/admin/ai/drops/propose').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /admin/ai/events/:eventId/pre-connections', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGeneratePreConnections.mockResolvedValue({ id: 'drop-1' }); });

  it('returns 200 with pre-connection drop', async () => {
    const res = await request(app).post(`/admin/ai/events/${EVENT_ID}/pre-connections`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Pre-connection drop created');
  });

  it('returns 200 with "not enough attendees" when null returned', async () => {
    mockGeneratePreConnections.mockResolvedValue(null);
    const res = await request(app).post(`/admin/ai/events/${EVENT_ID}/pre-connections`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Not enough attendees for pre-connections');
  });
});

// ─── ADMIN-014: System Config ─────────────────────────────────────────────────

describe('GET /admin/system-config', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListSystemConfig.mockResolvedValue([MOCK_CONFIG]); });

  it('returns 200 with config list', async () => {
    const res = await request(app).get('/admin/system-config');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /admin/system-config', () => {
  beforeEach(() => { jest.clearAllMocks(); mockCreateSystemConfig.mockResolvedValue(MOCK_CONFIG); });

  it('returns 201 with created config', async () => {
    const res = await request(app).post('/admin/system-config').send({ key: CONFIG_KEY, value: '25' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when key is missing', async () => {
    const res = await request(app).post('/admin/system-config').send({ value: '25' });
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/system-config/:configKey', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetSystemConfig.mockResolvedValue(MOCK_CONFIG); });

  it('returns 200 with config entry', async () => {
    const res = await request(app).get(`/admin/system-config/${CONFIG_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.key).toBe(CONFIG_KEY);
  });

  it('returns 404 when not found', async () => {
    mockGetSystemConfig.mockRejectedValue(new SystemConfigNotFoundError());
    const res = await request(app).get(`/admin/system-config/${CONFIG_KEY}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /admin/system-config/:configKey', () => {
  beforeEach(() => { jest.clearAllMocks(); mockUpsertSystemConfig.mockResolvedValue({ ...MOCK_CONFIG, value: '25' }); });

  it('returns 200 on success', async () => {
    const res = await request(app).put(`/admin/system-config/${CONFIG_KEY}`).send({ value: '25' });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe('25');
  });

  it('returns 400 when value is missing', async () => {
    const res = await request(app).put(`/admin/system-config/${CONFIG_KEY}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /admin/system-config/:configKey', () => {
  beforeEach(() => { jest.clearAllMocks(); mockDeleteSystemConfig.mockResolvedValue(undefined); });

  it('returns 200 on success', async () => {
    const res = await request(app).delete(`/admin/system-config/${CONFIG_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Config key deleted');
  });

  it('returns 403 when key is protected', async () => {
    mockDeleteSystemConfig.mockRejectedValue(new SystemConfigDeleteProtectedError());
    const res = await request(app).delete(`/admin/system-config/${CONFIG_KEY}`);
    expect(res.status).toBe(403);
  });
});

// ─── ADMIN-015: Seeder Monitoring ────────────────────────────────────────────

describe('GET /admin/seeder/status', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetSeederStatus.mockResolvedValue({ seededCounts: { users: 12, profiles: 12 } }); });

  it('returns 200 with seeder status', async () => {
    const res = await request(app).get('/admin/seeder/status');
    expect(res.status).toBe(200);
    expect(res.body.data.seededCounts.users).toBe(12);
  });
});

describe('POST /admin/seeder/flush', () => {
  beforeEach(() => { jest.clearAllMocks(); mockFlushAllSeeded.mockResolvedValue({ deleted: { users: 12 } }); });

  it('returns 200 with flush result', async () => {
    const res = await request(app).post('/admin/seeder/flush');
    expect(res.status).toBe(200);
    expect(res.body.meta.message).toBe('Seeded data flushed');
    expect(res.body.data.deleted.users).toBe(12);
  });

  it('returns 500 on service error', async () => {
    mockFlushAllSeeded.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/admin/seeder/flush');
    expect(res.status).toBe(500);
  });
});

// ─── ADMIN-016: AI Monitoring ─────────────────────────────────────────────────

describe('GET /admin/ai/embeddings/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEmbeddingStatus.mockResolvedValue({ totalUsers: 100, withEmbedding: 80, pendingEmbedding: 20, staleCutoffDate: new Date().toISOString() });
  });

  it('returns 200 with embedding status', async () => {
    const res = await request(app).get('/admin/ai/embeddings/status');
    expect(res.status).toBe(200);
    expect(res.body.data.totalUsers).toBe(100);
    expect(res.body.data.pendingEmbedding).toBe(20);
  });
});

describe('GET /admin/ai/embeddings', () => {
  beforeEach(() => { jest.clearAllMocks(); mockListEmbeddings.mockResolvedValue({ items: [], hasMore: false, nextCursor: null }); });

  it('returns 200 with embeddings list', async () => {
    const res = await request(app).get('/admin/ai/embeddings');
    expect(res.status).toBe(200);
    expect(mockListEmbeddings).toHaveBeenCalled();
  });
});

describe('POST /admin/ai/embeddings/:userId/recompute', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRecomputeEmbedding.mockResolvedValue({ jobId: `pi:${USER_ID}`, queued: true }); });

  it('returns 200 with job info', async () => {
    const res = await request(app).post(`/admin/ai/embeddings/${USER_ID}/recompute`);
    expect(res.status).toBe(200);
    expect(res.body.data.queued).toBe(true);
    expect(res.body.meta.message).toBe('Profile intelligence job enqueued');
  });

  it('returns 404 when user not found', async () => {
    mockRecomputeEmbedding.mockRejectedValue(new UserEmbeddingNotFoundError());
    const res = await request(app).post(`/admin/ai/embeddings/${USER_ID}/recompute`);
    expect(res.status).toBe(404);
  });
});

describe('POST /admin/ai/embeddings/recompute-all', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRecomputeAllStaleEmbeddings.mockResolvedValue({ jobsQueued: 45 }); });

  it('returns 200 with jobs queued count', async () => {
    const res = await request(app).post('/admin/ai/embeddings/recompute-all');
    expect(res.status).toBe(200);
    expect(res.body.data.jobsQueued).toBe(45);
    expect(res.body.meta.message).toBe('Bulk recompute enqueued');
  });
});
