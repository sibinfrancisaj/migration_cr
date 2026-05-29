import {
  listEvents,
  getEvent,
  rsvpToEvent,
  cancelRsvp,
  getEventAttendees,
  EventNotFoundError,
  AlreadyRsvpdError,
  NotRsvpdError,
  EventFullError,
  EventNotUpcomingError,
} from '../index.js';
import { EventStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockEventFindMany  = jest.fn();
const mockEventFindUnique = jest.fn();
const mockEventRsvpFindMany  = jest.fn();
const mockEventRsvpFindUnique = jest.fn();
const mockEventRsvpCreate    = jest.fn();
const mockEventRsvpDelete    = jest.fn();

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

// ── listEvents ─────────────────────────────────────────────────────────────────

describe('listEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns events with isRsvpd=true for events user has RSVP\'d', async () => {
    mockEventFindMany.mockResolvedValue([makeEvent()]);
    mockEventRsvpFindMany.mockResolvedValue([{ eventId: EVENT_ID }]);

    const result = await listEvents(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].isRsvpd).toBe(true);
    expect(result[0].rsvpCount).toBe(3);
  });

  it('returns isRsvpd=false when user has not RSVPd', async () => {
    mockEventFindMany.mockResolvedValue([makeEvent()]);
    mockEventRsvpFindMany.mockResolvedValue([]);

    const result = await listEvents(USER_ID);
    expect(result[0].isRsvpd).toBe(false);
  });

  it('returns empty array when no upcoming events', async () => {
    mockEventFindMany.mockResolvedValue([]);
    mockEventRsvpFindMany.mockResolvedValue([]);

    const result = await listEvents(USER_ID);
    expect(result).toEqual([]);
  });

  it('passes tag filter to prisma when provided', async () => {
    mockEventFindMany.mockResolvedValue([]);
    mockEventRsvpFindMany.mockResolvedValue([]);

    await listEvents(USER_ID, 'SOCIAL' as any);

    expect(mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tag: 'SOCIAL' }),
      }),
    );
  });
});

// ── getEvent ───────────────────────────────────────────────────────────────────

describe('getEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns event with isRsvpd=true', async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockEventRsvpFindUnique.mockResolvedValue({ id: 'rsvp-1' });

    const result = await getEvent(EVENT_ID, USER_ID);

    expect(result.id).toBe(EVENT_ID);
    expect(result.isRsvpd).toBe(true);
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
