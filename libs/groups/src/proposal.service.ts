import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'groups:proposals' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class GroupProposalNotFoundError extends Error {
  constructor() {
    super('GROUP_PROPOSAL_NOT_FOUND');
    this.name = 'GroupProposalNotFoundError';
  }
}

export class AlreadyProposedError extends Error {
  constructor() {
    super('ALREADY_PROPOSED');
    this.name = 'AlreadyProposedError';
  }
}

export class ProposalNotPendingError extends Error {
  constructor() {
    super('PROPOSAL_NOT_PENDING');
    this.name = 'ProposalNotPendingError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface GroupProposalDto {
  id: string;
  proposedByUserId: string;
  name: string;
  description: string;
  type: string;
  country: string | null;
  rationale: string;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ProposeGroupData {
  name: string;
  description: string;
  type?: string;
  country?: string;
  rationale: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toProposalDto(row: {
  id: string;
  proposedByUserId: string;
  name: string;
  description: string;
  type: string;
  country: string | null;
  rationale: string;
  status: string;
  reviewedAt: Date | null;
  createdAt: Date;
}): GroupProposalDto {
  return {
    id: row.id,
    proposedByUserId: row.proposedByUserId,
    name: row.name,
    description: row.description,
    type: row.type,
    country: row.country,
    rationale: row.rationale,
    status: row.status,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Propose a new INTEREST group.
 * User must be a real (non-seeded) user.
 *
 * @throws {AlreadyProposedError} — if user has a PENDING proposal with the same name
 */
export async function proposeGroup(
  userId: string,
  data: ProposeGroupData,
): Promise<GroupProposalDto> {
  const existing = await prisma.groupProposal.findFirst({
    where: {
      proposedByUserId: userId,
      name: data.name,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existing) throw new AlreadyProposedError();

  const proposal = await prisma.groupProposal.create({
    data: {
      proposedByUserId: userId,
      name: data.name,
      description: data.description,
      type: (data.type ?? 'INTEREST') as 'INTEREST',
      country: data.country ?? null,
      rationale: data.rationale,
      status: 'PENDING',
    },
  });

  log.info('proposeGroup — proposal created', { userId, proposalId: proposal.id });

  return toProposalDto(proposal);
}

/**
 * List group proposals by status (admin use).
 */
export async function getGroupProposals(
  status?: string,
): Promise<GroupProposalDto[]> {
  const proposals = await prisma.groupProposal.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return proposals.map(toProposalDto);
}

/**
 * Approve a group proposal. Creates the Group and auto-joins the proposer.
 *
 * @throws {GroupProposalNotFoundError}
 * @throws {ProposalNotPendingError}
 */
export async function approveGroupProposal(
  adminId: string,
  proposalId: string,
): Promise<GroupProposalDto> {
  const proposal = await prisma.groupProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) throw new GroupProposalNotFoundError();
  if (proposal.status !== 'PENDING') throw new ProposalNotPendingError();

  // Create the Group and update proposal in a transaction
  const [updatedProposal] = await prisma.$transaction([
    prisma.groupProposal.update({
      where: { id: proposalId },
      data: {
        status: 'APPROVED',
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    }),
    prisma.group.create({
      data: {
        name: proposal.name,
        type: proposal.type,
        scope: 'COUNTRY',
        region: proposal.country ?? 'GLOBAL',
        country: proposal.country ?? null,
        description: proposal.description,
        status: 'FORMING',
        accessType: 'OPEN',
        isActive: true,
        launchDate: new Date(),
        maxMembers: 50,
        capacity: 50,
      },
    }),
  ]);

  // Auto-join the proposer
  const newGroup = await prisma.group.findFirst({
    where: { name: proposal.name, type: proposal.type },
    orderBy: { createdAt: 'desc' },
    select: { id: true, memberCount: true },
  });

  if (newGroup) {
    await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          userId: proposal.proposedByUserId,
          groupId: newGroup.id,
          status: 'ACTIVE',
          role: 'MEMBER',
          joinedVia: 'MANUAL',
        },
      }),
      prisma.group.update({
        where: { id: newGroup.id },
        data: { memberCount: { increment: 1 } },
      }),
    ]);
  }

  log.info('approveGroupProposal', { proposalId, adminId });

  return toProposalDto(updatedProposal);
}

/**
 * Reject a group proposal.
 *
 * @throws {GroupProposalNotFoundError}
 * @throws {ProposalNotPendingError}
 */
export async function rejectGroupProposal(
  adminId: string,
  proposalId: string,
  _reason?: string,
): Promise<GroupProposalDto> {
  const proposal = await prisma.groupProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) throw new GroupProposalNotFoundError();
  if (proposal.status !== 'PENDING') throw new ProposalNotPendingError();

  const updated = await prisma.groupProposal.update({
    where: { id: proposalId },
    data: {
      status: 'REJECTED',
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    },
  });

  log.info('rejectGroupProposal', { proposalId, adminId });

  return toProposalDto(updated);
}
