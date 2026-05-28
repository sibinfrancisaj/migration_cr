import {
  listConversations,
  getConversation,
  getConversationMessages,
  ConversationNotFoundError,
  ConversationForbiddenError,
} from '../conversation.service.js';
import { MockMessagingAdapter } from '../adapters/mock.messaging.adapter.js';
import { MessageType } from '../types/messaging.types.js';

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockConversationFindMany = jest.fn();
const mockConversationFindUnique = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    conversation: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany:  (...a: any[]) => mockConversationFindMany(...a),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: (...a: any[]) => mockConversationFindUnique(...a),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ─── Adapter mock ─────────────────────────────────────────────────────────────

const mockAdapter = new MockMessagingAdapter();

jest.mock('../adapters/index.js', () => ({
  getMessagingAdapter: () => mockAdapter,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_A = 'user-a-id';
const USER_B = 'user-b-id';
const CONV_ID = 'conv-uuid-001';
const MATCH_ID = 'match-uuid-001';

function makeConversationRow(overrides: Partial<{
  id: string;
  matchId: string;
  userAId: string;
  userBId: string;
  lastMessageAt: Date | null;
  isArchived: boolean;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? CONV_ID,
    matchId: overrides.matchId ?? MATCH_ID,
    lastMessageAt: overrides.lastMessageAt !== undefined ? overrides.lastMessageAt : null,
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt ?? new Date('2026-05-28T10:00:00.000Z'),
    match: {
      userAId: overrides.userAId ?? USER_A,
      userBId: overrides.userBId ?? USER_B,
      userA: {
        id: overrides.userAId ?? USER_A,
        profile: { name: 'Alice' },
        media: [{ url: 'https://cdn.example.com/alice.jpg' }],
      },
      userB: {
        id: overrides.userBId ?? USER_B,
        profile: { name: 'Bob' },
        media: [],
      },
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listConversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter._reset();
    mockConversationFindMany.mockResolvedValue([makeConversationRow()]);
  });

  it('returns conversations mapped to ConversationSummaryDto', async () => {
    const result = await listConversations(USER_A);

    expect(result).toHaveLength(1);
    expect(result[0].conversationId).toBe(CONV_ID);
    expect(result[0].matchId).toBe(MATCH_ID);
    expect(result[0].isArchived).toBe(false);
    expect(result[0].unreadCount).toBe(0);
  });

  it('resolves otherUser as userB when caller is userA', async () => {
    const result = await listConversations(USER_A);

    expect(result[0].otherUser.userId).toBe(USER_B);
    expect(result[0].otherUser.name).toBe('Bob');
    expect(result[0].otherUser.photoUrl).toBeNull(); // userB has no photo
  });

  it('resolves otherUser as userA when caller is userB', async () => {
    const result = await listConversations(USER_B);

    expect(result[0].otherUser.userId).toBe(USER_A);
    expect(result[0].otherUser.name).toBe('Alice');
    expect(result[0].otherUser.photoUrl).toBe('https://cdn.example.com/alice.jpg');
  });

  it('converts lastMessageAt Date to ISO string', async () => {
    const ts = new Date('2026-05-28T12:00:00.000Z');
    mockConversationFindMany.mockResolvedValue([makeConversationRow({ lastMessageAt: ts })]);

    const result = await listConversations(USER_A);

    expect(result[0].lastMessageAt).toBe(ts.toISOString());
  });

  it('returns null lastMessageAt when no messages yet', async () => {
    const result = await listConversations(USER_A);
    expect(result[0].lastMessageAt).toBeNull();
  });

  it('returns empty array when user has no conversations', async () => {
    mockConversationFindMany.mockResolvedValue([]);
    const result = await listConversations(USER_A);
    expect(result).toHaveLength(0);
  });

  it('sets otherUser.name to empty string when profile is null', async () => {
    const row = makeConversationRow();
    row.match.userB.profile = null as unknown as { name: string };
    mockConversationFindMany.mockResolvedValue([row]);

    const result = await listConversations(USER_A);

    expect(result[0].otherUser.name).toBe('');
  });

  it('passes correct where clause to prisma (filters by userId)', async () => {
    await listConversations(USER_A);

    expect(mockConversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          match: {
            OR: [{ userAId: USER_A }, { userBId: USER_A }],
          },
        },
      }),
    );
  });
});

describe('getConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConversationFindUnique.mockResolvedValue(makeConversationRow());
  });

  it('returns ConversationSummaryDto for valid participant', async () => {
    const result = await getConversation(USER_A, CONV_ID);

    expect(result.conversationId).toBe(CONV_ID);
    expect(result.otherUser.userId).toBe(USER_B);
  });

  it('throws ConversationNotFoundError when conversation does not exist', async () => {
    mockConversationFindUnique.mockResolvedValue(null);

    await expect(getConversation(USER_A, CONV_ID)).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it('throws ConversationForbiddenError when caller is not a participant', async () => {
    await expect(getConversation('user-stranger', CONV_ID)).rejects.toBeInstanceOf(ConversationForbiddenError);
  });

  it('allows userB to access the conversation', async () => {
    const result = await getConversation(USER_B, CONV_ID);
    expect(result.conversationId).toBe(CONV_ID);
    expect(result.otherUser.userId).toBe(USER_A);
  });
});

describe('getConversationMessages', () => {
  const LIMIT = 20;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter._reset();
    // Lightweight row for auth check
    mockConversationFindUnique.mockResolvedValue({
      id: CONV_ID,
      match: { userAId: USER_A, userBId: USER_B },
    });
  });

  it('returns paginated messages from the adapter', async () => {
    // Pre-load messages into the mock adapter
    await mockAdapter.sendMessage({ conversationId: CONV_ID, senderId: USER_A, type: MessageType.TEXT, content: 'hi' });
    await mockAdapter.sendMessage({ conversationId: CONV_ID, senderId: USER_B, type: MessageType.TEXT, content: 'hello' });

    const result = await getConversationMessages(USER_A, CONV_ID, LIMIT);

    expect(result.messages).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it('throws ConversationNotFoundError when conversation does not exist', async () => {
    mockConversationFindUnique.mockResolvedValue(null);

    await expect(getConversationMessages(USER_A, CONV_ID, LIMIT)).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it('throws ConversationForbiddenError when caller is not a participant', async () => {
    await expect(
      getConversationMessages('user-stranger', CONV_ID, LIMIT),
    ).rejects.toBeInstanceOf(ConversationForbiddenError);
  });

  it('passes cursor to adapter getMessages', async () => {
    const getMessagesSpy = jest.spyOn(mockAdapter, 'getMessages');
    const cursor = '2026-05-28T12:00:00.000Z';

    await getConversationMessages(USER_A, CONV_ID, LIMIT, cursor);

    expect(getMessagesSpy).toHaveBeenCalledWith(CONV_ID, LIMIT, cursor);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await mockAdapter.sendMessage({ conversationId: CONV_ID, senderId: USER_A, type: MessageType.TEXT, content: `msg-${i}` });
      await new Promise((r) => setTimeout(r, 1));
    }

    const result = await getConversationMessages(USER_A, CONV_ID, 3);

    expect(result.messages).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });
});
