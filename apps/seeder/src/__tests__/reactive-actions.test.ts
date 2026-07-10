/**
 * Tests for reactive-actions.ts
 * All gateway calls are mocked via jest.fn() on the axios client.
 */

// Must mock gateway-client before importing services (asUser needs SEEDER_SECRET)
jest.mock('../lib/gateway-client.js', () => ({
  asUser: jest.fn().mockReturnValue({ headers: { Authorization: 'Bearer test-token' } }),
}));

import {
  acceptOrDeclineConnections,
  respondToIntroductions,
  likeAndCommentOnGroupPosts,
  resonateWithPromptResponses,
  runReactiveActions,
} from '../services/reactive-actions.js';
import type { BotPersona } from '../lib/bot-state.js';

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mockPut = jest.fn().mockResolvedValue({ data: { success: true } });
const mockPost = jest.fn().mockResolvedValue({ data: { success: true } });
const mockClient = { put: mockPut, post: mockPost } as any;

const highPersona: BotPersona = {
  aggressiveness: 0.9,
  chattiness: 0.9,
  habitConsistency: 0.9,
  connectionAcceptRate: 0.99,  // always accepts
  introAcceptRate: 0.99,
};

const lowPersona: BotPersona = {
  aggressiveness: 0.2,
  chattiness: 0.05,             // rarely chats
  habitConsistency: 0.2,
  connectionAcceptRate: 0.01,  // always declines
  introAcceptRate: 0.01,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Math, 'random').mockRestore();
});

// ── acceptOrDeclineConnections ────────────────────────────────────────────────

describe('acceptOrDeclineConnections', () => {
  function makePrisma(connections: { id: string }[]) {
    return {
      connection: {
        findMany: jest.fn().mockResolvedValue(connections),
      },
    } as any;
  }

  it('calls PUT /accept when random < connectionAcceptRate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.99
    const prisma = makePrisma([{ id: 'conn-1' }, { id: 'conn-2' }]);
    const count = await acceptOrDeclineConnections('user-a', prisma, mockClient, highPersona);
    expect(count).toBe(2);
    expect(mockPut).toHaveBeenCalledWith('/api/v1/connections/conn-1/accept', {}, expect.any(Object));
    expect(mockPut).toHaveBeenCalledWith('/api/v1/connections/conn-2/accept', {}, expect.any(Object));
  });

  it('calls PUT /decline when random > connectionAcceptRate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // 0.99 > 0.01
    const prisma = makePrisma([{ id: 'conn-3' }]);
    const count = await acceptOrDeclineConnections('user-a', prisma, mockClient, lowPersona);
    expect(count).toBe(1);
    expect(mockPut).toHaveBeenCalledWith('/api/v1/connections/conn-3/decline', {}, expect.any(Object));
  });

  it('returns 0 when no pending connections', async () => {
    const prisma = makePrisma([]);
    const count = await acceptOrDeclineConnections('user-a', prisma, mockClient, highPersona);
    expect(count).toBe(0);
    expect(mockPut).not.toHaveBeenCalled();
  });
});

// ── respondToIntroductions ────────────────────────────────────────────────────

describe('respondToIntroductions', () => {
  function makePrisma(intros: { id: string }[]) {
    return {
      introduction: { findMany: jest.fn().mockResolvedValue(intros) },
    } as any;
  }

  it('POSTs /accept for high introAcceptRate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const prisma = makePrisma([{ id: 'intro-1' }]);
    const count = await respondToIntroductions('user-a', prisma, mockClient, highPersona);
    expect(count).toBe(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/introductions/intro-1/accept', {}, expect.any(Object));
  });

  it('POSTs /decline for low introAcceptRate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const prisma = makePrisma([{ id: 'intro-2' }]);
    const count = await respondToIntroductions('user-a', prisma, mockClient, lowPersona);
    expect(count).toBe(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/introductions/intro-2/decline', {}, expect.any(Object));
  });

  it('returns 0 when no pending intros', async () => {
    const prisma = makePrisma([]);
    const count = await respondToIntroductions('user-a', prisma, mockClient, highPersona);
    expect(count).toBe(0);
  });
});

// ── likeAndCommentOnGroupPosts ────────────────────────────────────────────────

describe('likeAndCommentOnGroupPosts', () => {
  function makePrisma(membership: any, post: any) {
    return {
      groupMembership: { findFirst: jest.fn().mockResolvedValue(membership) },
      groupPost: { findFirst: jest.fn().mockResolvedValue(post) },
    } as any;
  }

  it('likes the post and comments when chattiness is high', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.05); // below all thresholds
    const prisma = makePrisma(
      { groupId: 'g-1' },
      { id: 'p-1', groupId: 'g-1' },
    );
    const result = await likeAndCommentOnGroupPosts('user-a', prisma, mockClient, highPersona);
    expect(result.liked).toBe(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/groups/g-1/posts/p-1/like', {}, expect.any(Object));
    // Comment also expected since random 0.05 < 0.9 * 0.4
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/groups/g-1/posts/p-1/comments',
      expect.objectContaining({ content: expect.any(String) }),
      expect.any(Object),
    );
  });

  it('does not like or comment when no post found', async () => {
    const prisma = makePrisma({ groupId: 'g-1' }, null);
    const result = await likeAndCommentOnGroupPosts('user-a', prisma, mockClient, highPersona);
    expect(result.liked).toBe(0);
    expect(result.commented).toBe(0);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does nothing when user has no group membership', async () => {
    const prisma = makePrisma(null, null);
    const result = await likeAndCommentOnGroupPosts('user-a', prisma, mockClient, highPersona);
    expect(result.liked).toBe(0);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ── resonateWithPromptResponses ───────────────────────────────────────────────

describe('resonateWithPromptResponses', () => {
  function makePrisma(response: any) {
    return {
      promptResponse: { findFirst: jest.fn().mockResolvedValue(response) },
    } as any;
  }

  it('resonates when chattiness threshold met', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 < 0.9
    const prisma = makePrisma({ id: 'resp-1' });
    const count = await resonateWithPromptResponses('user-a', prisma, mockClient, highPersona);
    expect(count).toBe(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/prompts/responses/resp-1/resonate', {}, expect.any(Object));
  });

  it('skips when random > chattiness (low persona)', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // 0.99 > 0.05
    const prisma = makePrisma({ id: 'resp-2' });
    const count = await resonateWithPromptResponses('user-a', prisma, mockClient, lowPersona);
    expect(count).toBe(0);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('returns 0 when no responses found', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.05);
    const prisma = makePrisma(null);
    const count = await resonateWithPromptResponses('user-a', prisma, mockClient, highPersona);
    expect(count).toBe(0);
  });
});

// ── runReactiveActions orchestrator ──────────────────────────────────────────

describe('runReactiveActions', () => {
  it('returns aggregated result with all zero counts when nothing pending', async () => {
    const prisma = {
      connection: { findMany: jest.fn().mockResolvedValue([]) },
      introduction: { findMany: jest.fn().mockResolvedValue([]) },
      groupMembership: { findFirst: jest.fn().mockResolvedValue(null) },
      groupPost: { findFirst: jest.fn().mockResolvedValue(null) },
      promptResponse: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const result = await runReactiveActions('user-a', prisma, mockClient, highPersona);
    expect(result).toEqual({
      connectionsHandled: 0,
      introsHandled: 0,
      postsLiked: 0,
      commentsAdded: 0,
      responsesResonated: 0,
    });
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
