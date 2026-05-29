import {
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupEvents,
  GroupNotFoundError,
  AlreadyGroupMemberError,
  NotGroupMemberError,
  GroupFullError,
  GroupAccessDeniedError,
} from '../index.js';
import { GroupStatus, GroupAccessType, EventStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGroupFindMany   = jest.fn();
const mockGroupFindUnique = jest.fn();
const mockGroupMemberFindMany  = jest.fn();
const mockGroupMemberFindUnique = jest.fn();
const mockGroupMemberCreate    = jest.fn();
const mockGroupMemberUpdate    = jest.fn();
const mockEventFindMany  = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    group: {
      findMany:   (...a: unknown[]) => mockGroupFindMany(...a),
      findUnique: (...a: unknown[]) => mockGroupFindUnique(...a),
    },
    groupMember: {
      findMany:   (...a: unknown[]) => mockGroupMemberFindMany(...a),
      findUnique: (...a: unknown[]) => mockGroupMemberFindUnique(...a),
      create:     (...a: unknown[]) => mockGroupMemberCreate(...a),
      update:     (...a: unknown[]) => mockGroupMemberUpdate(...a),
    },
    event: {
      findMany: (...a: unknown[]) => mockEventFindMany(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID  = 'user-uuid-1';
const GROUP_ID = 'group-uuid-1';

function makeGroup(overrides: Partial<{
  id: string;
  name: string;
  region: string;
  country: string | null;
  description: string | null;
  status: string;
  accessType: string;
  capacity: number;
  maxMembers: number;
  creditCost: number;
  launchDate: Date;
  createdAt: Date;
  _count: { members: number };
}> = {}) {
  return {
    id:          overrides.id          ?? GROUP_ID,
    name:        overrides.name        ?? 'London Singles',
    region:      overrides.region      ?? 'EU',
    country:     overrides.country     ?? 'UK',
    description: overrides.description ?? null,
    status:      overrides.status      ?? GroupStatus.ACTIVE,
    accessType:  overrides.accessType  ?? GroupAccessType.OPEN,
    capacity:    overrides.capacity    ?? 100,
    maxMembers:  overrides.maxMembers  ?? 50,
    creditCost:  overrides.creditCost  ?? 0,
    launchDate:  overrides.launchDate  ?? new Date('2026-01-01'),
    createdAt:   overrides.createdAt   ?? new Date('2026-01-01'),
    _count:      overrides._count      ?? { members: 10 },
  };
}

// ── listGroups ─────────────────────────────────────────────────────────────────

describe('listGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns groups with isMember=true for groups user is in', async () => {
    mockGroupFindMany.mockResolvedValue([makeGroup()]);
    mockGroupMemberFindMany.mockResolvedValue([{ groupId: GROUP_ID }]);

    const result = await listGroups(USER_ID, 'UK', 'EU');

    expect(result).toHaveLength(1);
    expect(result[0].isMember).toBe(true);
    expect(result[0].memberCount).toBe(10);
  });

  it('returns isMember=false when user is not a member', async () => {
    mockGroupFindMany.mockResolvedValue([makeGroup()]);
    mockGroupMemberFindMany.mockResolvedValue([]);

    const result = await listGroups(USER_ID);
    expect(result[0].isMember).toBe(false);
  });

  it('returns empty array when no groups match', async () => {
    mockGroupFindMany.mockResolvedValue([]);
    mockGroupMemberFindMany.mockResolvedValue([]);

    const result = await listGroups(USER_ID);
    expect(result).toEqual([]);
  });
});

// ── getGroup ───────────────────────────────────────────────────────────────────

describe('getGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a group with membership status', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup());
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-1' });

    const result = await getGroup(GROUP_ID, USER_ID);

    expect(result.id).toBe(GROUP_ID);
    expect(result.isMember).toBe(true);
  });

  it('returns isMember=false when not a member', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup());
    mockGroupMemberFindUnique.mockResolvedValue(null);

    const result = await getGroup(GROUP_ID, USER_ID);
    expect(result.isMember).toBe(false);
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);

    await expect(getGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });
});

// ── joinGroup ──────────────────────────────────────────────────────────────────

describe('joinGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a group membership for OPEN group', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ maxMembers: 50, _count: { members: 10 } }));
    mockGroupMemberFindUnique.mockResolvedValue(null);
    mockGroupMemberCreate.mockResolvedValue({});

    await joinGroup(GROUP_ID, USER_ID);

    expect(mockGroupMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, groupId: GROUP_ID, status: 'ACTIVE', role: 'MEMBER' }),
      }),
    );
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(joinGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws GroupNotFoundError when group is not FORMING or ACTIVE', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ status: 'CLOSED' }));
    await expect(joinGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws GroupAccessDeniedError for INVITE_ONLY groups', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ accessType: GroupAccessType.INVITE_ONLY }));
    await expect(joinGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupAccessDeniedError);
  });

  it('throws AlreadyGroupMemberError when user is already a member', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup());
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-1' });

    await expect(joinGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(AlreadyGroupMemberError);
  });

  it('throws GroupFullError when group is at maxMembers', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ maxMembers: 10, _count: { members: 10 } }));
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(joinGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupFullError);
  });
});

// ── leaveGroup ─────────────────────────────────────────────────────────────────

describe('leaveGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks membership as LEFT', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-1' });
    mockGroupMemberUpdate.mockResolvedValue({});

    await leaveGroup(GROUP_ID, USER_ID);

    expect(mockGroupMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'LEFT' } }),
    );
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(leaveGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws NotGroupMemberError when user is not a member', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(leaveGroup(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(NotGroupMemberError);
  });
});

// ── getGroupMembers ────────────────────────────────────────────────────────────

describe('getGroupMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  const memberRow = {
    userId: 'user-2',
    role: 'MEMBER',
    joinedAt: new Date('2026-02-01'),
    user: {
      profile: {
        name: 'Priya',
        currentCity: 'London',
        currentCountry: 'UK',
      },
    },
  };

  it('returns members when caller is a member', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    // First findUnique call = caller membership, second findMany = members list
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-caller' });
    mockGroupMemberFindMany.mockResolvedValue([memberRow]);

    const result = await getGroupMembers(GROUP_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Priya');
    expect(result[0].userId).toBe('user-2');
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(getGroupMembers(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws NotGroupMemberError when caller is not a member', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(getGroupMembers(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(NotGroupMemberError);
  });

  it('filters out members without a profile', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-caller' });
    mockGroupMemberFindMany.mockResolvedValue([
      { ...memberRow, user: { profile: null } },
    ]);

    const result = await getGroupMembers(GROUP_ID, USER_ID);
    expect(result).toHaveLength(0);
  });
});

// ── getGroupEvents ─────────────────────────────────────────────────────────────

describe('getGroupEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  const eventRow = {
    id: 'event-1',
    title: 'Mixer Night',
    description: null,
    status: EventStatus.UPCOMING,
    tag: null,
    startAt: new Date('2026-06-01T19:00:00Z'),
    endAt: null,
    location: 'London',
    onlineUrl: null,
    capacity: 30,
    creditCost: 0,
    _count: { rsvps: 5 },
  };

  it('returns upcoming events for a group', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockEventFindMany.mockResolvedValue([eventRow]);

    const result = await getGroupEvents(GROUP_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Mixer Night');
    expect(result[0].rsvpCount).toBe(5);
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(getGroupEvents(GROUP_ID, USER_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('returns empty array when no upcoming events', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockEventFindMany.mockResolvedValue([]);

    const result = await getGroupEvents(GROUP_ID, USER_ID);
    expect(result).toEqual([]);
  });
});
