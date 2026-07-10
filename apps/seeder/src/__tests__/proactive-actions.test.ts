/**
 * Tests for proactive-actions.ts
 */

jest.mock('../lib/gateway-client.js', () => ({
  asUser: jest.fn().mockReturnValue({ headers: { Authorization: 'Bearer test-token' } }),
}));

import {
  sendConnectionRequest,
  postInGroup,
  logHabit,
  rsvpToEvent,
  respondToPrompt,
  logProfileView,
  earlyAccessDrop,
} from '../services/proactive-actions.js';

const mockPost = jest.fn().mockResolvedValue({ data: { success: true } });
const mockClient = { post: mockPost } as any;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Math, 'random').mockRestore();
});

// ── sendConnectionRequest ─────────────────────────────────────────────────────

describe('sendConnectionRequest', () => {
  it('calls POST /connections with targetUserId', async () => {
    const prisma = {
      connection: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'target-1' }) },
    } as any;

    const result = await sendConnectionRequest('user-a', prisma, mockClient);
    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/connections',
      expect.objectContaining({ targetUserId: 'target-1' }),
      expect.any(Object),
    );
  });

  it('excludes already-connected users from target pool', async () => {
    const prisma = {
      connection: {
        findMany: jest.fn().mockResolvedValue([
          { requesterId: 'user-a', recipientId: 'taken-1' },
          { requesterId: 'taken-2', recipientId: 'user-a' },
        ]),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'new-target' }) },
    } as any;

    await sendConnectionRequest('user-a', prisma, mockClient);
    const findFirstCall = prisma.user.findFirst.mock.calls[0][0];
    // isSeeded filter removed so bots can reach real users too
    expect(findFirstCall.where.isSeeded).toBeUndefined();
    expect(findFirstCall.where.id.notIn).toContain('taken-1');
    expect(findFirstCall.where.id.notIn).toContain('taken-2');
    expect(findFirstCall.where.id.notIn).toContain('user-a');
  });

  it('returns false when no target found', async () => {
    const prisma = {
      connection: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const result = await sendConnectionRequest('user-a', prisma, mockClient);
    expect(result).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ── postInGroup ───────────────────────────────────────────────────────────────

describe('postInGroup', () => {
  it('calls POST /groups/:id/posts with { content } field', async () => {
    const prisma = {
      groupMembership: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({ groupId: 'g-1' }),
      },
    } as any;

    const result = await postInGroup('user-a', prisma, mockClient);
    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/groups/g-1/posts',
      expect.objectContaining({ content: expect.any(String) }),
      expect.any(Object),
    );
    // Confirm it does NOT send { text }
    const body = mockPost.mock.calls[0][1];
    expect(body).not.toHaveProperty('text');
  });

  it('returns false when user has no group memberships', async () => {
    const prisma = {
      groupMembership: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const result = await postInGroup('user-a', prisma, mockClient);
    expect(result).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ── logHabit ──────────────────────────────────────────────────────────────────

describe('logHabit', () => {
  const VALID_HABIT_KEYS = [
    'MORNING_ROUTINE', 'EXERCISE', 'HEALTHY_EATING', 'MEDITATION', 'READING',
    'JOURNALING', 'LEARNING', 'FAMILY_TIME', 'SOCIAL_CONNECTION', 'GRATITUDE',
  ];

  it('calls POST /api/v1/habits/:habitKey/log with a valid habit key (not an ID)', async () => {
    const prisma = {
      habitLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const result = await logHabit('user-a', prisma, mockClient);
    expect(result).toBe(true);

    const url: string = mockPost.mock.calls[0][0];
    expect(url).toMatch(/^\/api\/v1\/habits\/(MORNING_ROUTINE|EXERCISE|HEALTHY_EATING|MEDITATION|READING|JOURNALING|LEARNING|FAMILY_TIME|SOCIAL_CONNECTION|GRATITUDE)\/log$/);
    // Must NOT be a UUID
    expect(url).not.toMatch(/\/habits\/[0-9a-f-]{36}\/log/);
    // The key portion must be in our valid keys list
    const key = url.split('/')[4];
    expect(VALID_HABIT_KEYS).toContain(key);
  });

  it('skips if habit already logged today', async () => {
    const prisma = {
      habitLog: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-log' }) },
    } as any;
    const result = await logHabit('user-a', prisma, mockClient);
    expect(result).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ── rsvpToEvent ───────────────────────────────────────────────────────────────

describe('rsvpToEvent', () => {
  it('RSVPs to an upcoming event', async () => {
    const prisma = {
      gathering: { findFirst: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    } as any;
    const result = await rsvpToEvent('user-a', prisma, mockClient);
    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/events/event-1/rsvp', {}, expect.any(Object));
  });

  it('returns false when no upcoming events', async () => {
    const prisma = {
      gathering: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const result = await rsvpToEvent('user-a', prisma, mockClient);
    expect(result).toBe(false);
  });
});

// ── respondToPrompt ───────────────────────────────────────────────────────────

describe('respondToPrompt', () => {
  it('submits response to active prompt if not already responded', async () => {
    const prisma = {
      weeklyPrompt: { findFirst: jest.fn().mockResolvedValue({ id: 'prompt-1' }) },
      promptResponse: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const result = await respondToPrompt('user-a', prisma, mockClient);
    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/prompts/current/response',
      expect.objectContaining({ type: 'TEXT', content: expect.any(String) }),
      expect.any(Object),
    );
  });

  it('skips if user already responded to this prompt this week', async () => {
    const prisma = {
      weeklyPrompt: { findFirst: jest.fn().mockResolvedValue({ id: 'prompt-1' }) },
      promptResponse: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-resp' }) },
    } as any;
    const result = await respondToPrompt('user-a', prisma, mockClient);
    expect(result).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('skips when no active prompt', async () => {
    const prisma = {
      weeklyPrompt: { findFirst: jest.fn().mockResolvedValue(null) },
      promptResponse: { findFirst: jest.fn() },
    } as any;
    const result = await respondToPrompt('user-a', prisma, mockClient);
    expect(result).toBe(false);
  });
});

// ── logProfileView ────────────────────────────────────────────────────────────

describe('logProfileView', () => {
  it('calls POST /profiles/:id/view on a random seeded user', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'other-user' }) },
    } as any;
    const result = await logProfileView('user-a', prisma, mockClient);
    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/profiles/other-user/view', {}, expect.any(Object));
  });

  it('returns false when no target user found', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const result = await logProfileView('user-a', prisma, mockClient);
    expect(result).toBe(false);
  });
});

// ── earlyAccessDrop ───────────────────────────────────────────────────────────

describe('earlyAccessDrop', () => {
  it('calls early-access endpoint for a live drop', async () => {
    const prisma = {
      introduction: { findFirst: jest.fn().mockResolvedValue({ dropId: 'drop-1' }) },
    } as any;
    const result = await earlyAccessDrop('user-a', prisma, mockClient);
    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/introductions/drops/drop-1/early-access',
      {},
      expect.any(Object),
    );
  });

  it('returns false when no eligible drop', async () => {
    const prisma = {
      introduction: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const result = await earlyAccessDrop('user-a', prisma, mockClient);
    expect(result).toBe(false);
  });

  it('returns false (not throws) when API call fails (insufficient diamonds)', async () => {
    mockPost.mockRejectedValueOnce(new Error('402 Insufficient diamonds'));
    const prisma = {
      introduction: { findFirst: jest.fn().mockResolvedValue({ dropId: 'drop-1' }) },
    } as any;
    await expect(earlyAccessDrop('user-a', prisma, mockClient)).resolves.toBe(false);
  });
});
