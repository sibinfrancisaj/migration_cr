/**
 * AI-005 tests — Event Pre-Connection Service.
 */

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockEventFindUnique = jest.fn();
const mockRsvpFindMany = jest.fn();
const mockIntroFindMany = jest.fn();
const mockBlockFindMany = jest.fn();
const mockMatchScoreFindMany = jest.fn();
const mockDropCreate = jest.fn();
const mockIntroCreateMany = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    event: { findUnique: (...a: unknown[]) => mockEventFindUnique(...a) },
    eventRsvp: { findMany: (...a: unknown[]) => mockRsvpFindMany(...a) },
    introduction: { findMany: (...a: unknown[]) => mockIntroFindMany(...a), createMany: (...a: unknown[]) => mockIntroCreateMany(...a) },
    userBlock: { findMany: (...a: unknown[]) => mockBlockFindMany(...a) },
    matchScore: { findMany: (...a: unknown[]) => mockMatchScoreFindMany(...a) },
    introductionDrop: { create: (...a: unknown[]) => mockDropCreate(...a) },
  },
}));

import { generateEventPreConnections } from '../event-preconnect.service.js';

const MOCK_EVENT = {
  id: 'event-001',
  title: 'London Diwali Mixer',
  startAt: new Date('2026-09-15T18:00:00Z'),
  groupId: 'group-001',
};

function makeAttendees(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${String(i).padStart(4, '0')}`,
    user: { profile: { gender: i % 2 === 0 ? 'MALE' : 'FEMALE' } },
  }));
}

function makeMatchScores(males: string[], females: string[], score = 80) {
  const scores = [];
  for (let m = 0; m < Math.min(males.length, 4); m++) {
    for (let f = 0; f < Math.min(females.length, 4); f++) {
      scores.push({ userAId: males[m], userBId: females[f], totalScore: score });
    }
  }
  return scores;
}

beforeEach(() => {
  jest.clearAllMocks();
  const attendees = makeAttendees(10);
  const males = attendees.filter((a) => a.user.profile?.gender === 'MALE').map((a) => a.userId);
  const females = attendees.filter((a) => a.user.profile?.gender === 'FEMALE').map((a) => a.userId);

  mockEventFindUnique.mockResolvedValue(MOCK_EVENT);
  mockRsvpFindMany.mockResolvedValue(attendees);
  mockIntroFindMany.mockResolvedValue([]);
  mockBlockFindMany.mockResolvedValue([]);
  mockMatchScoreFindMany.mockResolvedValue(makeMatchScores(males, females));
  mockDropCreate.mockResolvedValue({ id: 'drop-abc', title: 'Meet someone attending London Diwali Mixer' });
  mockIntroCreateMany.mockResolvedValue({ count: 8 });
});

describe('generateEventPreConnections()', () => {
  it('creates a SCHEDULED IntroductionDrop', async () => {
    await generateEventPreConnections('event-001');
    expect(mockDropCreate).toHaveBeenCalledTimes(1);
    const [call] = mockDropCreate.mock.calls;
    expect(call[0].data.status).toBe('SCHEDULED');
    expect(call[0].data.proposedByAI).toBe(true);
    expect(call[0].data.name).toBe('Meet someone attending London Diwali Mixer');
  });

  it('creates Introduction rows in both directions', async () => {
    await generateEventPreConnections('event-001');
    expect(mockIntroCreateMany).toHaveBeenCalledTimes(1);
    const [call] = mockIntroCreateMany.mock.calls;
    // Pairs in both directions → even number of intro rows
    expect(call[0].data.length % 2).toBe(0);
  });

  it('sets releaseAt to 72h before event', async () => {
    await generateEventPreConnections('event-001');
    const [call] = mockDropCreate.mock.calls;
    const releaseAt = new Date(call[0].data.releaseAt);
    const expectedRelease = new Date(MOCK_EVENT.startAt.getTime() - 72 * 60 * 60 * 1000);
    expect(releaseAt.getTime()).toBe(expectedRelease.getTime());
  });

  it('does nothing when event is not found', async () => {
    mockEventFindUnique.mockResolvedValueOnce(null);
    await generateEventPreConnections('event-001');
    expect(mockDropCreate).not.toHaveBeenCalled();
  });

  it('does nothing when fewer than 4 attendees', async () => {
    mockRsvpFindMany.mockResolvedValueOnce(makeAttendees(3));
    await generateEventPreConnections('event-001');
    expect(mockDropCreate).not.toHaveBeenCalled();
  });

  it('does nothing when fewer than MIN_PAIRS_REQUIRED qualifying pairs', async () => {
    mockMatchScoreFindMany.mockResolvedValueOnce([
      { userAId: 'user-0000', userBId: 'user-0001', totalScore: 85 },
      { userAId: 'user-0002', userBId: 'user-0003', totalScore: 75 },
    ]);
    await generateEventPreConnections('event-001');
    expect(mockDropCreate).not.toHaveBeenCalled();
  });

  it('excludes already-introduced pairs', async () => {
    const attendees = makeAttendees(10);
    const males = attendees.filter((a) => a.user.profile?.gender === 'MALE').map((a) => a.userId);
    const females = attendees.filter((a) => a.user.profile?.gender === 'FEMALE').map((a) => a.userId);

    // All pairs already introduced
    const existingIntros = makeMatchScores(males, females).map((s) => ({
      userAId: s.userAId, userBId: s.userBId,
    }));
    mockIntroFindMany.mockResolvedValueOnce(existingIntros);
    await generateEventPreConnections('event-001');
    expect(mockDropCreate).not.toHaveBeenCalled();
  });

  it('excludes blocked pairs', async () => {
    const attendees = makeAttendees(10);
    const males = attendees.filter((a) => a.user.profile?.gender === 'MALE').map((a) => a.userId);
    const females = attendees.filter((a) => a.user.profile?.gender === 'FEMALE').map((a) => a.userId);

    // All male→female pairs are blocked
    const blocks = makeMatchScores(males, females).map((s) => ({
      blockerId: s.userAId, blockedId: s.userBId,
    }));
    mockBlockFindMany.mockResolvedValueOnce(blocks);
    await generateEventPreConnections('event-001');
    expect(mockDropCreate).not.toHaveBeenCalled();
  });
});
