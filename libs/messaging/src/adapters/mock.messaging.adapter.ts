import type { MessagingAdapter } from './base.messaging.adapter.js';
import type {
  MessageDto,
  PaginatedMessagesResult,
  MarkReadParams,
  SendMessageParams,
} from '../types/messaging.types.js';

/**
 * In-memory MessagingAdapter for unit tests and local development.
 *
 * Never hits Firebase — no credentials required.
 * All state lives in `_messages`; call `_reset()` in beforeEach.
 */
export class MockMessagingAdapter implements MessagingAdapter {
  // Exposed for test assertions
  _messages: MessageDto[] = [];

  async sendMessage(params: SendMessageParams): Promise<MessageDto> {
    const msg: MessageDto = {
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      senderId: params.senderId,
      type: params.type,
      content: params.content,
      ...(params.mediaUrl !== undefined && { mediaUrl: params.mediaUrl }),
      ...(params.durationSeconds !== undefined && { durationSeconds: params.durationSeconds }),
      flagCount: 0,
      isHidden: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    this._messages.push(msg);
    return msg;
  }

  async getMessages(
    conversationId: string,
    limit: number,
    beforeCursor?: string,
  ): Promise<PaginatedMessagesResult> {
    let msgs = this._messages.filter((m) => m.conversationId === conversationId);
    if (beforeCursor) {
      msgs = msgs.filter((m) => m.createdAt < beforeCursor);
    }
    // newest-first (mirrors Firestore orderBy createdAt desc)
    const sorted = [...msgs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const hasMore = sorted.length > limit;
    const page = sorted.slice(0, limit);
    return {
      messages: page,
      cursor: page.length > 0 ? page[page.length - 1].createdAt : null,
      hasMore,
    };
  }

  async markRead(params: MarkReadParams): Promise<void> {
    const msg = this._messages.find(
      (m) => m.id === params.messageId && m.conversationId === params.conversationId,
    );
    if (msg) {
      msg.readAt = new Date().toISOString();
    }
  }

  async incrementFlagCount(
    conversationId: string,
    messageId: string,
    threshold: number,
  ): Promise<number> {
    const msg = this._messages.find(
      (m) => m.id === messageId && m.conversationId === conversationId,
    );
    if (!msg) return 0;
    msg.flagCount += 1;
    if (msg.flagCount >= threshold) {
      msg.isHidden = true;
    }
    return msg.flagCount;
  }

  async hideMessage(conversationId: string, messageId: string): Promise<void> {
    const msg = this._messages.find(
      (m) => m.id === messageId && m.conversationId === conversationId,
    );
    if (msg) {
      msg.isHidden = true;
    }
  }

  async unhideMessage(conversationId: string, messageId: string): Promise<void> {
    const msg = this._messages.find(
      (m) => m.id === messageId && m.conversationId === conversationId,
    );
    if (msg) {
      msg.isHidden = false;
    }
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    this._messages = this._messages.filter(
      (m) => !(m.id === messageId && m.conversationId === conversationId),
    );
  }

  /** Reset all state. Call in beforeEach to isolate tests. */
  _reset(): void {
    this._messages = [];
  }
}
