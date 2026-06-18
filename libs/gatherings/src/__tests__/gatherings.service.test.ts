import {
  listEvents,
  getEvent,
  rsvpToEvent,
  cancelRsvp,
  getEventAttendees,
  getEventCalendar,
  getCoAttendancePairs,
  generateWhyInvited,
  EventNotFoundError,
  AlreadyRsvpdError,
  NotRsvpdError,
  EventFullError,
  EventNotUpcomingError,
} from '../index.js';
import { EventStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockEventFindMany   = jest.fn();
const mockEventFindUnique = jest.fn();
const mockEventRsvpFindMany   = jest.fn();
const mockEventRsvpFindUnique = jest.fn();
const mockEventRsvpCreate     = jest.fn();
const mockEventRsvpDelete     = jest.fn();
const mockProfileFindUnique   = jest.fn();
const mockGroupMemberFindMany = jest.fn();
const mockWeeklyPromptFindMany = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    event: {
      findMany:   (...a: unknown[]) => mockEventFindMany(...a),
      findUnique: (...a: unknown[]) => mockEventFindUnique(...a),
    },
    eventRsvp: {
      findMany:   (...a: unknown[]) => mockEventRsvpFindMany(...a),
      findUnique: (...a: unknown[]) => mockEventRsvpFindUnique(...a),
      create:     (...a: unknown[]) => mockEventRsvpCreate(...a),
      delete:     (...a: unknown[]) => mockEventRsvpDelete(...a),
    },
    profile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
    },
    groupMember: {
      findMany: (...a: unknown[]) => mockGroupMemberFindMany(...a),
    },
    weeklyPrompt: {
      findMany: (...a: unknown[]) => mockWeeklyPromptFindMany(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID  = 'user-uuid-1';
const EVENT_ID = 'event-uuid-1';

function makeEvent(overrides: Partial<{
  id: string;
  groupId: string | null;
  title: string;
  description: string | null;
  status: string;
  tag: string | null;
  creditCost: number;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  createdAt: Date;
  _count: { rsvps: number };
}> = {}) {
  return {
    id:          overrides.id          ?? EVENT_ID,
    groupId:     'groupId' in overrides  ? overrides.groupId  : null,
    title:       overrides.title       ?? 'Sunday Brunch',
    description: 'description' in overrides ? overrides.description : null,
    status:      overrides.status      ?? EventStatus.UPCOMING,
    tag:         'tag' in overrides      ? overrides.tag      : null,
    creditCost:  overrides.creditCost  ?? 0,
    startAt:     overrides.startAt     ?? new Date(Date.now() + 86400000),
    endAt:       'endAt' in overrides    ? overrides.endAt    : null,
    location:    'location' in overrides ? overrides.location : 'London',
    onlineUrl:   'onlineUrl' in overrides ? overrides.onlineUrl : null,
    capacity:    'capacity' in overrides ? overrides.capacity : 20,
    createdAt:   overrides.createdAt   ?? new Date('2026-05-01'),
    _count:      overrides._count      ?? { rsvps: 3 },
  };
}

// ── Shared mock setup helpers ─────────────────────────────────────────────────

function setListEventsMocks(events = [makeEvent()], rsvpdIds: string[] = [], completionScore = 80): void {
  mockEventFindMany.mockResolvedValue(events);
  mockEventRsvpFindMany.mockResolvedValue(rsvpdIds.map(id => ({ eventId: id })));
  mockProfileFindUnique.mockResolvedValue({ completionScore });
  mockGroupMemberFindMany.mockResolvedValue([]);
}

// ── listEvents ─────────────────────────────────────────────────────────────────

describe('listEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns events with isRsvpd=true for events user has RSVP\'d', async () => {
    setListEventsMocks([makeEvent()], [EVENT_ID]);

    const result = await listEvents(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].isRsvpd).toBe(true);
    expect(result[0].rsvpCount).toBe(3);
  });

  it('returns isRsvpd=false when user has not RSVPd', async () => {
    setListEventsMocks();

    const result = await listEvents(USER_ID);
    expect(result[0].isRsvpd).toBe(false);
  });

  it('returns empty array when no upcoming events', async () => {
    setListEventsMocks([]);

    const result = await listEvents(USER_ID);
    expect(result).toEqual([]);
  });

  it('passes tag filter to prisma when provided', async () => {
    setListEventsMocks([]);

    await listEvents(USER_ID, { tag: 'SOCIAL' as any });

    expect(mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tag: 'SOCIAL' }),
      }),
    );
  });

  it('applies limit when provided', async () => {
    setListEventsMocks([]);

    await listEvents(USER_ID, { limit: 5 });

    expect(mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('includes whyInvited in each event DTO', async () => {
    setListEventsMocks([makeEvent({ tag: 'SOCIAL' })]);

    const result = await listEvents(USER_ID);
    expect(result[0].whyInvited).toBeTruthy();
    expect(typeof result[0].whyInvited).toBe('string');
  });

  it('sets group-member whyInvited when user is in event group', async () => {
    mockEventFindMany.mockResolvedValue([makeEvent({ groupId: 'grp-1' })]);
    mockEventRsvpFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ completionScore: 80 });
    mockGroupMemberFindMany.mockResolvedValue([{ groupId: 'grp-1' }]);

    const result = await listEvents(USER_ID);
    expect(result[0].whyInvited).toContain("You're part of this community");
  });
});

// ── getEvent ───────────────────────────────────────────────────────────────────

describe('getEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileFindUnique.mockResolvedValue({ completionScore: 80 });
    mockGroupMemberFindMany.mockResolvedValue([]);
  });

  it('returns event with isRsvpd=true', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockEventRsvpFindUnique.mockResolvedValue({ id: 'rsvp-1' });

    const result = await getEvent(EVENT_ID, USER_ID);

    expect(result.id).toBe(EVENT_ID);
    expect(result.isRsvpd).toBe(true);
    expect(result.whyInvited).toBeTruthy();
  });

  it('returns isRsvpd=false when not RSVPd', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockEventRsvpFindUnique.mockResolvedValue(null);

    const result = await getEvent(EVENT_ID, USER_ID);
    expect(result.isRsvpd).toBe(false);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    mockEventFindUnique.mockResolvedValue(null);
    await expect(getEvent(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(EventNotFoundError);
  });
});

// ── rsvpToEvent ────────────────────────────────────────────────────────────────

describe('rsvpToEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates RSVP for UPCOMING event', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ capacity: 20, _count: { rsvps: 5 } }));
    mockEventRsvpFindUnique.mockResolvedValue(null);
    mockEventRsvpCreate.mockResolvedValue({});

    await rsvpToEvent(EVENT_ID, USER_ID);

    expect(mockEventRsvpCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, eventId: EVENT_ID, status: 'GOING' }),
      }),
    );
  });

  it('creates RSVP for LIVE event', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ status: EventStatus.LIVE, capacity: 20, _count: { rsvps: 5 } }));
    mockEventRsvpFindUnique.mockResolvedValue(null);
    mockEventRsvpCreate.mockResolvedValue({});

    await rsvpToEvent(EVENT_ID, USER_ID);
    expect(mockEventRsvpCreate).toHaveBeenCalled();
  });

  it('creates RSVP when capacity is null (unlimited)', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ capacity: null, _count: { rsvps: 999 } }));
    mockEventRsvpFindUnique.mockResolvedValue(null);
    mockEventRsvpCreate.mockResolvedValue({});

    await rsvpToEvent(EVENT_ID, USER_ID);
    expect(mockEventRsvpCreate).toHaveBeenCalled();
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    mockEventFindUnique.mockResolvedValue(null);
    await expect(rsvpToEvent(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it('throws EventNotUpcomingError when event is not UPCOMING or LIVE', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ status: 'PAST' }));
    await expect(rsvpToEvent(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(EventNotUpcomingError);
  });

  it('throws AlreadyRsvpdError when user already has RSVP', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockEventRsvpFindUnique.mockResolvedValue({ id: 'rsvp-1' });

    await expect(rsvpToEvent(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(AlreadyRsvpdError);
  });

  it('throws EventFullError when capacity is reached', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ capacity: 10, _count: { rsvps: 10 } }));
    mockEventRsvpFindUnique.mockResolvedValue(null);

    await expect(rsvpToEvent(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(EventFullError);
  });
});

// ── cancelRsvp ─────────────────────────────────────────────────────────────────

describe('cancelRsvp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes the RSVP', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindUnique.mockResolvedValue({ id: 'rsvp-1' });
    mockEventRsvpDelete.mockResolvedValue({});

    await cancelRsvp(EVENT_ID, USER_ID);

    expect(mockEventRsvpDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_eventId: { userId: USER_ID, eventId: EVENT_ID } },
      }),
    );
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    mockEventFindUnique.mockResolvedValue(null);
    await expect(cancelRsvp(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it('throws NotRsvpdError when user does not have an RSVP', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindUnique.mockResolvedValue(null);

    await expect(cancelRsvp(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(NotRsvpdError);
  });
});

// ── getEventAttendees ──────────────────────────────────────────────────────────

describe('getEventAttendees', () => {
  beforeEach(() => jest.clearAllMocks());

  const attendeeRow = {
    userId: 'user-2',
    status: 'GOING',
    createdAt: new Date(),
    user: {
      profile: {
        name: 'Priya',
        currentCity: 'London',
        currentCountry: 'UK',
      },
    },
  };

  it('returns attendees list', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindMany.mockResolvedValue([attendeeRow]);

    const result = await getEventAttendees(EVENT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Priya');
    expect(result[0].rsvpStatus).toBe('GOING');
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    mockEventFindUnique.mockResolvedValue(null);
    await expect(getEventAttendees(EVENT_ID)).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it('filters out attendees without a profile', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindMany.mockResolvedValue([
      { ...attendeeRow, user: { profile: null } },
    ]);

    const result = await getEventAttendees(EVENT_ID);
    expect(result).toHaveLength(0);
  });
});

// ── generateWhyInvited ────────────────────────────────────────────────────────

describe('generateWhyInvited()', () => {
  const noGroups = new Set<string>();

  it('returns group-member text when user is in the event group', () => {
    const result = generateWhyInvited({ tag: null, groupId: 'grp-1' }, new Set(['grp-1']), 80);
    expect(result).toContain("You're part of this community");
  });

  it('returns profile-completion nudge when completionScore < 50', () => {
    const result = generateWhyInvited({ tag: null, groupId: null }, noGroups, 30);
    expect(result).toContain('Complete your profile');
  });

  it('returns SOCIAL tag text', () => {
    const result = generateWhyInvited({ tag: 'SOCIAL', groupId: null }, noGroups, 80);
    expect(result).toContain('Indian diaspora');
  });

  it('returns SPIRITUAL tag text', () => {
    const result = generateWhyInvited({ tag: 'SPIRITUAL', groupId: null }, noGroups, 80);
    expect(result).toContain('faith journey');
  });

  it('returns PROFESSIONAL tag text', () => {
    const result = generateWhyInvited({ tag: 'PROFESSIONAL', groupId: null }, noGroups, 80);
    expect(result).toContain('career network');
  });

  it('returns default text for unknown tag', () => {
    const result = generateWhyInvited({ tag: null, groupId: null }, noGroups, 80);
    expect(result).toContain('diaspora community');
  });
});

// ── getEventCalendar ──────────────────────────────────────────────────────────

describe('getEventCalendar()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('always includes INTRO_DROP and CHECK_IN milestones', async () => {
    mockWeeklyPromptFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([]);

    const result = await getEventCalendar(new Date('2026-06-01T08:00:00Z'));

    const types = result.map(m => m.type);
    expect(types).toContain('INTRO_DROP');
    expect(types).toContain('CHECK_IN');
  });

  it('includes EVENT milestones for upcoming events in next 7 days', async () => {
    mockWeeklyPromptFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([
      { id: 'evt-1', title: 'London Brunch', startAt: new Date('2026-06-03T12:00:00Z') },
    ]);

    const result = await getEventCalendar(new Date('2026-06-01T08:00:00Z'));

    const eventMilestones = result.filter(m => m.type === 'EVENT');
    expect(eventMilestones).toHaveLength(1);
    expect(eventMilestones[0].title).toBe('London Brunch');
    expect(eventMilestones[0].eventId).toBe('evt-1');
  });

  it('includes PROMPT_OPENS and PROMPT_CLOSES for active prompts', async () => {
    mockWeeklyPromptFindMany.mockResolvedValue([{
      id:          'prompt-1',
      question:    'What does home mean to you abroad?',
      publishedAt: new Date('2026-06-02T09:00:00Z'),
      expiresAt:   new Date('2026-06-06T09:00:00Z'),
    }]);
    mockEventFindMany.mockResolvedValue([]);

    const result = await getEventCalendar(new Date('2026-06-01T08:00:00Z'));

    const types = result.map(m => m.type);
    expect(types).toContain('PROMPT_OPENS');
    expect(types).toContain('PROMPT_CLOSES');
  });

  it('returns milestones sorted chronologically', async () => {
    mockWeeklyPromptFindMany.mockResolvedValue([]);
    mockEventFindMany.mockResolvedValue([
      { id: 'evt-2', title: 'Late Event', startAt: new Date('2026-06-07T18:00:00Z') },
      { id: 'evt-1', title: 'Early Event', startAt: new Date('2026-06-02T10:00:00Z') },
    ]);

    const result = await getEventCalendar(new Date('2026-06-01T08:00:00Z'));

    const scheduledAts = result.map(m => m.scheduledAt);
    for (let i = 1; i < scheduledAts.length; i++) {
      expect(scheduledAts[i] >= scheduledAts[i - 1]).toBe(true);
    }
  });
});

// ── getCoAttendancePairs ──────────────────────────────────────────────────────

describe('getCoAttendancePairs()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns unique canonicalized pairs for all GOING RSVPs', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindMany.mockResolvedValue([
      { userId: 'user-b' },
      { userId: 'user-a' },
      { userId: 'user-c' },
    ]);

    const pairs = await getCoAttendancePairs(EVENT_ID);

    expect(pairs).toHaveLength(3); // C(3,2) = 3 pairs
    // All pairs should be in canonical order (smaller UUID first)
    for (const p of pairs) {
      expect(p.userAId < p.userBId).toBe(true);
    }
  });

  it('returns empty array when only one attendee', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindMany.mockResolvedValue([{ userId: 'user-a' }]);

    const pairs = await getCoAttendancePairs(EVENT_ID);
    expect(pairs).toHaveLength(0);
  });

  it('returns empty array when no RSVPs', async () => {
    mockEventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockEventRsvpFindMany.mockResolvedValue([]);

    const pairs = await getCoAttendancePairs(EVENT_ID);
    expect(pairs).toHaveLength(0);
  });

  it('throws EventNotFoundError when event does not exist', async () => {
    mockEventFindUnique.mockResolvedValue(null);
    await expect(getCoAttendancePairs(EVENT_ID)).rejects.toBeInstanceOf(EventNotFoundError);
  });
});
