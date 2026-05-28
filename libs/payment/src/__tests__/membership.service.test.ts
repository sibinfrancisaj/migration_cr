import {
  activateMembership,
  getActiveMembership,
  cancelMembership,
  markMembershipPastDue,
} from '../membership.service.js';
import { MembershipPlan, MembershipStatus, PaymentProvider, UserRole } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockMembershipUpsert     = jest.fn();
const mockMembershipCreate     = jest.fn();
const mockMembershipFindFirst  = jest.fn();
const mockMembershipUpdateMany = jest.fn();
const mockUserUpdate           = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    membership: {
      upsert:     (...a: unknown[]) => mockMembershipUpsert(...a),
      create:     (...a: unknown[]) => mockMembershipCreate(...a),
      findFirst:  (...a: unknown[]) => mockMembershipFindFirst(...a),
      updateMany: (...a: unknown[]) => mockMembershipUpdateMany(...a),
    },
    user: {
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

const MEMBERSHIP_ROW = {
  id:                 'mem-uuid-1',
  userId:             USER_ID,
  plan:               MembershipPlan.FOUNDING_MEMBER,
  status:             MembershipStatus.ACTIVE,
  provider:           PaymentProvider.STRIPE,
  providerSubId:      'sub_test_123',
  currentPeriodStart: new Date('2026-05-28'),
  expiresAt:          null,
  cancelledAt:        null,
  createdAt:          new Date('2026-05-28'),
  updatedAt:          new Date('2026-05-28'),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('activateMembership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts membership when providerSubId is provided and elevates user role', async () => {
    mockMembershipUpsert.mockResolvedValue(MEMBERSHIP_ROW);
    mockUserUpdate.mockResolvedValue({});

    const result = await activateMembership({
      userId: USER_ID,
      plan: MembershipPlan.FOUNDING_MEMBER,
      provider: PaymentProvider.STRIPE,
      providerSubId: 'sub_test_123',
    });

    expect(mockMembershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerSubId: 'sub_test_123' } }),
    );
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: UserRole.FOUNDING_MEMBER } }),
    );
    expect(result.plan).toBe(MembershipPlan.FOUNDING_MEMBER);
    expect(result.status).toBe(MembershipStatus.ACTIVE);
  });

  it('creates a new membership when no providerSubId is given', async () => {
    mockMembershipCreate.mockResolvedValue({ ...MEMBERSHIP_ROW, providerSubId: null });
    mockUserUpdate.mockResolvedValue({});

    await activateMembership({
      userId: USER_ID,
      plan: MembershipPlan.FOUNDING_MEMBER,
      provider: PaymentProvider.RAZORPAY,
    });

    expect(mockMembershipCreate).toHaveBeenCalled();
    expect(mockMembershipUpsert).not.toHaveBeenCalled();
  });

  it('does not update user role for STANDARD plan', async () => {
    mockMembershipCreate.mockResolvedValue({ ...MEMBERSHIP_ROW, plan: MembershipPlan.STANDARD });
    mockUserUpdate.mockResolvedValue({});

    await activateMembership({
      userId: USER_ID,
      plan: MembershipPlan.STANDARD,
      provider: PaymentProvider.STRIPE,
    });

    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('getActiveMembership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when no active membership exists', async () => {
    mockMembershipFindFirst.mockResolvedValue(null);
    expect(await getActiveMembership(USER_ID)).toBeNull();
  });

  it('returns a MembershipDto when an active membership exists', async () => {
    mockMembershipFindFirst.mockResolvedValue(MEMBERSHIP_ROW);
    const result = await getActiveMembership(USER_ID);
    expect(result?.id).toBe('mem-uuid-1');
    expect(result?.status).toBe(MembershipStatus.ACTIVE);
  });
});

describe('cancelMembership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls updateMany with CANCELLED status', async () => {
    mockMembershipUpdateMany.mockResolvedValue({ count: 1 });
    await cancelMembership('sub_test_123');
    expect(mockMembershipUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerSubId: 'sub_test_123', status: MembershipStatus.ACTIVE },
        data: expect.objectContaining({ status: MembershipStatus.CANCELLED }),
      }),
    );
  });
});

describe('markMembershipPastDue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls updateMany with PAST_DUE status', async () => {
    mockMembershipUpdateMany.mockResolvedValue({ count: 1 });
    await markMembershipPastDue('sub_test_123');
    expect(mockMembershipUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: MembershipStatus.PAST_DUE },
      }),
    );
  });
});
