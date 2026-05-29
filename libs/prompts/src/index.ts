import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { PromptResponseType } from '@abroad-matrimony/shared';
import { getWeekKey } from '@abroad-matrimony/introductions';

const log = createChildLogger({ module: 'prompts' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class PromptNotFoundError extends Error {
  constructor() {
    super('PROMPT_NOT_FOUND');
    this.name = 'PromptNotFoundError';
  }
}

export class PromptResponseNotFoundError extends Error {
  constructor() {
    super('PROMPT_RESPONSE_NOT_FOUND');
    this.name = 'PromptResponseNotFoundError';
  }
}

export class AlreadyRespondedError extends Error {
  constructor() {
    super('ALREADY_RESPONDED');
    this.name = 'AlreadyRespondedError';
  }
}

export class AlreadyResonatedError extends Error {
  constructor() {
    super('ALREADY_RESONATED');
    this.name = 'AlreadyResonatedError';
  }
}

export class ResonateNotFoundError extends Error {
  constructor() {
    super('RESONATE_NOT_FOUND');
    this.name = 'ResonateNotFoundError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface PromptDto {
  id: string;
  weekKey: string;
  question: string;
  theme: string | null;
  publishedAt: string;
  expiresAt: string;
  hasResponded: boolean;
}

export interface PromptResponseDto {
  id: string;
  userId: string;
  promptId: string;
  text: string;
  type: string;
  mediaUrl: string | null;
  resonateCount: number;
  hasResonated: boolean;
  authorName: string | null;
  createdAt: string;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Get the current week's prompt.
 * Returns null if no prompt has been published for this week yet.
 */
export async function getCurrentPrompt(userId: string): Promise<PromptDto | null> {
  const weekKey = getWeekKey(new Date());

  const prompt = await prisma.weeklyPrompt.findUnique({
    where: { weekKey },
    select: {
      id: true,
      weekKey: true,
      question: true,
      theme: true,
      publishedAt: true,
      expiresAt: true,
      _count: { select: { responses: { where: { userId } } } },
    },
  });

  if (!prompt) return null;

  return {
    id: prompt.id,
    weekKey: prompt.weekKey,
    question: prompt.question,
    theme: prompt.theme,
    publishedAt: prompt.publishedAt.toISOString(),
    expiresAt: prompt.expiresAt.toISOString(),
    hasResponded: prompt._count.responses > 0,
  };
}

/**
 * Submit a response to a weekly prompt.
 *
 * @throws {PromptNotFoundError}
 * @throws {AlreadyRespondedError}
 */
export async function respondToPrompt(
  userId: string,
  promptId: string,
  text: string,
  type: PromptResponseType = PromptResponseType.TEXT,
  mediaUrl?: string,
): Promise<PromptResponseDto> {
  const prompt = await prisma.weeklyPrompt.findUnique({
    where: { id: promptId },
    select: { id: true, expiresAt: true },
  });

  if (!prompt) throw new PromptNotFoundError();

  if (prompt.expiresAt < new Date()) {
    throw new PromptNotFoundError(); // treat expired as not found
  }

  const existing = await prisma.promptResponse.findUnique({
    where: { userId_promptId: { userId, promptId } },
    select: { id: true },
  });

  if (existing) throw new AlreadyRespondedError();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile: { select: { name: true } } },
  });

  const response = await prisma.promptResponse.create({
    data: {
      userId,
      promptId,
      text,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      mediaUrl: mediaUrl ?? null,
      resonateCount: 0,
    },
  });

  log.info('respondToPrompt — response created', { userId, promptId, responseId: response.id });

  return {
    id: response.id,
    userId: response.userId,
    promptId: response.promptId,
    text: response.text,
    type: response.type,
    mediaUrl: response.mediaUrl,
    resonateCount: response.resonateCount,
    hasResonated: false,
    authorName: user?.profile?.name ?? null,
    createdAt: response.createdAt.toISOString(),
  };
}

/**
 * Get responses for a weekly prompt (paginated).
 *
 * @throws {PromptNotFoundError}
 */
export async function getPromptResponses(
  userId: string,
  promptId: string,
  page: number,
  limit: number,
): Promise<{ responses: PromptResponseDto[]; total: number }> {
  const prompt = await prisma.weeklyPrompt.findUnique({
    where: { id: promptId },
    select: { id: true },
  });

  if (!prompt) throw new PromptNotFoundError();

  const [rows, total, resonates] = await prisma.$transaction([
    prisma.promptResponse.findMany({
      where: { promptId },
      orderBy: { resonateCount: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { profile: { select: { name: true } } } },
      },
    }),
    prisma.promptResponse.count({ where: { promptId } }),
    prisma.promptResonate.findMany({
      where: { userId },
      select: { responseId: true },
    }),
  ]);

  const resonatedIds = new Set(resonates.map((r) => r.responseId));

  return {
    responses: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      promptId: row.promptId,
      text: row.text,
      type: row.type,
      mediaUrl: row.mediaUrl,
      resonateCount: row.resonateCount,
      hasResonated: resonatedIds.has(row.id),
      authorName: row.user?.profile?.name ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
  };
}

/**
 * Resonate (react) to a prompt response.
 *
 * @throws {PromptResponseNotFoundError}
 * @throws {AlreadyResonatedError}
 */
export async function resonateResponse(
  userId: string,
  responseId: string,
): Promise<void> {
  const response = await prisma.promptResponse.findUnique({
    where: { id: responseId },
    select: { id: true },
  });

  if (!response) throw new PromptResponseNotFoundError();

  const existing = await prisma.promptResonate.findUnique({
    where: { userId_responseId: { userId, responseId } },
    select: { id: true },
  });

  if (existing) throw new AlreadyResonatedError();

  await prisma.$transaction([
    prisma.promptResonate.create({ data: { userId, responseId } }),
    prisma.promptResponse.update({
      where: { id: responseId },
      data: { resonateCount: { increment: 1 } },
    }),
  ]);

  log.info('resonateResponse — resonated', { userId, responseId });
}

/**
 * Remove a resonate reaction from a prompt response.
 *
 * @throws {PromptResponseNotFoundError}
 * @throws {ResonateNotFoundError}
 */
export async function unresonateResponse(
  userId: string,
  responseId: string,
): Promise<void> {
  const response = await prisma.promptResponse.findUnique({
    where: { id: responseId },
    select: { id: true },
  });

  if (!response) throw new PromptResponseNotFoundError();

  const resonate = await prisma.promptResonate.findUnique({
    where: { userId_responseId: { userId, responseId } },
    select: { id: true },
  });

  if (!resonate) throw new ResonateNotFoundError();

  await prisma.$transaction([
    prisma.promptResonate.delete({
      where: { userId_responseId: { userId, responseId } },
    }),
    prisma.promptResponse.update({
      where: { id: responseId },
      data: { resonateCount: { decrement: 1 } },
    }),
  ]);

  log.info('unresonateResponse — unresonnated', { userId, responseId });
}
