import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isFirebaseConfigured, getRealtimeDb, getFirebaseMessaging } from '@abroad-matrimony/firebase';
import { getStorageAdapter } from '@abroad-matrimony/storage';
import { getMessagingAdapter } from './adapters/index.js';
import { MessageType } from './types/messaging.types.js';
import type { MessageDto } from './types/messaging.types.js';
import { ConversationNotFoundError, ConversationForbiddenError } from './conversation.service.js';

const log = createChildLogger({ module: 'messaging:send-message' });

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long presigned upload URLs remain valid (15 minutes). */
const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60;

/** Map MIME type → file extension for S3 keys. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'audio/m4a':  'm4a',
  'audio/webm': 'webm',
};

// ─── Custom errors ────────────────────────────────────────────────────────────

export class ConversationArchivedError extends Error {
  constructor() {
    super('CONVERSATION_ARCHIVED');
    this.name = 'ConversationArchivedError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal participant + archive check.
 * Returns { recipientId } on success.
 * Throws ConversationNotFoundError | ConversationForbiddenError | ConversationArchivedError.
 */
async function assertParticipantActive(
  userId: string,
  convId: string,
): Promise<{ recipientId: string }> {
  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    select: {
      isArchived: true,
      match: { select: { userAId: true, userBId: true } },
    },
  });

  if (!conv) {
    log.warn('Conversation not found', { convId, userId });
    throw new ConversationNotFoundError();
  }

  const { userAId, userBId } = conv.match;

  if (userAId !== userId && userBId !== userId) {
    log.warn('User is not a participant', { convId, userId });
    throw new ConversationForbiddenError();
  }

  if (conv.isArchived) {
    log.warn('Conversation is archived', { convId, userId });
    throw new ConversationArchivedError();
  }

  const recipientId = userAId === userId ? userBId : userAId;
  return { recipientId };
}

/**
 * Attempt to send an FCM push notification to the recipient.
 * All errors are caught and logged — this is a best-effort side-effect.
 */
async function trySendFcmPush(params: {
  senderId:    string;
  recipientId: string;
  convId:      string;
  msgId:       string;
  type:        MessageType;
  content:     string;
}): Promise<void> {
  const { senderId, recipientId, convId, msgId, type, content } = params;

  try {
    // 1. Check presence in Realtime DB — skip push if recipient is online
    const rtdb = getRealtimeDb();
    const presenceSnap = await rtdb.ref(`presence/${recipientId}`).get();
    const isOnline = presenceSnap.exists() && presenceSnap.val()?.online === true;

    if (isOnline) {
      log.debug('Recipient online — skipping FCM push', { recipientId, convId });
      return;
    }

    // 2. Fetch sender name for notification title
    const senderProfile = await prisma.profile.findUnique({
      where:  { userId: senderId },
      select: { name: true },
    });
    const title = senderProfile?.name ?? 'New message';

    // 3. Build notification body
    let body: string;
    if (type === MessageType.IMAGE) {
      body = 'Sent you a photo';
    } else if (type === MessageType.VOICE) {
      body = 'Sent you a voice message';
    } else {
      body = content.length > 100 ? `${content.slice(0, 97)}...` : content;
    }

    // 4. Fetch push tokens for all of the recipient's devices
    const devices = await prisma.device.findMany({
      where:  { userId: recipientId, pushToken: { not: null } },
      select: { pushToken: true },
    });

    if (devices.length === 0) {
      log.debug('No push tokens for recipient', { recipientId });
      return;
    }

    // 5. Send multicast FCM push
    const fcm    = getFirebaseMessaging();
    const tokens = devices.map((d) => d.pushToken as string);

    const response = await fcm.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data:         { type: 'new_message', convId, msgId },
    });

    log.info('FCM push sent', {
      recipientId,
      tokenCount:   tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      convId,
      msgId,
    });
  } catch (err) {
    // FCM push is best-effort — never block message delivery on push failure
    log.warn('FCM push failed (non-fatal)', {
      err:    err instanceof Error ? err.message : String(err),
      convId,
      msgId,
    });
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Send a text, image, or voice message to a conversation.
 *
 * Flow:
 *  1. Verify caller is a participant and conversation is active (not archived).
 *  2. Write the message to Firestore (or MockAdapter in dev/test).
 *  3. Insert a Postgres audit row (same ID as the Firestore doc).
 *  4. If Firebase is configured, send FCM push to the recipient (best-effort).
 *
 * @throws {ConversationNotFoundError} if the conversation does not exist
 * @throws {ConversationForbiddenError} if the caller is not a participant
 * @throws {ConversationArchivedError} if the conversation is archived
 */
export async function sendMessage(
  userId:          string,
  convId:          string,
  type:            MessageType,
  content:         string,
  durationSeconds?: number,
): Promise<MessageDto> {
  const { recipientId } = await assertParticipantActive(userId, convId);

  // Build Firestore write params
  const sendParams = {
    conversationId: convId,
    senderId:       userId,
    type,
    content,
    // For IMAGE and VOICE the content field holds the S3/CloudFront URL
    ...(type !== MessageType.TEXT ? { mediaUrl: content } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  };

  // Write to real-time store (Firestore or MockAdapter)
  const dto = await getMessagingAdapter().sendMessage(sendParams);

  log.info('Message sent', { msgId: dto.id, convId, senderId: userId, type });

  // Postgres audit row — same ID as Firestore doc, content only for TEXT
  await prisma.message.create({
    data: {
      id:              dto.id,
      conversationId:  convId,
      senderId:        userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type:            type as any, // MessageType values are identical to Prisma's enum values
      content:         type === MessageType.TEXT ? content : '',
      ...(type !== MessageType.TEXT ? { mediaUrl: content }                   : {}),
      ...(durationSeconds !== undefined ? { durationSeconds }                 : {}),
    },
  });

  // Best-effort FCM push (only when Firebase creds are configured)
  if (isFirebaseConfigured()) {
    void trySendFcmPush({ senderId: userId, recipientId, convId, msgId: dto.id, type, content });
  }

  return dto;
}

/**
 * Generate a presigned S3 PUT URL so the client can upload media directly.
 *
 * The client should:
 *   1. PUT the file bytes to `uploadUrl` with the correct Content-Type header.
 *   2. Send `POST /conversations/:convId/messages` with `content = fileUrl`.
 *
 * @throws {ConversationNotFoundError} if the conversation does not exist
 * @throws {ConversationForbiddenError} if the caller is not a participant
 * @throws {ConversationArchivedError} if the conversation is archived
 */
export async function getUploadUrl(
  userId:   string,
  convId:   string,
  mimeType: string,
): Promise<{ uploadUrl: string; fileUrl: string }> {
  await assertParticipantActive(userId, convId);

  const ext = MIME_TO_EXT[mimeType];
  if (!ext) {
    // Guard: schema validation should catch this before we reach the service,
    // but defence-in-depth is free.
    throw new Error(`Unsupported mimeType: ${mimeType}`);
  }

  const key = `media/${convId}/${crypto.randomUUID()}.${ext}`;

  const result = await getStorageAdapter().getPresignedUploadUrl(
    key,
    mimeType,
    UPLOAD_URL_EXPIRY_SECONDS,
  );

  log.info('Upload URL generated', { convId, userId, key, mimeType });
  return result;
}
