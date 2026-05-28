import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listConversations,
  getConversation,
  getConversationMessages,
  sendMessage,
  getUploadUrl,
  markConversationRead,
  ConversationNotFoundError,
  ConversationForbiddenError,
  ConversationArchivedError,
  MessageNotFoundForReadError,
} from '@abroad-matrimony/messaging';
import type { ApiResponse } from '@abroad-matrimony/shared';
import type { ConversationSummaryDto, MessageDto, PaginatedMessagesResult } from '@abroad-matrimony/messaging';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { MESSAGING_ERRORS, MESSAGING_MESSAGES } from '../../constants/messaging.constants.js';
import type { MessagesQuery, ConvIdParams } from '../../schemas/conversations/messages.schema.js';
import type { SendMessageBody, UploadUrlQuery } from '../../schemas/conversations/send-message.schema.js';
import type { ReadReceiptBody } from '../../schemas/conversations/read-receipt.schema.js';

// ─── Helper: map domain errors → HTTP errors ─────────────────────────────────

function mapMessagingError(err: unknown, next: NextFunction): void {
  if (err instanceof ConversationNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, MESSAGING_ERRORS.CONVERSATION_NOT_FOUND));
    return;
  }
  if (err instanceof ConversationForbiddenError) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, MESSAGING_ERRORS.CONVERSATION_FORBIDDEN));
    return;
  }
  if (err instanceof ConversationArchivedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, MESSAGING_ERRORS.CONVERSATION_ARCHIVED));
    return;
  }
  if (err instanceof MessageNotFoundForReadError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, MESSAGING_ERRORS.MESSAGE_NOT_FOUND));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const conversationsController = {
  /**
   * GET /api/v1/conversations
   *
   * Returns all conversations the authenticated user participates in,
   * ordered by most-recent message first.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:conversations:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('List conversations requested', { userId });

      const conversations = await listConversations(userId);

      const body: ApiResponse<ConversationSummaryDto[]> = {
        success: true,
        data: conversations,
        meta: { hasMore: false, total: conversations.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapMessagingError(err, next);
    }
  },

  /**
   * GET /api/v1/conversations/:convId
   *
   * Returns metadata for a single conversation.
   * 403 if the authenticated user is not a participant.
   * 404 if the conversation does not exist.
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:conversations:getOne', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { convId } = req.params as unknown as ConvIdParams;

      log.info('Get conversation requested', { userId, convId });

      const conversation = await getConversation(userId, convId);

      const body: ApiResponse<ConversationSummaryDto> = {
        success: true,
        data: conversation,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapMessagingError(err, next);
    }
  },

  /**
   * GET /api/v1/conversations/:convId/messages?cursor=&limit=
   *
   * Returns a paginated list of messages for the conversation, newest-first.
   * Use `cursor` (ISO timestamp of the oldest message on the last page) to load
   * older messages. Pass `limit` (1–100, default 50).
   *
   * 403 if the authenticated user is not a participant.
   * 404 if the conversation does not exist.
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:conversations:messages', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { convId } = req.params as unknown as ConvIdParams;
      const { cursor, limit } = req.query as unknown as MessagesQuery;

      log.info('Get messages requested', { userId, convId, limit, hasCursor: !!cursor });

      const result: PaginatedMessagesResult = await getConversationMessages(userId, convId, limit, cursor);

      const body: ApiResponse<MessageDto[]> = {
        success: true,
        data: result.messages,
        meta: {
          cursor: result.cursor ?? undefined,
          hasMore: result.hasMore,
        },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapMessagingError(err, next);
    }
  },

  /**
   * POST /api/v1/conversations/:convId/messages
   *
   * Send a text, image, or voice message.
   *
   * Body: { type: 'TEXT'|'IMAGE'|'VOICE', content: string, durationSeconds?: number }
   * For TEXT: content is the message body.
   * For IMAGE / VOICE: content is the S3/CloudFront URL previously obtained
   * from the upload-url endpoint.
   *
   * 403 if caller is not a participant.
   * 404 if the conversation does not exist.
   * 409 if the conversation is archived.
   */
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:conversations:send', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { convId } = req.params as unknown as ConvIdParams;
      const { type, content, durationSeconds } = req.body as SendMessageBody;

      log.info('Send message requested', { userId, convId, type });

      const dto = await sendMessage(userId, convId, type, content, durationSeconds);

      const body: ApiResponse<MessageDto> = {
        success: true,
        data:    dto,
        meta:    { message: MESSAGING_MESSAGES.MESSAGE_SENT },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapMessagingError(err, next);
    }
  },

  /**
   * GET /api/v1/conversations/:convId/upload-url?type=image|voice&mimeType=...
   *
   * Returns a short-lived presigned S3 PUT URL so the client can upload media
   * directly. After uploading, the client sends POST /messages with the
   * returned `fileUrl` as the `content` field.
   *
   * 403 if caller is not a participant.
   * 404 if the conversation does not exist.
   * 409 if the conversation is archived.
   */
  async getUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:conversations:upload-url', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { convId } = req.params as unknown as ConvIdParams;
      const { mimeType } = req.query as unknown as UploadUrlQuery;

      log.info('Upload URL requested', { userId, convId, mimeType });

      const result = await getUploadUrl(userId, convId, mimeType);

      const body: ApiResponse<{ uploadUrl: string; fileUrl: string }> = {
        success: true,
        data:    result,
        meta:    { message: MESSAGING_MESSAGES.UPLOAD_URL_GENERATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapMessagingError(err, next);
    }
  },

  /**
   * POST /api/v1/conversations/:convId/read
   *
   * Marks all messages up to and including `lastReadMessageId` as read.
   * Used as a REST fallback when Firestore direct writes are not available.
   *
   * 403 if caller is not a participant.
   * 404 if the conversation or message does not exist.
   */
  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:conversations:read', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { convId } = req.params as unknown as ConvIdParams;
      const { lastReadMessageId } = req.body as ReadReceiptBody;

      log.info('Mark read requested', { userId, convId, lastReadMessageId });

      await markConversationRead(userId, convId, lastReadMessageId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: MESSAGING_MESSAGES.READ_RECEIPT_RECORDED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapMessagingError(err, next);
    }
  },
};
