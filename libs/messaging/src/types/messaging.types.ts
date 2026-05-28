// ─── Message enums ────────────────────────────────────────────────────────────

/**
 * Must stay in sync with the Prisma MessageType enum.
 * Duplicated here so libs/messaging has no Prisma dependency at runtime.
 */
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VOICE = 'VOICE',
  SYSTEM = 'SYSTEM',
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/**
 * A single message as returned by the API.
 * The `id` field is the Firestore document ID (also stored as Postgres messages.id).
 */
export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  /** Text body. Empty string for IMAGE/VOICE messages. */
  content: string;
  /** Presigned CloudFront/S3 URL for IMAGE or VOICE messages. */
  mediaUrl?: string;
  /** Duration in seconds. VOICE messages only. */
  durationSeconds?: number;
  /** Number of times this message has been flagged by users. */
  flagCount: number;
  /** Auto-hidden when flagCount reaches the threshold (default: 3). */
  isHidden: boolean;
  /** ISO 8601 timestamp when the other participant read the message. */
  readAt: string | null;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/**
 * Lightweight summary of a conversation shown in the inbox list.
 * Stored in Firestore at users/{userId}/inbox/{convId}.
 */
export interface ConversationMetaDto {
  conversationId: string;
  matchId: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageType: MessageType | null;
  unreadCount: number;
  isArchived: boolean;
}

/**
 * Other participant in a conversation as surfaced by the REST API.
 */
export interface OtherUserSummary {
  userId: string;
  /** Empty string if the other user has no profile yet. */
  name: string;
  photoUrl: string | null;
}

/**
 * Conversation metadata as returned by the REST API.
 * Constructed from Postgres (conversations + matches + profiles).
 */
export interface ConversationSummaryDto {
  conversationId: string;
  matchId: string;
  otherUser: OtherUserSummary;
  /** ISO 8601 timestamp of the most recent message. null if no messages yet. */
  lastMessageAt: string | null;
  /** Always 0 until MSG-004 (read receipts) is implemented. */
  unreadCount: number;
  isArchived: boolean;
  createdAt: string;
}

// ─── Service params ───────────────────────────────────────────────────────────

export interface SendMessageParams {
  /** Firestore + Postgres conversation ID. */
  conversationId: string;
  senderId: string;
  type: MessageType;
  /** Text body. Pass empty string for IMAGE/VOICE. */
  content: string;
  /** Required for IMAGE and VOICE types. */
  mediaUrl?: string;
  /** Required for VOICE type (seconds). */
  durationSeconds?: number;
}

export interface MarkReadParams {
  conversationId: string;
  /** The user marking the message as read (must be the receiver). */
  userId: string;
  /** Firestore message document ID. */
  messageId: string;
}

export interface FlagMessageParams {
  /** Firestore message document ID. */
  messageId: string;
  conversationId: string;
  reporterId: string;
  /** userId of the person who sent the flagged message. */
  targetUserId: string;
  reason: string; // FlagReason enum value as string
  description?: string;
}

// ─── Return types ─────────────────────────────────────────────────────────────

export interface PaginatedMessagesResult {
  messages: MessageDto[];
  /**
   * Opaque cursor: ISO timestamp of the oldest message in this page.
   * Pass as `before` on the next request to load older messages.
   */
  cursor: string | null;
  hasMore: boolean;
}
