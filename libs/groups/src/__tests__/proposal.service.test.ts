/**
 * GRP-R-003 tests — Interest Group Proposal Flow.
 */

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockProposalFindFirst  = jest.fn();
const mockProposalFindMany   = jest.fn();
const mockProposalFindUnique = jest.fn();
const mockProposalCreate     = jest.fn();
const mockProposalUpdate     = jest.fn();
const mockGroupCreate        = jest.fn();
const mockGroupFindFirst     = jest.fn();
const mockGroupMemberCreate  = jest.fn();
const mockGroupUpdate        = jest.fn();
const mockTransaction        = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    groupProposal: {
      findFirst:  (...a: unknown[]) => mockProposalFindFirst(...a),
      findMany:   (...a: unknown[]) => mockProposalFindMany(...a),
      findUnique: (...a: unknown[]) => mockProposalFindUnique(...a),
      create:     (...a: unknown[]) => mockProposalCreate(...a),
      update:     (...a: unknown[]) => mockProposalUpdate(...a),
    },
    group: {
      findFirst: (...a: unknown[]) => mockGroupFindFirst(...a),
      create:    (...a: unknown[]) => mockGroupCreate(...a),
      update:    (...a: unknown[]) => mockGroupUpdate(...a),
    },
    groupMember: {
      create: (...a: unknown[]) => mockGroupMemberCreate(...a),
    },
  },
}));

import {
  proposeGroup,
  getGroupProposals,
  approveGroupProposal,
  rejectGroupProposal,
  GroupProposalNotFoundError,
  AlreadyProposedError,
  ProposalNotPendingError,
} from '../proposal.service.js';

const USER_ID    = 'user-aaa';
const ADMIN_ID   = 'admin-bbb';
const PROPOSAL_ID = 'proposal-ccc';

const PROPOSAL_ROW = {
  id: PROPOSAL_ID,
  proposedByUserId: USER_ID,
  name: 'Tamil Engineers UK',
  description: 'A group for Tamil engineers in the UK',
  type: 'INTEREST',
  country: 'United Kingdom',
  rationale: 'Connect Tamil engineers for networking',
  status: 'PENDING',
  reviewedByAdminId: null,
  reviewedAt: null,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (ops: unknown[]) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return ops;
  });
});

// ── proposeGroup ──────────────────────────────────────────────────────────────

describe('proposeGroup()', () => {
  it('creates a PENDING proposal', async () => {
    mockProposalFindFirst.mockResolvedValue(null);
    mockProposalCreate.mockResolvedValue(PROPOSAL_ROW);

    const result = await proposeGroup(USER_ID, {
      name: 'Tamil Engineers UK',
      description: 'A group for Tamil engineers in the UK',
      rationale: 'Connect Tamil engineers for networking',
      country: 'United Kingdom',
    });

    expect(result.status).toBe('PENDING');
    expect(result.name).toBe('Tamil Engineers UK');
    expect(mockProposalCreate).toHaveBeenCalledTimes(1);
  });

  it('throws AlreadyProposedError when user has a pending proposal with same name', async () => {
    mockProposalFindFirst.mockResolvedValue({ id: PROPOSAL_ID });

    await expect(
      proposeGroup(USER_ID, { name: 'Tamil Engineers UK', description: 'x', rationale: 'y' }),
    ).rejects.toBeInstanceOf(AlreadyProposedError);
  });
});

// ── getGroupProposals ─────────────────────────────────────────────────────────

describe('getGroupProposals()', () => {
  it('returns all proposals when no status filter', async () => {
    mockProposalFindMany.mockResolvedValue([PROPOSAL_ROW]);

    const result = await getGroupProposals();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('PENDING');
  });

  it('filters by status when provided', async () => {
    mockProposalFindMany.mockResolvedValue([]);

    const result = await getGroupProposals('APPROVED');

    expect(result).toHaveLength(0);
    const [call] = mockProposalFindMany.mock.calls;
    expect(call[0].where).toEqual({ status: 'APPROVED' });
  });
});

// ── approveGroupProposal ──────────────────────────────────────────────────────

describe('approveGroupProposal()', () => {
  it('approves the proposal and creates the group', async () => {
    mockProposalFindUnique.mockResolvedValue(PROPOSAL_ROW);
    const approvedRow = { ...PROPOSAL_ROW, status: 'APPROVED', reviewedByAdminId: ADMIN_ID, reviewedAt: new Date() };
    mockTransaction.mockResolvedValueOnce([approvedRow, { id: 'new-group-id' }]);
    mockGroupFindFirst.mockResolvedValue({ id: 'new-group-id', memberCount: 0 });
    mockTransaction.mockResolvedValueOnce([{}, {}]); // auto-join transaction

    const result = await approveGroupProposal(ADMIN_ID, PROPOSAL_ID);

    expect(result.status).toBe('APPROVED');
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('throws GroupProposalNotFoundError when proposal does not exist', async () => {
    mockProposalFindUnique.mockResolvedValue(null);
    await expect(approveGroupProposal(ADMIN_ID, PROPOSAL_ID)).rejects.toBeInstanceOf(GroupProposalNotFoundError);
  });

  it('throws ProposalNotPendingError when already reviewed', async () => {
    mockProposalFindUnique.mockResolvedValue({ ...PROPOSAL_ROW, status: 'APPROVED' });
    await expect(approveGroupProposal(ADMIN_ID, PROPOSAL_ID)).rejects.toBeInstanceOf(ProposalNotPendingError);
  });
});

// ── rejectGroupProposal ───────────────────────────────────────────────────────

describe('rejectGroupProposal()', () => {
  it('rejects the proposal with REJECTED status', async () => {
    mockProposalFindUnique.mockResolvedValue(PROPOSAL_ROW);
    const rejectedRow = { ...PROPOSAL_ROW, status: 'REJECTED', reviewedByAdminId: ADMIN_ID, reviewedAt: new Date() };
    mockProposalUpdate.mockResolvedValue(rejectedRow);

    const result = await rejectGroupProposal(ADMIN_ID, PROPOSAL_ID, 'Not aligned with platform goals');

    expect(result.status).toBe('REJECTED');
    expect(mockProposalUpdate).toHaveBeenCalledTimes(1);
  });

  it('throws GroupProposalNotFoundError when proposal does not exist', async () => {
    mockProposalFindUnique.mockResolvedValue(null);
    await expect(rejectGroupProposal(ADMIN_ID, PROPOSAL_ID)).rejects.toBeInstanceOf(GroupProposalNotFoundError);
  });

  it('throws ProposalNotPendingError when proposal is not PENDING', async () => {
    mockProposalFindUnique.mockResolvedValue({ ...PROPOSAL_ROW, status: 'REJECTED' });
    await expect(rejectGroupProposal(ADMIN_ID, PROPOSAL_ID)).rejects.toBeInstanceOf(ProposalNotPendingError);
  });
});
