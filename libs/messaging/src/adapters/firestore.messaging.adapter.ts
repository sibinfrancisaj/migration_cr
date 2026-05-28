import type { Firestore } from 'firebase-admin/firestore';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { MessagingAdapter } from './base.messaging.adapter.js';
import type {
  MessageDto,
  SendMessageParams,
  MarkReadParams,
  PaginatedMessagesResult,
} from '../types/messaging.types.js';

const log = createChildLogger({ module: 'messaging:firestore' });

// ─── Firestore collection paths ───────────────────────────────────────────────
// conversations/{convId}/messages/{msgId}
// conversations/{convId}  (root doc: lastMessageAt)
const CONVERSATIONS = 'conversations';
const MESSAGES = 'messages';

/**
 * Production MessagingAdapter backed by Firebase Firestore.
 *
 * Firestore schema:
 *   conversations/{convId}
 *     lastMessageAt: string (ISO)
 *
 *   conversations/{convId}/messages/{msgId}
 *     id, conversationId, senderId, type, content,
 *     mediaUrl?, durationSeconds?, flagCount, isHidden, readAt, createdAt
 */
export class FirestoreMessagingAdapter implements MessagingAdapter {
  constructor(private readonly db: Firestore) {}

  // ─── sendMessage ─────────────────────────────────────────────────────────

  async sendMessage(params: SendMessageParams): Promise<MessageDto> {
    const convRef = this.db.collection(CONVERSATIONS).doc(params.conversationId);
    const msgRef = convRef.collection(MESSAGES).doc();

    const now = new Date().toISOString();

    const msgData: MessageDto = {
      id: msgRef.id,
      conversationId: params.conversationId,
      senderId: params.senderId,
      type: params.type,
      content: params.content,
      flagCount: 0,
      isHidden: false,
      readAt: null,
      createdAt: now,
    };

    if (params.mediaUrl !== undefined) {
      msgData.mediaUrl = params.mediaUrl;
    }
    if (params.durationSeconds !== undefined) {
      msgData.durationSeconds = params.durationSeconds;
    }

    // Batch: write message + update conversation lastMessageAt atomically
    const batch = this.db.batch();
    batch.set(msgRef, msgData);
    batch.set(convRef, { lastMessageAt: now }, { merge: true });
    await batch.commit();

    log.debug('Message written to Firestore', {
      msgId: msgRef.id,
      conversationId: params.conversationId,
      type: params.type,
    });

    return msgData;
  }

  // ─── getMessages ──────────────────────────────────────────────────────────

  async getMessages(
    conversationId: string,
    limit: number,
    beforeCursor?: string,
  ): Promise<PaginatedMessagesResult> {
    let query = this.db
      .collection(CONVERSATIONS)
      .doc(conversationId)
      .collection(MESSAGES)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1); // +1 to detect hasMore

    if (beforeCursor) {
      query = query.where('createdAt', '<', beforeCursor) as typeof query;
    }

    const snapshot = await query.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;

    const messages: MessageDto[] = page.map((doc) => doc.data() as MessageDto);

    return {
      messages,
      cursor: page.length > 0 ? (page[page.length - 1].data().createdAt as string) : null,
      hasMore,
    };
  }

  // ─── markRead ─────────────────────────────────────────────────────────────

  async markRead(params: MarkReadParams): Promise<void> {
    const msgRef = this.db
      .collection(CONVERSATIONS)
      .doc(params.conversationId)
      .collection(MESSAGES)
      .doc(params.messageId);

    await msgRef.update({ readAt: new Date().toISOString() });

    log.debug('Message marked read', {
      messageId: params.messageId,
      userId: params.userId,
    });
  }

  // ─── incrementFlagCount ───────────────────────────────────────────────────

  async incrementFlagCount(
    conversationId: string,
    messageId: string,
    threshold: number,
  ): Promise<number> {
    const msgRef = this.db
      .collection(CONVERSATIONS)
      .doc(conversationId)
      .collection(MESSAGES)
      .doc(messageId);

    // Atomic transaction: read current count → increment → conditionally hide
    const newCount = await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(msgRef);
      if (!snap.exists) {
        throw new Error(`Message ${messageId} not found in Firestore`);
      }
      const current = (snap.data()?.['flagCount'] as number | undefined) ?? 0;
      const updated = current + 1;

      const update: Record<string, unknown> = { flagCount: updated };
      if (updated >= threshold) {
        update['isHidden'] = true;
      }

      tx.update(msgRef, update);
      return updated;
    });

    log.info('Message flagCount incremented', {
      messageId,
      conversationId,
      newCount,
      threshold,
      autoHidden: newCount >= threshold,
    });

    return newCount;
  }

  // ─── hideMessage ──────────────────────────────────────────────────────────

  async hideMessage(conversationId: string, messageId: string): Promise<void> {
    await this.db
      .collection(CONVERSATIONS)
      .doc(conversationId)
      .collection(MESSAGES)
      .doc(messageId)
      .update({ isHidden: true });

    log.info('Message hidden by admin', { messageId, conversationId });
  }

  // ─── unhideMessage ────────────────────────────────────────────────────────

  async unhideMessage(conversationId: string, messageId: string): Promise<void> {
    await this.db
      .collection(CONVERSATIONS)
      .doc(conversationId)
      .collection(MESSAGES)
      .doc(messageId)
      .update({ isHidden: false });

    log.info('Message unhidden by admin', { messageId, conversationId });
  }

  // ─── deleteMessage ────────────────────────────────────────────────────────

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    await this.db
      .collection(CONVERSATIONS)
      .doc(conversationId)
      .collection(MESSAGES)
      .doc(messageId)
      .delete();

    log.info('Message deleted from Firestore', { messageId, conversationId });
  }
}
