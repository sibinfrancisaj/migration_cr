import type {
  MessageDto,
  SendMessageParams,
  MarkReadParams,
  PaginatedMessagesResult,
} from '../types/messaging.types.js';

/**
 * Cloud-agnostic interface for the messaging data layer.
 *
 * Production implementation: FirestoreMessagingAdapter (Firebase Admin SDK).
 * Test / offline implementation: MockMessagingAdapter (in-memory).
 *
 * Services must depend only on this interface, never on a concrete adapter.
 */
export interface MessagingAdapter {
  /**
   * Persist a new message to the real-time store.
   * Also updates the conversation's `lastMessageAt` timestamp.
   */
  sendMessage(params: SendMessageParams): Promise<MessageDto>;

  /**
   * Fetch a page of messages for a conversation, newest-first.
   *
   * @param conversationId  Target conversation.
   * @param limit           Maximum number of messages to return.
   * @param beforeCursor    ISO timestamp — return only messages older than this.
   *                        Omit for the first page.
   */
  getMessages(
    conversationId: string,
    limit: number,
    beforeCursor?: string,
  ): Promise<PaginatedMessagesResult>;

  /**
   * Mark a specific message as read.
   * Only the receiver should call this; the service layer enforces that.
   */
  markRead(params: MarkReadParams): Promise<void>;

  /**
   * Atomically increment the flag count on a message.
   * If the count reaches `threshold`, the message is auto-hidden (`isHidden = true`).
   *
   * @returns The updated flagCount.
   */
  incrementFlagCount(
    conversationId: string,
    messageId: string,
    threshold: number,
  ): Promise<number>;

  /**
   * Explicitly hide a message (admin moderation — MESSAGE_REMOVED action).
   * Unlike auto-hide via flagCount threshold, this sets isHidden regardless of count.
   */
  hideMessage(conversationId: string, messageId: string): Promise<void>;

  /**
   * Unhide a message (admin action — e.g., flag dismissed as invalid).
   */
  unhideMessage(conversationId: string, messageId: string): Promise<void>;

  /**
   * Hard-delete a message from the real-time store.
   * Used for admin removals and future "unsend" (F-036).
   */
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
}
