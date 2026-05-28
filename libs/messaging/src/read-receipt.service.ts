import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getMessagingAdapter } from './adapters/index.js';
import { ConversationNotFoundError, ConversationForbiddenError } from './conversation.service.js';

const log = createChildLogger({ module: 'messaging:read-receipt' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class MessageNotFoundForReadError extends Error {
  constructor() {
    super('MESSAGE_NOT_FOUND');
    this.name = 'MessageNotFoundForReadError';
  }
}

// ─── Service function ─────────────────────────────────────────────────────────

/**
 * Mark all messages up to and including `lastReadMessageId` as read.
 *
 * Flow:
 *  1. Verify the conversation exists and the caller is a participant (Postgres).
 *  2. Verify the target message exists and belongs to the conversation (Postgres).
 *  3. Mark the message as read in Firestore (via MessagingAdapter.markRead).
 *  4. Mirror the `readAt` update to the Postgres audit row.
 *
 * @throws {ConversationNotFoundError}       – conversation doesn't exist
 * @throws {ConversationForbiddenError}      – caller is not a participant
 * @throws {MessageNotFoundForReadError}     – message doesn't exist in this conversation
 */
export async function markConversationRead(
  userId: string,
  convId: string,
  lastReadMessageId: string,
): Promise<void> {
  // 1. Authorization: participant check
  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { match: { select: { userAId: true, userBId: true } } },
  });

  if (!conv) {
    log.warn('markConversationRead — conversation not found', { convId, userId });
    throw new ConversationNotFoundError();
  }

  if (conv.match.userAId !== userId && conv.match.userBId !== userId) {
    log.warn('markConversationRead — forbidden', { convId, userId });
    throw new ConversationForbiddenError();
  }

  // 2. Verify message exists and belongs to this conversation
  const message = await prisma.message.findFirst({
    where: { id: lastReadMessageId, conversationId: convId },
    select: { id: true },
  });

  if (!message) {
    log.warn('markConversationRead — message not found', { lastReadMessageId, convId });
    throw new MessageNotFoundForReadError();
  }

  const now = new Date().toISOString();

  // 3. Mark read in Firestore (real-time store)
  await getMessagingAdapter().markRead({
    conversationId: convId,
    messageId: lastReadMessageId,
    userId,
  });

  // 4. Mirror to Postgres for audit / future unread-count queries
  await prisma.message.updateMany({
    where: { id: lastReadMessageId, conversationId: convId, readAt: null },
    data: { readAt: new Date(now) },
  });

  log.info('markConversationRead', { convId, userId, lastReadMessageId });
}
