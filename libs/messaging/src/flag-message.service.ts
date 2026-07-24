import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { FlagReason, FlagAction } from '@abroad-matrimony/shared';
import { getMessagingAdapter } from './adapters/index.js';

const log = createChildLogger({ module: 'messaging:flag' });

// ─── Constants ────────────────────────────────────────────────────────────────

/** Auto-hide threshold: 3 flags → isHidden = true in Firestore. */
export const FLAG_AUTO_HIDE_THRESHOLD = 3;

// ─── Custom errors ────────────────────────────────────────────────────────────

export class MessageNotFoundError extends Error {
  constructor() {
    super('MESSAGE_NOT_FOUND');
    this.name = 'MessageNotFoundError';
  }
}

export class AlreadyFlaggedError extends Error {
  constructor() {
    super('ALREADY_FLAGGED');
    this.name = 'AlreadyFlaggedError';
  }
}

export class FlagSelfError extends Error {
  constructor() {
    super('FLAG_SELF');
    this.name = 'FlagSelfError';
  }
}

export class FlagNotFoundError extends Error {
  constructor() {
    super('FLAG_NOT_FOUND');
    this.name = 'FlagNotFoundError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface FlagDto {
  id: string;
  reporterId: string;
  targetUserId: string;
  targetEntityId: string;
  reason: string;
  description: string | null;
  status: string;
  actionTaken: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ResolveFlagParams {
  /** New status: RESOLVED or DISMISSED. */
  status: 'RESOLVED' | 'DISMISSED';
  actionTaken?: FlagAction;
  resolution?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFlagDto(row: {
  id: string;
  reporterId: string;
  targetUserId: string;
  targetEntityId: string | null;
  reason: string;
  description: string | null;
  status: string;
  actionTaken: string | null;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}): FlagDto {
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetUserId: row.targetUserId,
    targetEntityId: row.targetEntityId ?? '',
    reason: row.reason,
    description: row.description,
    status: row.status,
    actionTaken: row.actionTaken,
    resolution: row.resolution,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Flag a message for moderation.
 *
 * Flow:
 *  1. Look up Postgres message row — get conversationId + senderId.
 *  2. Prevent self-flagging.
 *  3. Prevent duplicate flags from the same reporter.
 *  4. Create a Postgres flag record.
 *  5. Atomically increment Firestore flagCount; auto-hides at threshold.
 *
 * @throws {MessageNotFoundError}   – message doesn't exist
 * @throws {FlagSelfError}          – reporter is the message sender
 * @throws {AlreadyFlaggedError}    – reporter already flagged this message
 */
export async function flagMessage(
  reporterId: string,
  messageId: string,
  reason: FlagReason,
  description?: string,
): Promise<FlagDto> {
  // 1. Verify message exists; get conversationId + senderId
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, senderId: true },
  });

  if (!message) {
    log.warn('flagMessage — message not found', { messageId, reporterId });
    throw new MessageNotFoundError();
  }

  // 2. Prevent self-flagging
  if (message.senderId === reporterId) {
    log.warn('flagMessage — self-flag attempt', { messageId, reporterId });
    throw new FlagSelfError();
  }

  // 3. Prevent duplicate flags from same reporter
  const existing = await prisma.flag.findFirst({
    where: { reporterId, targetEntityId: messageId, targetEntityType: 'message' },
    select: { id: true },
  });

  if (existing) {
    log.warn('flagMessage — already flagged', { messageId, reporterId });
    throw new AlreadyFlaggedError();
  }

  // 4. Create flag record in Postgres
  const flag = await prisma.flag.create({
    data: {
      reporterId,
      targetUserId: message.senderId,
      targetEntityType: 'message',
      targetEntityId: messageId,
      firestoreMsgId: messageId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason: reason as any, // FlagReason values identical to Prisma enum
      description: description ?? null,
    },
  });

  log.info('flagMessage — flag created', { flagId: flag.id, messageId, reporterId });

  // 5. Atomically increment Firestore flagCount (auto-hides at threshold)
  try {
    const newCount = await getMessagingAdapter().incrementFlagCount(
      message.conversationId,
      messageId,
      FLAG_AUTO_HIDE_THRESHOLD,
    );

    log.info('flagMessage — Firestore flagCount updated', {
      messageId,
      newCount,
      autoHidden: newCount >= FLAG_AUTO_HIDE_THRESHOLD,
    });

    // Mirror isHidden to Postgres when threshold reached
    if (newCount >= FLAG_AUTO_HIDE_THRESHOLD) {
      await prisma.message.update({
        where: { id: messageId },
        data: { isHidden: true, flagCount: newCount },
      });
    } else {
      await prisma.message.update({
        where: { id: messageId },
        data: { flagCount: newCount },
      });
    }
  } catch (err) {
    // Firestore is the real-time source of truth; Postgres update is best-effort
    log.warn('flagMessage — Firestore flagCount update failed (non-fatal)', {
      err: err instanceof Error ? err.message : String(err),
      messageId,
    });
  }

  return toFlagDto(flag);
}

/**
 * Return paginated flag records for a target user (admin use).
 * Newest flags first.
 */
export async function getAdminFlagSummary(
  targetUserId: string,
  page: number,
  limit: number,
): Promise<{ flags: FlagDto[]; total: number }> {
  const [rows, total] = await prisma.$transaction([
    prisma.flag.findMany({
      where: { targetUserId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.flag.count({ where: { targetUserId } }),
  ]);

  return { flags: rows.map(toFlagDto), total };
}

/**
 * List all flags globally (admin moderation queue).
 * Cursor-based pagination, newest first.
 */
export async function listAllFlags(params: {
  status?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ flags: FlagDto[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 20, 100);
  const rows = await prisma.flag.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.cursor ? { id: { gt: params.cursor } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return { flags: page.map(toFlagDto), hasMore, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

/**
 * Resolve or dismiss a flag (admin action).
 *
 * Side-effects:
 *  - If actionTaken = MESSAGE_REMOVED → `adapter.hideMessage()` hides the Firestore doc.
 *  - If status = DISMISSED and no other open flags remain for the same message
 *    → `adapter.unhideMessage()` restores visibility.
 *
 * @throws {FlagNotFoundError} – flag doesn't exist
 */
export async function resolveFlag(
  flagId: string,
  moderatorId: string,
  params: ResolveFlagParams,
): Promise<FlagDto> {
  const flag = await prisma.flag.findUnique({
    where: { id: flagId },
    select: {
      id: true,
      targetEntityId: true,
      targetEntityType: true,
      status: true,
    },
  });

  if (!flag) {
    log.warn('resolveFlag — flag not found', { flagId, moderatorId });
    throw new FlagNotFoundError();
  }

  const now = new Date();

  // Update the flag record
  const updated = await prisma.flag.update({
    where: { id: flagId },
    data: {
      status: params.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actionTaken: params.actionTaken ? (params.actionTaken as any) : undefined,
      resolution: params.resolution ?? null,
      moderatorId,
      resolvedAt: now,
    },
  });

  log.info('resolveFlag — flag updated', {
    flagId,
    moderatorId,
    status: params.status,
    actionTaken: params.actionTaken,
  });

  // Perform Firestore side-effects for message entities
  if (flag.targetEntityType === 'message' && flag.targetEntityId) {
    const msgId = flag.targetEntityId;

    // Look up conversation to pass to adapter
    const msgRow = await prisma.message.findUnique({
      where: { id: msgId },
      select: { conversationId: true },
    });

    if (msgRow) {
      const { conversationId } = msgRow;
      const adapter = getMessagingAdapter();

      if (params.actionTaken === FlagAction.MESSAGE_REMOVED) {
        // Explicitly hide in Firestore + mirror to Postgres
        try {
          await adapter.hideMessage(conversationId, msgId);
          await prisma.message.update({
            where: { id: msgId },
            data: { isHidden: true },
          });
          log.info('resolveFlag — message hidden by admin', { msgId, conversationId, flagId });
        } catch (err) {
          log.warn('resolveFlag — hideMessage failed (non-fatal)', {
            err: err instanceof Error ? err.message : String(err),
            msgId,
          });
        }
      } else if (params.status === 'DISMISSED') {
        // Check if any other open flags remain for this message
        const openCount = await prisma.flag.count({
          where: {
            targetEntityId: msgId,
            targetEntityType: 'message',
            status: 'OPEN',
            id: { not: flagId },
          },
        });

        if (openCount === 0) {
          // Restore visibility
          try {
            await adapter.unhideMessage(conversationId, msgId);
            await prisma.message.update({
              where: { id: msgId },
              data: { isHidden: false },
            });
            log.info('resolveFlag — message unhidden after dismissal', { msgId, conversationId });
          } catch (err) {
            log.warn('resolveFlag — unhideMessage failed (non-fatal)', {
              err: err instanceof Error ? err.message : String(err),
              msgId,
            });
          }
        }
      }
    }
  }

  return toFlagDto(updated);
}
