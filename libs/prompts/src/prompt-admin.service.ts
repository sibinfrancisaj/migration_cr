/**
 * ADMIN-009 — Prompt admin service.
 * Create and manage weekly prompts. Admin-level access only.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { auditLog } from '@abroad-matrimony/auth';
import { getWeekKey } from '@abroad-matrimony/introductions';

const log = createChildLogger({ module: 'prompts:admin' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class PromptAdminNotFoundError extends Error {
  constructor() {
    super('PROMPT_NOT_FOUND');
    this.name = 'PromptAdminNotFoundError';
  }
}

export class PromptAlreadyExistsError extends Error {
  constructor() {
    super('PROMPT_ALREADY_EXISTS_FOR_WEEK');
    this.name = 'PromptAlreadyExistsError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface PromptAdminDto {
  id: string;
  weekKey: string;
  question: string;
  theme: string | null;
  publishedAt: string;
  expiresAt: string;
  responseCount: number;
}

export interface CreatePromptInput {
  weekKey?: string;       // defaults to current week
  question: string;
  theme?: string;
  publishedAt?: string;   // defaults to now
  expiresAt?: string;     // defaults to 7 days from now
}

// ─── listAdminPrompts ─────────────────────────────────────────────────────────

export async function listAdminPrompts(params: {
  limit?: number;
  cursor?: string;
}): Promise<{ items: PromptAdminDto[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 20, 100);

  const rows = await prisma.weeklyPrompt.findMany({
    where: params.cursor ? { id: { gt: params.cursor } } : {},
    orderBy: { publishedAt: 'desc' },
    take: limit + 1,
    include: { _count: { select: { responses: true } } },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map(toPromptAdminDto),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ─── getAdminPrompt ───────────────────────────────────────────────────────────

export async function getAdminPrompt(promptId: string): Promise<PromptAdminDto> {
  const row = await prisma.weeklyPrompt.findUnique({
    where: { id: promptId },
    include: { _count: { select: { responses: true } } },
  });
  if (!row) throw new PromptAdminNotFoundError();
  return toPromptAdminDto(row);
}

// ─── createPrompt ─────────────────────────────────────────────────────────────

export async function createPrompt(
  input: CreatePromptInput,
  adminId: string,
  ipAddress: string,
): Promise<PromptAdminDto> {
  const now = new Date();
  const weekKey = input.weekKey ?? getWeekKey(now);
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : now;
  const expiresAt   = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(publishedAt.getTime() + 7 * 86_400_000);

  // Guard against duplicate weekKey
  const existing = await prisma.weeklyPrompt.findUnique({
    where: { weekKey },
    select: { id: true },
  });
  if (existing) throw new PromptAlreadyExistsError();

  const row = await prisma.weeklyPrompt.create({
    data: {
      weekKey,
      question:    input.question,
      theme:       input.theme ?? null,
      publishedAt,
      expiresAt,
    },
    include: { _count: { select: { responses: true } } },
  });

  log.info('createPrompt — created', { promptId: row.id, weekKey, adminId });

  await auditLog({
    adminId,
    action: 'CREATE_PROMPT',
    entity: 'WeeklyPrompt',
    entityId: row.id,
    ipAddress,
    metadata: { weekKey, question: input.question },
  });

  return toPromptAdminDto(row);
}

// ─── updatePrompt ─────────────────────────────────────────────────────────────

export async function updatePrompt(
  promptId: string,
  input: Partial<Omit<CreatePromptInput, 'weekKey'>>,
  adminId: string,
  ipAddress: string,
): Promise<PromptAdminDto> {
  const existing = await prisma.weeklyPrompt.findUnique({
    where: { id: promptId },
    select: { id: true },
  });
  if (!existing) throw new PromptAdminNotFoundError();

  const row = await prisma.weeklyPrompt.update({
    where: { id: promptId },
    data: {
      ...(input.question    !== undefined ? { question: input.question }                     : {}),
      ...(input.theme       !== undefined ? { theme: input.theme }                           : {}),
      ...(input.publishedAt !== undefined ? { publishedAt: new Date(input.publishedAt) }     : {}),
      ...(input.expiresAt   !== undefined ? { expiresAt: new Date(input.expiresAt) }         : {}),
    },
    include: { _count: { select: { responses: true } } },
  });

  log.info('updatePrompt — updated', { promptId, adminId });

  await auditLog({
    adminId,
    action: 'UPDATE_PROMPT',
    entity: 'WeeklyPrompt',
    entityId: promptId,
    ipAddress,
    metadata: input,
  });

  return toPromptAdminDto(row);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPromptAdminDto(row: {
  id: string;
  weekKey: string;
  question: string;
  theme: string | null;
  publishedAt: Date;
  expiresAt: Date;
  _count: { responses: number };
}): PromptAdminDto {
  return {
    id: row.id,
    weekKey: row.weekKey,
    question: row.question,
    theme: row.theme,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    responseCount: row._count.responses,
  };
}
