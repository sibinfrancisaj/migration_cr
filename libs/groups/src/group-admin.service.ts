/**
 * ADMIN-010 — Group admin service.
 * Full group CRUD: create system groups, update metadata, archive groups.
 * Distinct from proposal.service.ts (which handles member-proposed INTEREST groups).
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { auditLog } from '@abroad-matrimony/auth';
import { GroupStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'groups:admin' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class GroupAdminNotFoundError extends Error {
  constructor() {
    super('GROUP_NOT_FOUND');
    this.name = 'GroupAdminNotFoundError';
  }
}

export class GroupAlreadyArchivedError extends Error {
  constructor() {
    super('GROUP_ALREADY_ARCHIVED');
    this.name = 'GroupAlreadyArchivedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface GroupAdminDto {
  id: string;
  name: string;
  description: string | null;
  type: string;
  scope: string;
  status: string;
  accessType: string;
  targetCountry: string | null;
  targetCity: string | null;
  parentGroupId: string | null;
  memberCount: number;
  isSeeded: boolean;
  createdAt: string;
}

export interface CreateGroupAdminInput {
  name: string;
  description?: string;
  type: string;           // REGIONAL | CULTURAL | PROFESSIONAL | INTEREST
  scope?: string;         // COUNTRY | GLOBAL
  accessType?: string;    // OPEN | INVITE_ONLY
  targetCountry?: string;
  targetCity?: string;
  parentGroupId?: string;
}

export interface UpdateGroupAdminInput {
  name?: string;
  description?: string;
  accessType?: string;
  targetCountry?: string;
  targetCity?: string;
}

// ─── listAdminGroups ──────────────────────────────────────────────────────────

export async function listAdminGroups(params: {
  type?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: GroupAdminDto[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 20, 100);

  const rows = await prisma.group.findMany({
    where: {
      ...(params.type   ? { type:   params.type   as never } : {}),
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.cursor ? { id: { gt: params.cursor } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      scope: true,
      status: true,
      accessType: true,
      targetCountry: true,
      targetCity: true,
      parentGroupId: true,
      memberCount: true,
      isSeeded: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map(toGroupAdminDto),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ─── getAdminGroup ────────────────────────────────────────────────────────────

export async function getAdminGroup(groupId: string): Promise<GroupAdminDto> {
  const row = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      scope: true,
      status: true,
      accessType: true,
      targetCountry: true,
      targetCity: true,
      parentGroupId: true,
      memberCount: true,
      isSeeded: true,
      createdAt: true,
    },
  });

  if (!row) throw new GroupAdminNotFoundError();
  return toGroupAdminDto(row);
}

// ─── createAdminGroup ─────────────────────────────────────────────────────────

export async function createAdminGroup(
  input: CreateGroupAdminInput,
  adminId: string,
  ipAddress: string,
): Promise<GroupAdminDto> {
  const row = await prisma.group.create({
    data: {
      name:          input.name,
      description:   input.description ?? null,
      type:          input.type as never,
      scope:         (input.scope ?? 'COUNTRY') as never,
      accessType:    (input.accessType ?? 'OPEN') as never,
      status:        GroupStatus.ACTIVE as never,
      targetCountry: input.targetCountry ?? null,
      targetCity:    input.targetCity ?? null,
      parentGroupId: input.parentGroupId ?? null,
      memberCount:   0,
      isSeeded:      false,
    },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      scope: true,
      status: true,
      accessType: true,
      targetCountry: true,
      targetCity: true,
      parentGroupId: true,
      memberCount: true,
      isSeeded: true,
      createdAt: true,
    },
  });

  log.info('createAdminGroup — created', { groupId: row.id, type: input.type, adminId });

  await auditLog({
    adminId,
    action: 'CREATE_GROUP',
    entity: 'Group',
    entityId: row.id,
    ipAddress,
    metadata: { name: input.name, type: input.type },
  });

  return toGroupAdminDto(row);
}

// ─── updateAdminGroup ─────────────────────────────────────────────────────────

export async function updateAdminGroup(
  groupId: string,
  input: UpdateGroupAdminInput,
  adminId: string,
  ipAddress: string,
): Promise<GroupAdminDto> {
  const existing = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });
  if (!existing) throw new GroupAdminNotFoundError();

  const row = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(input.name          !== undefined ? { name: input.name }                       : {}),
      ...(input.description   !== undefined ? { description: input.description }         : {}),
      ...(input.accessType    !== undefined ? { accessType: input.accessType as never }  : {}),
      ...(input.targetCountry !== undefined ? { targetCountry: input.targetCountry }     : {}),
      ...(input.targetCity    !== undefined ? { targetCity: input.targetCity }           : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      scope: true,
      status: true,
      accessType: true,
      targetCountry: true,
      targetCity: true,
      parentGroupId: true,
      memberCount: true,
      isSeeded: true,
      createdAt: true,
    },
  });

  log.info('updateAdminGroup — updated', { groupId, adminId });

  await auditLog({
    adminId,
    action: 'UPDATE_GROUP',
    entity: 'Group',
    entityId: groupId,
    ipAddress,
    metadata: input,
  });

  return toGroupAdminDto(row);
}

// ─── archiveAdminGroup ────────────────────────────────────────────────────────

export async function archiveAdminGroup(
  groupId: string,
  adminId: string,
  ipAddress: string,
): Promise<void> {
  const existing = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, status: true },
  });
  if (!existing) throw new GroupAdminNotFoundError();
  if (existing.status === GroupStatus.ARCHIVED) throw new GroupAlreadyArchivedError();

  await prisma.group.update({
    where: { id: groupId },
    data: { status: GroupStatus.ARCHIVED as never },
  });

  log.info('archiveAdminGroup — archived', { groupId, adminId });

  await auditLog({
    adminId,
    action: 'ARCHIVE_GROUP',
    entity: 'Group',
    entityId: groupId,
    ipAddress,
    metadata: {},
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toGroupAdminDto(row: {
  id: string;
  name: string;
  description: string | null;
  type: string;
  scope: string;
  status: string;
  accessType: string;
  targetCountry: string | null;
  targetCity: string | null;
  parentGroupId: string | null;
  memberCount: number;
  isSeeded: boolean;
  createdAt: Date;
}): GroupAdminDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    scope: row.scope,
    status: row.status,
    accessType: row.accessType,
    targetCountry: row.targetCountry,
    targetCity: row.targetCity,
    parentGroupId: row.parentGroupId,
    memberCount: row.memberCount,
    isSeeded: row.isSeeded,
    createdAt: row.createdAt.toISOString(),
  };
}
