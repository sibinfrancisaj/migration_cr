/**
 * IDROP-004 — Admin operations on IntroductionDrops.
 *
 * Admin-facing service for managing introduction drops:
 *   - listAllDrops      — filtered list of all drops (any status)
 *   - getDropAdmin      — full drop detail with pairing counts (not user-scoped)
 *   - approveDrop       — DRAFT → PENDING_APPROVAL; fire-and-forget pairing generation
 *   - updateDropMembers — update the member pool on an editable drop
 *   - scheduleDropRelease — set/update releaseAt on an editable drop
 *   - proposeNewDrop    — manually create a DRAFT drop
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { IntroductionDropNotFoundError } from './drop.service.js';
import { generatePairingsForDrop } from './pairing.service.js';

const log = createChildLogger({ module: 'introductions:drop-admin' });

// ─── Error classes ────────────────────────────────────────────────────────────

export class DropNotDraftError extends Error {
  constructor() {
    super('DROP_NOT_DRAFT');
    this.name = 'DropNotDraftError';
  }
}

export class DropMemberPoolTooSmallError extends Error {
  constructor() {
    super('DROP_MEMBER_POOL_TOO_SMALL');
    this.name = 'DropMemberPoolTooSmallError';
  }
}

export class DropNotEditableError extends Error {
  constructor() {
    super('DROP_NOT_EDITABLE');
    this.name = 'DropNotEditableError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface IntroductionDropAdminDto {
  id: string;
  name: string;
  criteria: unknown;
  status: string;
  memberPool: string[];
  releaseAt: string | null;
  expiresAt: string | null;
  earlyAccessCost: number;
  unlockCost: number;
  pairingCount: number;
  createdAt: string;
}

export interface ProposeDropBody {
  name: string;
  criteria?: unknown;
  memberPool: string[];
  earlyAccessCost?: number;
  unlockCost?: number;
  releaseAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toAdminDto(
  drop: {
    id: string;
    name: string;
    criteria: unknown;
    status: string;
    memberPool: string[];
    releaseAt: Date | null;
    expiresAt: Date | null;
    earlyAccessCost: number;
    unlockCost: number;
    createdAt: Date;
    _count?: { introductions?: number };
  },
): IntroductionDropAdminDto {
  return {
    id: drop.id,
    name: drop.name,
    criteria: drop.criteria,
    status: drop.status,
    memberPool: drop.memberPool,
    releaseAt: drop.releaseAt?.toISOString() ?? null,
    expiresAt: drop.expiresAt?.toISOString() ?? null,
    earlyAccessCost: drop.earlyAccessCost,
    unlockCost: drop.unlockCost,
    pairingCount: drop._count?.introductions ?? 0,
    createdAt: drop.createdAt.toISOString(),
  };
}

/** Statuses that can still be edited before they go live. */
const EDITABLE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'SCHEDULED'];

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List all IntroductionDrops with optional status filter.
 */
export async function listAllDrops(
  options: { status?: string } = {},
): Promise<IntroductionDropAdminDto[]> {
  const drops = await prisma.introductionDrop.findMany({
    where: options.status ? { status: options.status as any } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { introductions: true } } },
  });

  return drops.map(toAdminDto);
}

/**
 * Get full admin-view detail of a single drop.
 *
 * @throws {IntroductionDropNotFoundError}
 */
export async function getDropAdmin(dropId: string): Promise<IntroductionDropAdminDto> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: { _count: { select: { introductions: true } } },
  });

  if (!drop) throw new IntroductionDropNotFoundError();
  return toAdminDto(drop);
}

/**
 * Approve a DRAFT drop.
 * Transitions status to PENDING_APPROVAL and fires pairing generation asynchronously.
 *
 * @throws {IntroductionDropNotFoundError}
 * @throws {DropNotDraftError}
 */
export async function approveDrop(dropId: string): Promise<IntroductionDropAdminDto> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: { _count: { select: { introductions: true } } },
  });

  if (!drop) throw new IntroductionDropNotFoundError();
  if (drop.status !== 'DRAFT') throw new DropNotDraftError();

  const updated = await prisma.introductionDrop.update({
    where: { id: dropId },
    data: { status: 'PENDING_APPROVAL' as any },
    include: { _count: { select: { introductions: true } } },
  });

  // Fire pairing generation asynchronously (will update status to SCHEDULED when complete)
  void generatePairingsForDrop(dropId).catch((err) => {
    log.error('generatePairingsForDrop failed after admin approval', { dropId, err });
  });

  log.info('approveDrop — drop approved, pairing generation enqueued', { dropId });
  return toAdminDto(updated);
}

/**
 * Update the member pool for an editable drop (DRAFT / PENDING_APPROVAL / SCHEDULED).
 *
 * @throws {IntroductionDropNotFoundError}
 * @throws {DropNotEditableError}
 * @throws {DropMemberPoolTooSmallError}
 */
export async function updateDropMembers(
  dropId: string,
  memberPool: string[],
): Promise<IntroductionDropAdminDto> {
  if (memberPool.length < 2) throw new DropMemberPoolTooSmallError();

  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: { _count: { select: { introductions: true } } },
  });

  if (!drop) throw new IntroductionDropNotFoundError();
  if (!EDITABLE_STATUSES.includes(drop.status)) throw new DropNotEditableError();

  const updated = await prisma.introductionDrop.update({
    where: { id: dropId },
    data: { memberPool },
    include: { _count: { select: { introductions: true } } },
  });

  log.info('updateDropMembers — member pool updated', { dropId, poolSize: memberPool.length });
  return toAdminDto(updated);
}

/**
 * Set or update the releaseAt timestamp for an editable drop.
 *
 * @throws {IntroductionDropNotFoundError}
 * @throws {DropNotEditableError}
 */
export async function scheduleDropRelease(
  dropId: string,
  releaseAt: Date,
): Promise<IntroductionDropAdminDto> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: { _count: { select: { introductions: true } } },
  });

  if (!drop) throw new IntroductionDropNotFoundError();
  if (!EDITABLE_STATUSES.includes(drop.status)) throw new DropNotEditableError();

  const updated = await prisma.introductionDrop.update({
    where: { id: dropId },
    data: { releaseAt },
    include: { _count: { select: { introductions: true } } },
  });

  log.info('scheduleDropRelease — releaseAt set', { dropId, releaseAt });
  return toAdminDto(updated);
}

/**
 * Manually propose (create) a new DRAFT drop.
 * Use when admin wants to create a drop without AI curation.
 *
 * @throws {DropMemberPoolTooSmallError}
 */
export async function proposeNewDrop(body: ProposeDropBody): Promise<IntroductionDropAdminDto> {
  if (body.memberPool.length < 2) throw new DropMemberPoolTooSmallError();

  const drop = await prisma.introductionDrop.create({
    data: {
      name: body.name,
      criteria: (body.criteria ?? {}) as any,
      memberPool: body.memberPool,
      earlyAccessCost: body.earlyAccessCost ?? 0,
      unlockCost: body.unlockCost ?? 0,
      releaseAt: body.releaseAt ? new Date(body.releaseAt) : null,
      status: 'DRAFT' as any,
    },
    include: { _count: { select: { introductions: true } } },
  });

  log.info('proposeNewDrop — new DRAFT drop created', { dropId: drop.id, name: drop.name });
  return toAdminDto(drop);
}
