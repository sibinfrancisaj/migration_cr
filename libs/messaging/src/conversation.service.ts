import { prisma } from '@abroad-matrimony/db';
import { MediaType } from '@abroad-matrimony/shared';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ConversationSummaryDto, PaginatedMessagesResult } from './types/messaging.types.js';
import { getMessagingAdapter } from './adapters/index.js';

const log = createChildLogger({ module: 'messaging:conversation' });

// ─── Constants ────────────────────────────────────────────────────────────────

export const CONVERSATION_MESSAGES_DEFAULT_LIMIT = 50;

// ─── Custom errors ────────────────────────────────────────────────────────────

export class ConversationNotFoundError extends Error {
  constructor() {
    super('CONVERSATION_NOT_FOUND');
    this.name = 'ConversationNotFoundError';
  }
}

export class ConversationForbiddenError extends Error {
  constructor() {
    super('CONVERSATION_FORBIDDEN');
    this.name = 'ConversationForbiddenError';
  }
}

// ─── Shared include clause ────────────────────────────────────────────────────

/**
 * Reusable Prisma include for conversation queries — fetches match + both users'
 * profile name and first profile photo.
 */
const CONVERSATION_WITH_PARTICIPANTS = {
  match: {
    include: {
      userA: {
        select: {
          id: true,
          profile: { select: { name: true } },
          media: {
            where: { type: MediaType.PHOTO },
            orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
            take: 1,
            select: { url: true },
          },
        },
      },
      userB: {
        select: {
          id: true,
          profile: { select: { name: true } },
          media: {
            where: { type: MediaType.PHOTO },
            orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
} as const;

// ─── Row types ────────────────────────────────────────────────────────────────

type ConversationRow = Awaited<ReturnType<typeof prisma.conversation.findMany<{
  include: typeof CONVERSATION_WITH_PARTICIPANTS;
}>>>[number];

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toSummaryDto(row: ConversationRow, viewerUserId: string): ConversationSummaryDto {
  const { match } = row;
  const isViewerA = match.userAId === viewerUserId;
  const other = isViewerA ? match.userB : match.userA;

  return {
    conversationId: row.id,
    matchId: row.matchId,
    otherUser: {
      userId: other.id,
      name: other.profile?.name ?? '',
      photoUrl: other.media[0]?.url ?? null,
    },
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    unreadCount: 0, // MSG-004 will compute this from read receipts
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns all non-archived conversations for `userId`, newest-first.
 */
export async function listConversations(userId: string): Promise<ConversationSummaryDto[]> {
  const rows = await prisma.conversation.findMany({
    where: {
      match: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    },
    include: CONVERSATION_WITH_PARTICIPANTS,
    orderBy: [
      { lastMessageAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  log.debug('listConversations', { userId, count: rows.length });
  return rows.map((row) => toSummaryDto(row, userId));
}

/**
 * Returns conversation metadata for a single conversation.
 *
 * @throws {ConversationNotFoundError} if the conversation doesn't exist
 * @throws {ConversationForbiddenError} if the caller is not a participant
 */
export async function getConversation(
  userId: string,
  convId: string,
): Promise<ConversationSummaryDto> {
  const row = await prisma.conversation.findUnique({
    where: { id: convId },
    include: CONVERSATION_WITH_PARTICIPANTS,
  });

  if (!row) {
    log.warn('getConversation — not found', { convId, userId });
    throw new ConversationNotFoundError();
  }

  if (row.match.userAId !== userId && row.match.userBId !== userId) {
    log.warn('getConversation — forbidden', { convId, userId });
    throw new ConversationForbiddenError();
  }

  return toSummaryDto(row, userId);
}

/**
 * Fetches paginated messages for a conversation from the real-time store (Firestore/Mock).
 * Verifies existence and participant authorization against Postgres first.
 *
 * @throws {ConversationNotFoundError} if the conversation doesn't exist
 * @throws {ConversationForbiddenError} if the caller is not a participant
 */
export async function getConversationMessages(
  userId: string,
  convId: string,
  limit: number,
  cursor?: string,
): Promise<PaginatedMessagesResult> {
  // Fast Postgres authorization check — just ids, no heavy includes
  const row = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { match: { select: { userAId: true, userBId: true } } },
  });

  if (!row) {
    log.warn('getConversationMessages — not found', { convId, userId });
    throw new ConversationNotFoundError();
  }

  if (row.match.userAId !== userId && row.match.userBId !== userId) {
    log.warn('getConversationMessages — forbidden', { convId, userId });
    throw new ConversationForbiddenError();
  }

  log.debug('getConversationMessages', { convId, userId, limit, hasCursor: !!cursor });
  return getMessagingAdapter().getMessages(convId, limit, cursor);
}
