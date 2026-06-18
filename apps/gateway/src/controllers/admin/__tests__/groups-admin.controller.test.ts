/**
 * GRP-R-006 — Admin group endpoints integration tests.
 *
 * Covers:
 *   GET  /admin/groups/proposals
 *   POST /admin/groups/proposals/:proposalId/approve
 *   POST /admin/groups/proposals/:proposalId/reject
 *   POST /admin/groups/:groupId/posts/:postId/pin
 *   DELETE /admin/groups/:groupId/posts/:postId/pin
 */
import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockGetGroupProposals      = jest.fn();
const mockApproveGroupProposal   = jest.fn();
const mockRejectGroupProposal    = jest.fn();
const mockPinPost                = jest.fn();
const mockUnpinPost              = jest.fn();

jest.mock('@abroad-matrimony/groups', () => ({
  // User-facing group functions (stubs — not tested here)
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
  // Admin group functions (under test)
  getGroupProposals:               (...a: unknown[]) => mockGetGroupProposals(...a),
  approveGroupProposal:            (...a: unknown[]) => mockApproveGroupProposal(...a),
  rejectGroupProposal:             (...a: unknown[]) => mockRejectGroupProposal(...a),
  pinPost:                         (...a: unknown[]) => mockPinPost(...a),
  unpinPost:                       (...a: unknown[]) => mockUnpinPost(...a),
  // Error classes
  GroupNotFoundError:          class extends Error { constructor() { super('NOT_FOUND');         this.name = 'GroupNotFoundError'; } },
  AlreadyGroupMemberError:     class extends Error { constructor() { super('ALREADY_MEMBER');    this.name = 'AlreadyGroupMemberError'; } },
  AlreadyInGroupError:         class extends Error { constructor() { super('ALREADY_IN_GROUP');  this.name = 'AlreadyInGroupError'; } },
  NotGroupMemberError:         class extends Error { constructor() { super('NOT_MEMBER');        this.name = 'NotGroupMemberError'; } },
  NotInGroupError:             class extends Error { constructor() { super('NOT_IN_GROUP');      this.name = 'NotInGroupError'; } },
  GroupFullError:              class extends Error { constructor() { super('GROUP_FULL');        this.name = 'GroupFullError'; } },
  GroupAccessDeniedError:      class extends Error { constructor() { super('ACCESS_DENIED');    this.name = 'GroupAccessDeniedError'; } },
  PostNotFoundError:           class extends Error { constructor() { super('POST_NOT_FOUND');   this.name = 'PostNotFoundError'; } },
  PostForbiddenError:          class extends Error { constructor() { super('POST_FORBIDDEN');   this.name = 'PostForbiddenError'; } },
  GroupProposalNotFoundError:  class extends Error { constructor() { super('NOT_FOUND');         this.name = 'GroupProposalNotFoundError'; } },
  AlreadyProposedError:        class extends Error { constructor() { super('ALREADY_PROPOSED');  this.name = 'AlreadyProposedError'; } },
  ProposalNotPendingError:     class extends Error { constructor() { super('NOT_PENDING');       this.name = 'ProposalNotPendingError'; } },
}));

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  requireRole:              jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole:         jest.fn(() => (req: any, _res: any, next: any) => {
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
  DIAMOND_PACKAGES: {},
  PaymentSignatureError:         class extends Error { constructor() { super(); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:          class extends Error { constructor() { super(); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:    class extends Error { constructor() { super(); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:     class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError:  class extends Error { constructor() { super(); this.name = 'MembershipAlreadyActiveError'; } },
}));

// ── Error class accessors ────────────────────────────────────────────────────

const groupsMock = jest.requireMock('@abroad-matrimony/groups') as any;
const GroupProposalNotFoundError = groupsMock.GroupProposalNotFoundError as typeof Error;
const ProposalNotPendingError    = groupsMock.ProposalNotPendingError    as typeof Error;
const PostNotFoundError          = groupsMock.PostNotFoundError          as typeof Error;

const app = createApp();

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_ID     = 'admin-uuid-1';
const PROPOSAL_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GROUP_ID     = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const POST_ID      = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const MOCK_PROPOSAL = {
  id: PROPOSAL_ID,
  userId: 'user-uuid-1',
  name: 'Board Game Enthusiasts',
  description: 'A group for Indians abroad who love board games.',
  country: 'United Kingdom',
  rationale: 'No existing group for this interest in the UK.',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
};

const APPROVED_PROPOSAL = { ...MOCK_PROPOSAL, status: 'APPROVED' };
const REJECTED_PROPOSAL = { ...MOCK_PROPOSAL, status: 'REJECTED', rejectionReason: 'Too niche' };

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/groups/proposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGroupProposals.mockResolvedValue([MOCK_PROPOSAL]);
  });

  it('returns 200 with proposals list (default: all)', async () => {
    const res = await request(app).get('/admin/groups/proposals');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(PROPOSAL_ID);
    expect(mockGetGroupProposals).toHaveBeenCalledWith(undefined);
  });

  it('passes status filter to service when provided', async () => {
    mockGetGroupProposals.mockResolvedValue([]);
    const res = await request(app).get('/admin/groups/proposals?status=PENDING');

    expect(res.status).toBe(200);
    expect(mockGetGroupProposals).toHaveBeenCalledWith('PENDING');
  });

  it('returns 400 for invalid status enum value', async () => {
    const res = await request(app).get('/admin/groups/proposals?status=INVALID');
    expect(res.status).toBe(400);
    expect(mockGetGroupProposals).not.toHaveBeenCalled();
  });

  it('returns 500 when service throws', async () => {
    mockGetGroupProposals.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/admin/groups/proposals');
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /admin/groups/proposals/:proposalId/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApproveGroupProposal.mockResolvedValue(APPROVED_PROPOSAL);
  });

  it('returns 200 with approved proposal on success', async () => {
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
    expect(mockApproveGroupProposal).toHaveBeenCalledWith(ADMIN_ID, PROPOSAL_ID);
  });

  it('returns 404 when proposal not found', async () => {
    mockApproveGroupProposal.mockRejectedValue(new GroupProposalNotFoundError());
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/approve`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when proposal is not PENDING', async () => {
    mockApproveGroupProposal.mockRejectedValue(new ProposalNotPendingError());
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/approve`);

    expect(res.status).toBe(409);
  });

  it('returns 400 when proposalId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/admin/groups/proposals/not-a-uuid/approve');

    expect(res.status).toBe(400);
    expect(mockApproveGroupProposal).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /admin/groups/proposals/:proposalId/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRejectGroupProposal.mockResolvedValue(REJECTED_PROPOSAL);
  });

  it('returns 200 with rejected proposal on success', async () => {
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/reject`)
      .send({ reason: 'Too niche' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(mockRejectGroupProposal).toHaveBeenCalledWith(ADMIN_ID, PROPOSAL_ID, 'Too niche');
  });

  it('rejects without reason when body is empty', async () => {
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/reject`);

    expect(res.status).toBe(200);
    expect(mockRejectGroupProposal).toHaveBeenCalledWith(ADMIN_ID, PROPOSAL_ID, undefined);
  });

  it('returns 404 when proposal not found', async () => {
    mockRejectGroupProposal.mockRejectedValue(new GroupProposalNotFoundError());
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/reject`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when proposal is not PENDING', async () => {
    mockRejectGroupProposal.mockRejectedValue(new ProposalNotPendingError());
    const res = await request(app)
      .post(`/admin/groups/proposals/${PROPOSAL_ID}/reject`);

    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /admin/groups/:groupId/posts/:postId/pin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPinPost.mockResolvedValue(undefined);
  });

  it('returns 200 with PINNED message on success', async () => {
    const res = await request(app)
      .post(`/admin/groups/${GROUP_ID}/posts/${POST_ID}/pin`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.message).toBe('Post pinned');
    expect(mockPinPost).toHaveBeenCalledWith(ADMIN_ID, POST_ID);
  });

  it('returns 404 when post not found', async () => {
    mockPinPost.mockRejectedValue(new PostNotFoundError());
    const res = await request(app)
      .post(`/admin/groups/${GROUP_ID}/posts/${POST_ID}/pin`);

    expect(res.status).toBe(404);
  });

  it('returns 400 when postId is not a valid UUID', async () => {
    const res = await request(app)
      .post(`/admin/groups/${GROUP_ID}/posts/not-a-uuid/pin`);

    expect(res.status).toBe(400);
    expect(mockPinPost).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /admin/groups/:groupId/posts/:postId/pin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnpinPost.mockResolvedValue(undefined);
  });

  it('returns 200 with UNPINNED message on success', async () => {
    const res = await request(app)
      .delete(`/admin/groups/${GROUP_ID}/posts/${POST_ID}/pin`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.message).toBe('Post unpinned');
    expect(mockUnpinPost).toHaveBeenCalledWith(ADMIN_ID, POST_ID);
  });

  it('returns 404 when post not found', async () => {
    mockUnpinPost.mockRejectedValue(new PostNotFoundError());
    const res = await request(app)
      .delete(`/admin/groups/${GROUP_ID}/posts/${POST_ID}/pin`);

    expect(res.status).toBe(404);
  });
});
