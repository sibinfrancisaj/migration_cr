import {
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupEvents,
  autoJoinRegionalCountryGroup,
  listSuggestedGroups,
  getSuggestedGroupsForOnboarding,
  GroupNotFoundError,
  AlreadyGroupMemberError,
  AlreadyInGroupError,
  NotGroupMemberError,
  NotInGroupError,
  GroupFullError,
  GroupAccessDeniedError,
} from '../index.js';
import { GroupStatus, GroupAccessType, EventStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGroupFindFirst  = jest.fn();
const mockGroupFindMany   = jest.fn();
const mockGroupFindUnique = jest.fn();
const mockGroupUpdate     = jest.fn();
const mockGroupCreate     = jest.fn();
const mockGroupMemberFindMany   = jest.fn();
const mockGroupMemberFindUnique = jest.fn();
const mockGroupMemberCreate     = jest.fn();
const mockGroupMemberUpdate     = jest.fn();
const mockGroupMemberCount      = jest.fn();
const mockEventFindMany  = jest.fn();
const mockProfileFindUnique = jest.fn();
const mockSystemConfigFindUnique = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    group: {
      findFirst:  (...a: unknown[]) => mockGroupFindFirst(...a),
      findMany:   (...a: unknown[]) => mockGroupFindMany(...a),
      findUnique: (...a: unknown[]) => mockGroupFindUnique(...a),
      update:     (...a: unknown[]) => mockGroupUpdate(...a),
      create:     (...a: unknown[]) => mockGroupCreate(...a),
    },
    groupMember: {
      findMany:   (...a: unknown[]) => mockGroupMemberFindMany(...a),
      findUnique: (...a: unknown[]) => mockGroupMemberFindUnique(...a),
      create:     (...a: unknown[]) => mockGroupMemberCreate(...a),
      update:     (...a: unknown[]) => mockGroupMemberUpdate(...a),
      count:      (...a: unknown[]) => mockGroupMemberCount(...a),
    },
    event: {
      findMany: (...a: unknown[]) => mockEventFindMany(...a),
    },
    profile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
    },
    systemConfig: {
      findUnique: (...a: unknown[]) => mockSystemConfigFindUnique(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID  = 'user-uuid-1';
const GROUP_ID = 'group-uuid-1';

function makeGroup(overrides: Partial<{
  id: string;
  name: string;
  type: string;
  region: string;
  country: string | null;
  description: string | null;
  coverImageUrl: string | null;
  status: string;
  accessType: string;
  capacity: number;
  maxMembers: number;
  creditCost: number;
  memberCount: number;
  isActive: boolean;
  launchDate: Date;
  createdAt: Date;
}> = {}) {
  return {
    id:           overrides.id           ?? GROUP_ID,
    name:         overrides.name         ?? 'London Singles',
    type:         overrides.type         ?? 'REGIONAL',
    region:       overrides.region       ?? 'EU',
    country:      overrides.country      ?? 'UK',
    description:  overrides.description  ?? null,
    coverImageUrl: overrides.coverImageUrl ?? null,
    status:       overrides.status       ?? GroupStatus.ACTIVE,
    accessType:   overrides.accessType   ?? GroupAccessType.OPEN,
    capacity:     overrides.capacity     ?? 100,
    maxMembers:   overrides.maxMembers   ?? 50,
    creditCost:   overrides.creditCost   ?? 0,
    memberCount:  overrides.memberCount  ?? 10,
    isActive:     overrides.isActive     ?? true,
    launchDate:   overrides.launchDate   ?? new Date('2026-01-01'),
    createdAt:    overrides.createdAt    ?? new Date('2026-01-01'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default $transaction: executes the array of ops and returns their results
  mockTransaction.mockImplementation(async (ops: unknown[]) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return ops;
  });
});

// ── listGroups ─────────────────────────────────────────────────────────────────

describe('listGroups', () => {
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
  it('creates a group membership for OPEN group (userId first signature)', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ maxMembers: 50, memberCount: 10 }));
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await joinGroup(USER_ID, GROUP_ID);

    // transaction called once
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(joinGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws GroupNotFoundError when group is not FORMING or ACTIVE', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ status: 'CLOSED' }));
    await expect(joinGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws GroupAccessDeniedError for INVITE_ONLY groups', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ accessType: GroupAccessType.INVITE_ONLY }));
    await expect(joinGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(GroupAccessDeniedError);
  });

  it('throws AlreadyInGroupError when user is already an ACTIVE member', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup());
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-1', status: 'ACTIVE' });

    await expect(joinGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(AlreadyInGroupError);
  });

  it('throws GroupFullError when group is at maxMembers', async () => {
    mockGroupFindUnique.mockResolvedValue(makeGroup({ maxMembers: 10, memberCount: 10 }));
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(joinGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(GroupFullError);
  });

  it('legacy AlreadyGroupMemberError class still exported', () => {
    expect(new AlreadyGroupMemberError()).toBeInstanceOf(AlreadyGroupMemberError);
  });
});

// ── leaveGroup ─────────────────────────────────────────────────────────────────

describe('leaveGroup', () => {
  it('marks membership as LEFT and decrements memberCount (userId first signature)', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-1', status: 'ACTIVE' });

    await leaveGroup(USER_ID, GROUP_ID);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(leaveGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('throws NotInGroupError when user is not an active member', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(leaveGroup(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(NotInGroupError);
  });

  it('legacy NotGroupMemberError class still exported', () => {
    expect(new NotGroupMemberError()).toBeInstanceOf(NotGroupMemberError);
  });
});

// ── autoJoinRegionalCountryGroup ───────────────────────────────────────────────

describe('autoJoinRegionalCountryGroup', () => {
  it('creates a membership when a REGIONAL group exists for the country', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID, memberCount: 5, maxMembers: 50, accessType: 'OPEN',
    });
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await autoJoinRegionalCountryGroup(USER_ID, 'United Kingdom');

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('no-ops when no REGIONAL group found for the country', async () => {
    mockGroupFindFirst.mockResolvedValue(null);

    await autoJoinRegionalCountryGroup(USER_ID, 'Narnia');

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('no-ops when user is already a member', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID, memberCount: 5, maxMembers: 50, accessType: 'OPEN',
    });
    mockGroupMemberFindUnique.mockResolvedValue({ id: 'mem-1', status: 'ACTIVE' });

    await autoJoinRegionalCountryGroup(USER_ID, 'United Kingdom');

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('no-ops when group is full', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID, memberCount: 50, maxMembers: 50, accessType: 'OPEN',
    });
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await autoJoinRegionalCountryGroup(USER_ID, 'United Kingdom');

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ── listSuggestedGroups ────────────────────────────────────────────────────────

describe('listSuggestedGroups', () => {
  it('returns groups the user is not a member of', async () => {
    mockGroupMemberFindMany.mockResolvedValue([{ groupId: 'other-group' }]);
    mockProfileFindUnique.mockResolvedValue({ currentCountry: 'United Kingdom' });
    mockGroupFindMany.mockResolvedValue([makeGroup({ id: GROUP_ID, country: 'United Kingdom' })]);

    const result = await listSuggestedGroups(USER_ID, 10);

    expect(result).toHaveLength(1);
    expect(result[0].isMember).toBe(false);
  });

  it('returns empty array when all groups are already joined', async () => {
    mockGroupMemberFindMany.mockResolvedValue([{ groupId: GROUP_ID }]);
    mockProfileFindUnique.mockResolvedValue({ currentCountry: 'United Kingdom' });
    mockGroupFindMany.mockResolvedValue([]);

    const result = await listSuggestedGroups(USER_ID, 10);
    expect(result).toHaveLength(0);
  });
});

// ── getSuggestedGroupsForOnboarding ───────────────────────────────────────────

describe('getSuggestedGroupsForOnboarding', () => {
  it('uses SystemConfig.SUGGESTED_GROUPS_MAX when configured', async () => {
    mockSystemConfigFindUnique.mockResolvedValue({ value: '15' });
    mockGroupMemberFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ currentCountry: 'UK' });
    mockGroupFindMany.mockResolvedValue([makeGroup()]);

    const result = await getSuggestedGroupsForOnboarding(USER_ID);
    expect(result).toHaveLength(1);
  });

  it('falls back to default 20 when SystemConfig not set', async () => {
    mockSystemConfigFindUnique.mockResolvedValue(null);
    mockGroupMemberFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ currentCountry: 'UK' });
    mockGroupFindMany.mockResolvedValue([makeGroup()]);

    const result = await getSuggestedGroupsForOnboarding(USER_ID);
    expect(result).toHaveLength(1);
  });
});

// ── getGroupMembers (paginated) ───────────────────────────────────────────────

describe('getGroupMembers', () => {
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

  it('returns paginated members for a group (no userId required)', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindMany.mockResolvedValue([memberRow]);
    mockGroupMemberCount.mockResolvedValue(1);

    const result = await getGroupMembers(GROUP_ID, 1, 20);

    expect(result.members).toHaveLength(1);
    expect(result.members[0].name).toBe('Priya');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(getGroupMembers(GROUP_ID)).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('filters out members without a profile', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID });
    mockGroupMemberFindMany.mockResolvedValue([
      { ...memberRow, user: { profile: null } },
    ]);
    mockGroupMemberCount.mockResolvedValue(1);

    const result = await getGroupMembers(GROUP_ID);
    expect(result.members).toHaveLength(0);
  });
});

// ── getGroupEvents ─────────────────────────────────────────────────────────────

describe('getGroupEvents', () => {
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
