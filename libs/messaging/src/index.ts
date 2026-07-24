// Types & DTOs
export type {
  MessageDto,
  ConversationMetaDto,
  OtherUserSummary,
  ConversationSummaryDto,
  SendMessageParams,
  MarkReadParams,
  FlagMessageParams,
  PaginatedMessagesResult,
} from './types/messaging.types.js';
export { MessageType } from './types/messaging.types.js';

// Adapter interface + factory
export type { MessagingAdapter } from './adapters/base.messaging.adapter.js';
export { FirestoreMessagingAdapter } from './adapters/firestore.messaging.adapter.js';
export { MockMessagingAdapter } from './adapters/mock.messaging.adapter.js';
export { getMessagingAdapter, resetMessagingAdapter } from './adapters/index.js';

// Conversation service
export {
  listConversations,
  getConversation,
  getConversationMessages,
  ConversationNotFoundError,
  ConversationForbiddenError,
  CONVERSATION_MESSAGES_DEFAULT_LIMIT,
} from './conversation.service.js';

// Send-message service
export {
  sendMessage,
  getUploadUrl,
  ConversationArchivedError,
} from './send-message.service.js';

// Firebase token service (MSG-003)
export {
  createFirebaseToken,
  FirebaseNotConfiguredError,
} from './firebase-token.service.js';

// Read-receipt service (MSG-004)
export {
  markConversationRead,
  MessageNotFoundForReadError,
} from './read-receipt.service.js';

// Flag message service (MSG-005)
export {
  flagMessage,
  getAdminFlagSummary,
  listAllFlags,
  resolveFlag,
  MessageNotFoundError,
  AlreadyFlaggedError,
  FlagSelfError,
  FlagNotFoundError,
  FLAG_AUTO_HIDE_THRESHOLD,
} from './flag-message.service.js';
export type { FlagDto, ResolveFlagParams } from './flag-message.service.js';
