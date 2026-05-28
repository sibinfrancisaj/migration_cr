import { markConversationRead, MessageNotFoundForReadError } from '../read-receipt.service.js';
import {
  ConversationNotFoundError,
  ConversationForbiddenError,
} from '../conversation.service.js';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockConversationFindUnique = jest.fn();
const mockMessageFindFirst       = jest.fn();
const mockMessageUpdateMany      = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    conversation: { findUnique: (...a: unknown[]) => mockConversationFindUnique(...a) },
    message:      {
      findFirst:   (...a: unknown[]) => mockMessageFindFirst(...a),
      updateMany:  (...a: unknown[]) => mockMessageUpdateMany(...a),
    },
  },
}));

// ─── Mock MessagingAdapter ─────────────────────────────────────────────────────

const mockMarkRead = jest.fn();

jest.mock('../adapters/index.js', () => ({
  getMessagingAdapter: () => ({ markRead: mockMarkRead }),
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONV_ID  = 'conv-uuid-001';
const MSG_ID   = 'msg-uuid-001';
const USER_A   = 'user-a-id';
const USER_B   = 'user-b-id';
const STRANGER = 'stranger-id';

const CONV_ROW = {
  id: CONV_ID,
  match: { userAId: USER_A, userBId: USER_B },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('markConversationRead()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConversationFindUnique.mockResolvedValue(CONV_ROW);
    mockMessageFindFirst.mockResolvedValue({ id: MSG_ID });
    mockMarkRead.mockResolvedValue(undefined);
    mockMessageUpdateMany.mockResolvedValue({ count: 1 });
  });

  describe('happy path', () => {
    it('calls markRead on adapter and mirrors to Postgres', async () => {
      await markConversationRead(USER_A, CONV_ID, MSG_ID);

      expect(mockMarkRead).toHaveBeenCalledWith({
        conversationId: CONV_ID,
        messageId: MSG_ID,
        userId: USER_A,
      });
      expect(mockMessageUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: MSG_ID, conversationId: CONV_ID }),
          data: expect.objectContaining({ readAt: expect.any(Date) }),
        }),
      );
    });

    it('works when called as userB', async () => {
      await markConversationRead(USER_B, CONV_ID, MSG_ID);
      expect(mockMarkRead).toHaveBeenCalled();
    });
  });

  describe('authorization', () => {
    it('throws ConversationNotFoundError when conversation does not exist', async () => {
      mockConversationFindUnique.mockResolvedValue(null);

      await expect(markConversationRead(USER_A, CONV_ID, MSG_ID)).rejects.toBeInstanceOf(
        ConversationNotFoundError,
      );
      expect(mockMarkRead).not.toHaveBeenCalled();
    });

    it('throws ConversationForbiddenError when user is not a participant', async () => {
      await expect(markConversationRead(STRANGER, CONV_ID, MSG_ID)).rejects.toBeInstanceOf(
        ConversationForbiddenError,
      );
      expect(mockMarkRead).not.toHaveBeenCalled();
    });
  });

  describe('message validation', () => {
    it('throws MessageNotFoundForReadError when message does not exist in this conversation', async () => {
      mockMessageFindFirst.mockResolvedValue(null);

      await expect(markConversationRead(USER_A, CONV_ID, MSG_ID)).rejects.toBeInstanceOf(
        MessageNotFoundForReadError,
      );
      expect(mockMarkRead).not.toHaveBeenCalled();
    });
  });

  describe('MessageNotFoundForReadError', () => {
    it('has the correct name property', () => {
      const err = new MessageNotFoundForReadError();
      expect(err.name).toBe('MessageNotFoundForReadError');
      expect(err instanceof Error).toBe(true);
    });
  });
});
