import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListGroups               = jest.fn();
const mockGetGroup                 = jest.fn();
const mockJoinGroup                = jest.fn();
const mockLeaveGroup               = jest.fn();
const mockGetGroupMembers          = jest.fn();
const mockGetGroupEvents           = jest.fn();
const mockListSuggestedGroups      = jest.fn();
const mockGetSuggestedOnboarding   = jest.fn();
const mockCreatePost               = jest.fn();
const mockListPosts                = jest.fn();
const mockDeletePost               = jest.fn();
const mockLikePost                 = jest.fn();
const mockUnlikePost               = jest.fn();
const mockAddComment               = jest.fn();
const mockListComments             = jest.fn();
const mockProposeGroup             = jest.fn();

jest.mock('@abroad-matrimony/groups', () => ({
  listGroups:                     (...a: unknown[]) => mockListGroups(...a),
  getGroup:                       (...a: unknown[]) => mockGetGroup(...a),
  joinGroup:                      (...a: unknown[]) => mockJoinGroup(...a),
  leaveGroup:                     (...a: unknown[]) => mockLeaveGroup(...a),
  getGroupMembers:                (...a: unknown[]) => mockGetGroupMembers(...a),
  getGroupEvents:                 (...a: unknown[]) => mockGetGroupEvents(...a),
  listSuggestedGroups:            (...a: unknown[]) => mockListSuggestedGroups(...a),
  getSuggestedGroupsForOnboarding:(...a: unknown[]) => mockGetSuggestedOnboarding(...a),
  createPost:                     (...a: unknown[]) => mockCreatePost(...a),
  listPosts:                      (...a: unknown[]) => mockListPosts(...a),
  deletePost:                     (...a: unknown[]) => mockDeletePost(...a),
  likePost:                       (...a: unknown[]) => mockLikePost(...a),
  unlikePost:                     (...a: unknown[]) => mockUnlikePost(...a),
  addComment:                     (...a: unknown[]) => mockAddComment(...a),
  listComments:                   (...a: unknown[]) => mockListComments(...a),
  proposeGroup:                   (...a: unknown[]) => mockProposeGroup(...a),
  GroupNotFoundError:         class extends Error { constructor() { super('NOT_FOUND');        this.name = 'GroupNotFoundError'; } },
  AlreadyGroupMemberError:    class extends Error { constructor() { super('ALREADY_MEMBER');   this.name = 'AlreadyGroupMemberError'; } },
  AlreadyInGroupError:        class extends Error { constructor() { super('ALREADY_IN_GROUP'); this.name = 'AlreadyInGroupError'; } },
  NotGroupMemberError:        class extends Error { constructor() { super('NOT_MEMBER');       this.name = 'NotGroupMemberError'; } },
  NotInGroupError:            class extends Error { constructor() { super('NOT_IN_GROUP');     this.name = 'NotInGroupError'; } },
  GroupFullError:             class extends Error { constructor() { super('GROUP_FULL');       this.name = 'GroupFullError'; } },
  GroupAccessDeniedError:     class extends Error { constructor() { super('ACCESS_DENIED');   this.name = 'GroupAccessDeniedError'; } },
  PostNotFoundError:          class extends Error { constructor() { super('POST_NOT_FOUND');  this.name = 'PostNotFoundError'; } },
  PostForbiddenError:         class extends Error { constructor() { super('POST_FORBIDDEN');  this.name = 'PostForbiddenError'; } },
  GroupProposalNotFoundError: class extends Error { constructor() { super('NOT_FOUND');        this.name = 'GroupProposalNotFoundError'; } },
  AlreadyProposedError:       class extends Error { constructor() { super('ALREADY_PROPOSED'); this.name = 'AlreadyProposedError'; } },
  ProposalNotPendingError:    class extends Error { constructor() { super('NOT_PENDING');      this.name = 'ProposalNotPendingError'; } },
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
  getCreditTransactions:         jest.fn().mockResolvedValue([]),
  DIAMOND_PACKAGES: {},
  PaymentSignatureError:         class extends Error { constructor() { super(); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:          class extends Error { constructor() { super(); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:    class extends Error { constructor() { super(); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:     class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError:  class extends Error { constructor() { super(); this.name = 'MembershipAlreadyActiveError'; } },
}));

// Pull error constructors from the mock
const groupsMock = jest.requireMock('@abroad-matrimony/groups') as any;
const GroupNotFoundError        = groupsMock.GroupNotFoundError        as typeof Error;
const AlreadyGroupMemberError   = groupsMock.AlreadyGroupMemberError   as typeof Error;
const AlreadyInGroupError       = groupsMock.AlreadyInGroupError       as typeof Error;
const NotGroupMemberError       = groupsMock.NotGroupMemberError       as typeof Error;
const NotInGroupError           = groupsMock.NotInGroupError           as typeof Error;
const GroupFullError            = groupsMock.GroupFullError            as typeof Error;
const GroupAccessDeniedError    = groupsMock.GroupAccessDeniedError    as typeof Error;
const PostNotFoundError         = groupsMock.PostNotFoundError         as typeof Error;
const PostForbiddenError        = groupsMock.PostForbiddenError        as typeof Error;
const AlreadyProposedError      = groupsMock.AlreadyProposedError      as typeof Error;

const app = createApp();

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID  = 'user-uuid-1';
const GROUP_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const POST_ID  = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const GROUP_DTO = {
  id: GROUP_ID, name: 'UK Indians', country: 'UK', region: 'London',
  type: 'REGIONAL', status: 'ACTIVE', isMember: false, memberCount: 10, maxMembers: 50,
};

const POST_DTO = {
  id: POST_ID, groupId: GROUP_ID, authorId: USER_ID,
  text: 'Hello group!', isPinned: false, likesCount: 0, commentsCount: 0,
  createdAt: '2026-06-01T10:00:00.000Z', author: { name: 'Priya' },
};

const PAGINATED_MEMBERS = {
  members: [{ userId: USER_ID, name: 'Rahul', role: 'MEMBER', joinedAt: '2026-01-01T00:00:00.000Z', currentCity: 'London', currentCountry: 'UK' }],
  total: 1, page: 1, limit: 20,
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/v1/groups ─────────────────────────────────────────────────────────

describe('GET /api/v1/groups', () => {
  it('returns 200 with groups list', async () => {
    mockListGroups.mockResolvedValue([GROUP_DTO]);
    const res = await request(app).get('/api/v1/groups');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('passes country/region query params to service', async () => {
    mockListGroups.mockResolvedValue([]);
    await request(app).get('/api/v1/groups?country=UK&region=London');
    expect(mockListGroups).toHaveBeenCalledWith(USER_ID, 'UK', 'London');
  });

  it('returns 500 on unexpected error', async () => {
    mockListGroups.mockRejectedValueOnce(new Error('DB'));
    const res = await request(app).get('/api/v1/groups');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/groups/suggested ──────────────────────────────────────────────

describe('GET /api/v1/groups/suggested', () => {
  it('returns 200 with suggested groups', async () => {
    mockListSuggestedGroups.mockResolvedValue([GROUP_DTO]);
    const res = await request(app).get('/api/v1/groups/suggested');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockListSuggestedGroups.mockRejectedValueOnce(new Error('DB'));
    const res = await request(app).get('/api/v1/groups/suggested');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/groups/onboarding-suggestions ─────────────────────────────────

describe('GET /api/v1/groups/onboarding-suggestions', () => {
  it('returns 200 with onboarding suggestions', async () => {
    mockGetSuggestedOnboarding.mockResolvedValue([GROUP_DTO]);
    const res = await request(app).get('/api/v1/groups/onboarding-suggestions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ── GET /api/v1/groups/:groupId ────────────────────────────────────────────────

describe('GET /api/v1/groups/:groupId', () => {
  it('returns 200 with group details', async () => {
    mockGetGroup.mockResolvedValue({ ...GROUP_DTO, isMember: true });
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isMember).toBe(true);
  });

  it('returns 404 when group not found', async () => {
    mockGetGroup.mockRejectedValueOnce(new GroupNotFoundError());
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid UUID', async () => {
    const res = await request(app).get('/api/v1/groups/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/groups/:groupId/join ─────────────────────────────────────────

describe('POST /api/v1/groups/:groupId/join', () => {
  it('returns 200 on success', async () => {
    mockJoinGroup.mockResolvedValue(undefined);
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/join`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when group not found', async () => {
    mockJoinGroup.mockRejectedValueOnce(new GroupNotFoundError());
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/join`);
    expect(res.status).toBe(404);
  });

  it('returns 409 when already a member (AlreadyGroupMemberError)', async () => {
    mockJoinGroup.mockRejectedValueOnce(new AlreadyGroupMemberError());
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/join`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when already a member (AlreadyInGroupError)', async () => {
    mockJoinGroup.mockRejectedValueOnce(new AlreadyInGroupError());
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/join`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when group is full', async () => {
    mockJoinGroup.mockRejectedValueOnce(new GroupFullError());
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/join`);
    expect(res.status).toBe(409);
  });

  it('returns 403 when invite-only', async () => {
    mockJoinGroup.mockRejectedValueOnce(new GroupAccessDeniedError());
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/join`);
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/v1/groups/:groupId/leave ──────────────────────────────────────

describe('DELETE /api/v1/groups/:groupId/leave', () => {
  it('returns 200 on success', async () => {
    mockLeaveGroup.mockResolvedValue(undefined);
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/leave`);
    expect(res.status).toBe(200);
  });

  it('returns 403 when not a member (NotGroupMemberError)', async () => {
    mockLeaveGroup.mockRejectedValueOnce(new NotGroupMemberError());
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/leave`);
    expect(res.status).toBe(403);
  });

  it('returns 403 when not a member (NotInGroupError)', async () => {
    mockLeaveGroup.mockRejectedValueOnce(new NotInGroupError());
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/leave`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when group not found', async () => {
    mockLeaveGroup.mockRejectedValueOnce(new GroupNotFoundError());
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/leave`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/groups/:groupId/members ───────────────────────────────────────

describe('GET /api/v1/groups/:groupId/members', () => {
  it('returns 200 with paginated members', async () => {
    mockGetGroupMembers.mockResolvedValue(PAGINATED_MEMBERS);
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/members`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('returns 404 when group not found', async () => {
    mockGetGroupMembers.mockRejectedValueOnce(new GroupNotFoundError());
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/members`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/groups/:groupId/events ────────────────────────────────────────

describe('GET /api/v1/groups/:groupId/events', () => {
  it('returns 200 with events', async () => {
    mockGetGroupEvents.mockResolvedValue([{ id: 'event-1', title: 'Mixer' }]);
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/events`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 404 when group not found', async () => {
    mockGetGroupEvents.mockRejectedValueOnce(new GroupNotFoundError());
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/events`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/groups/:groupId/feed ─────────────────────────────────────────

describe('GET /api/v1/groups/:groupId/feed', () => {
  it('returns 200 with posts', async () => {
    mockListPosts.mockResolvedValue({ posts: [POST_DTO], total: 1, page: 1, limit: 20 });
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/feed`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockListPosts.mockRejectedValueOnce(new Error('DB'));
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/feed`);
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/groups/:groupId/posts ────────────────────────────────────────

describe('POST /api/v1/groups/:groupId/posts', () => {
  it('returns 201 on success', async () => {
    mockCreatePost.mockResolvedValue(POST_DTO);
    const res = await request(app)
      .post(`/api/v1/groups/${GROUP_ID}/posts`)
      .send({ text: 'Hello group!' });
    expect(res.status).toBe(201);
    expect(res.body.data.text).toBe('Hello group!');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${GROUP_ID}/posts`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 403 when not a group member', async () => {
    mockCreatePost.mockRejectedValueOnce(new NotInGroupError());
    const res = await request(app)
      .post(`/api/v1/groups/${GROUP_ID}/posts`)
      .send({ text: 'Hi' });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/v1/groups/:groupId/posts/:postId ──────────────────────────────

describe('DELETE /api/v1/groups/:groupId/posts/:postId', () => {
  it('returns 200 on success', async () => {
    mockDeletePost.mockResolvedValue(undefined);
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when post not found', async () => {
    mockDeletePost.mockRejectedValueOnce(new PostNotFoundError());
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the author', async () => {
    mockDeletePost.mockRejectedValueOnce(new PostForbiddenError());
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}`);
    expect(res.status).toBe(403);
  });
});

// ── POST /api/v1/groups/:groupId/posts/:postId/like ───────────────────────────

describe('POST /api/v1/groups/:groupId/posts/:postId/like', () => {
  it('returns 200 on success', async () => {
    mockLikePost.mockResolvedValue(undefined);
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/like`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when post not found', async () => {
    mockLikePost.mockRejectedValueOnce(new PostNotFoundError());
    const res = await request(app).post(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/like`);
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/groups/:groupId/posts/:postId/like ────────────────────────

describe('DELETE /api/v1/groups/:groupId/posts/:postId/like', () => {
  it('returns 200 on success', async () => {
    mockUnlikePost.mockResolvedValue(undefined);
    const res = await request(app).delete(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/like`);
    expect(res.status).toBe(200);
  });
});

// ── POST /api/v1/groups/:groupId/posts/:postId/comments ───────────────────────

describe('POST /api/v1/groups/:groupId/posts/:postId/comments', () => {
  it('returns 201 with comment', async () => {
    mockAddComment.mockResolvedValue({
      id: 'comment-1', postId: POST_ID, authorId: USER_ID,
      text: 'Great post!', createdAt: '2026-06-01T11:00:00.000Z', author: { name: 'Priya' },
    });
    const res = await request(app)
      .post(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/comments`)
      .send({ text: 'Great post!' });
    expect(res.status).toBe(201);
    expect(res.body.data.text).toBe('Great post!');
  });

  it('returns 400 when text is empty', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/comments`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when post not found', async () => {
    mockAddComment.mockRejectedValueOnce(new PostNotFoundError());
    const res = await request(app)
      .post(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/comments`)
      .send({ text: 'Hi' });
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/groups/:groupId/posts/:postId/comments ───────────────────────

describe('GET /api/v1/groups/:groupId/posts/:postId/comments', () => {
  it('returns 200 with paginated comments', async () => {
    mockListComments.mockResolvedValue({
      comments: [{ id: 'c1', text: 'Hi', postId: POST_ID, authorId: USER_ID, createdAt: '2026-06-01T11:00:00.000Z', author: { name: 'Priya' } }],
      total: 1, page: 1, limit: 20,
    });
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 404 when post not found', async () => {
    mockListComments.mockRejectedValueOnce(new PostNotFoundError());
    const res = await request(app).get(`/api/v1/groups/${GROUP_ID}/posts/${POST_ID}/comments`);
    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/groups/proposals ────────────────────────────────────────────

describe('POST /api/v1/groups/proposals', () => {
  const PROPOSAL_BODY = {
    name: 'Tamil Engineers UK',
    description: 'A group for Tamil engineers in the UK with networking events',
    country: 'United Kingdom',
    rationale: 'Connect Tamil engineers in UK for networking',
  };

  it('returns 201 with proposal', async () => {
    mockProposeGroup.mockResolvedValue({
      id: 'proposal-1', ...PROPOSAL_BODY, type: 'INTEREST',
      proposedByUserId: USER_ID, status: 'PENDING', createdAt: '2026-06-01T00:00:00.000Z',
    });
    const res = await request(app)
      .post('/api/v1/groups/proposals')
      .send(PROPOSAL_BODY);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/groups/proposals')
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when already proposed', async () => {
    mockProposeGroup.mockRejectedValueOnce(new AlreadyProposedError());
    const res = await request(app)
      .post('/api/v1/groups/proposals')
      .send(PROPOSAL_BODY);
    expect(res.status).toBe(409);
  });
});
