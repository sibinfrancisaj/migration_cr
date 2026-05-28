import {
  sendMessage,
  getUploadUrl,
  ConversationArchivedError,
} from '../send-message.service.js';
import {
  ConversationNotFoundError,
  ConversationForbiddenError,
} from '../conversation.service.js';
import { MockMessagingAdapter } from '../adapters/mock.messaging.adapter.js';
import { MessageType } from '../types/messaging.types.js';

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockConvFindUnique = jest.fn();
const mockMessageCreate  = jest.fn();
const mockProfileFindUnique = jest.fn();
const mockDeviceFindMany    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    conversation: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: (...a: any[]) => mockConvFindUnique(...a),
    },
    message: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: (...a: any[]) => mockMessageCreate(...a),
    },
    profile: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: (...a: any[]) => mockProfileFindUnique(...a),
    },
    device: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: (...a: any[]) => mockDeviceFindMany(...a),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ─── Messaging adapter mock ───────────────────────────────────────────────────

const mockAdapter = new MockMessagingAdapter();

jest.mock('../adapters/index.js', () => ({
  getMessagingAdapter: () => mockAdapter,
}));

// ─── Storage adapter mock ─────────────────────────────────────────────────────

const mockGetPresignedUploadUrl = jest.fn().mockResolvedValue({
  uploadUrl: 'https://mock-s3.example.com/upload/key?presigned=1',
  fileUrl:   'https://mock-cdn.example.com/key',
});

jest.mock('@abroad-matrimony/storage', () => ({
  getStorageAdapter: () => ({
    upload:                mockGetPresignedUploadUrl, // won't be called in these tests
    delete:                jest.fn(),
    getPresignedUploadUrl: mockGetPresignedUploadUrl,
  }),
}));

// ─── Firebase mock ────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/firebase', () => ({
  isFirebaseConfigured: jest.fn().mockReturnValue(false),
  getRealtimeDb:        jest.fn(),
  getFirebaseMessaging: jest.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_A  = 'user-a-id';
const USER_B  = 'user-b-id';
const CONV_ID = 'conv-uuid-001';

function makeConvRow(overrides: Partial<{ isArchived: boolean; userAId: string; userBId: string }> = {}) {
  return {
    isArchived: overrides.isArchived ?? false,
    match: {
      userAId: overrides.userAId ?? USER_A,
      userBId: overrides.userBId ?? USER_B,
    },
  };
}

// ─── Tests: sendMessage ───────────────────────────────────────────────────────

describe('sendMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter._reset();
    mockConvFindUnique.mockResolvedValue(makeConvRow());
    mockMessageCreate.mockResolvedValue({});
  });

  it('sends a TEXT message and returns MessageDto', async () => {
    const dto = await sendMessage(USER_A, CONV_ID, MessageType.TEXT, 'Hello!');

    expect(dto.content).toBe('Hello!');
    expect(dto.type).toBe(MessageType.TEXT);
    expect(dto.senderId).toBe(USER_A);
    expect(dto.conversationId).toBe(CONV_ID);
    expect(dto.flagCount).toBe(0);
    expect(dto.isHidden).toBe(false);
    expect(dto.id).toBeDefined();
  });

  it('writes a Postgres audit row with the same ID as the Firestore doc', async () => {
    const dto = await sendMessage(USER_A, CONV_ID, MessageType.TEXT, 'Hello!');

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id:             dto.id,
          conversationId: CONV_ID,
          senderId:       USER_A,
          content:        'Hello!',
        }),
      }),
    );
  });

  it('stores empty content in Postgres for IMAGE messages (URL goes in mediaUrl)', async () => {
    const imageUrl = 'https://cdn.example.com/img.jpg';
    await sendMessage(USER_A, CONV_ID, MessageType.IMAGE, imageUrl);

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content:  '',
          mediaUrl: imageUrl,
        }),
      }),
    );
  });

  it('stores empty content in Postgres for VOICE messages, includes durationSeconds', async () => {
    const voiceUrl = 'https://cdn.example.com/voice.m4a';
    await sendMessage(USER_A, CONV_ID, MessageType.VOICE, voiceUrl, 42);

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content:         '',
          mediaUrl:        voiceUrl,
          durationSeconds: 42,
        }),
      }),
    );
  });

  it('throws ConversationNotFoundError when conversation does not exist', async () => {
    mockConvFindUnique.mockResolvedValue(null);

    await expect(sendMessage(USER_A, CONV_ID, MessageType.TEXT, 'Hi')).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it('throws ConversationForbiddenError when caller is not a participant', async () => {
    await expect(sendMessage('stranger-id', CONV_ID, MessageType.TEXT, 'Hi')).rejects.toBeInstanceOf(ConversationForbiddenError);
  });

  it('throws ConversationArchivedError when conversation is archived', async () => {
    mockConvFindUnique.mockResolvedValue(makeConvRow({ isArchived: true }));

    await expect(sendMessage(USER_A, CONV_ID, MessageType.TEXT, 'Hi')).rejects.toBeInstanceOf(ConversationArchivedError);
  });

  it('allows userB to send a message', async () => {
    const dto = await sendMessage(USER_B, CONV_ID, MessageType.TEXT, 'Hello back!');

    expect(dto.senderId).toBe(USER_B);
  });

  it('does not call prisma.message.create when Firestore write fails', async () => {
    // Force adapter to throw
    jest.spyOn(mockAdapter, 'sendMessage').mockRejectedValueOnce(new Error('Firestore down'));

    await expect(sendMessage(USER_A, CONV_ID, MessageType.TEXT, 'Hi')).rejects.toThrow('Firestore down');

    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it('does not attempt FCM when Firebase is not configured', async () => {
    const { isFirebaseConfigured } = jest.requireMock('@abroad-matrimony/firebase');
    (isFirebaseConfigured as jest.Mock).mockReturnValue(false);

    await sendMessage(USER_A, CONV_ID, MessageType.TEXT, 'Hi');

    const { getFirebaseMessaging } = jest.requireMock('@abroad-matrimony/firebase');
    expect(getFirebaseMessaging).not.toHaveBeenCalled();
  });
});

// ─── Tests: getUploadUrl ──────────────────────────────────────────────────────

describe('getUploadUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConvFindUnique.mockResolvedValue(makeConvRow());
    mockGetPresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://mock-s3.example.com/upload/key?presigned=1',
      fileUrl:   'https://mock-cdn.example.com/media/key.jpg',
    });
  });

  it('returns uploadUrl and fileUrl for an image upload', async () => {
    const result = await getUploadUrl(USER_A, CONV_ID, 'image/jpeg');

    expect(result.uploadUrl).toContain('mock-s3');
    expect(result.fileUrl).toContain('mock-cdn');
  });

  it('calls getPresignedUploadUrl with a key under media/<convId>/', async () => {
    await getUploadUrl(USER_A, CONV_ID, 'image/jpeg');

    const [keyArg, mimeArg, expiryArg] = mockGetPresignedUploadUrl.mock.calls[0];
    expect(keyArg).toMatch(new RegExp(`^media/${CONV_ID}/[\\w-]+\\.jpg$`));
    expect(mimeArg).toBe('image/jpeg');
    expect(expiryArg).toBe(900); // 15 minutes
  });

  it('uses the correct extension for audio/m4a', async () => {
    await getUploadUrl(USER_A, CONV_ID, 'audio/m4a');

    const [keyArg] = mockGetPresignedUploadUrl.mock.calls[0];
    expect(keyArg).toMatch(/\.m4a$/);
  });

  it('uses the correct extension for image/webp', async () => {
    await getUploadUrl(USER_A, CONV_ID, 'image/webp');

    const [keyArg] = mockGetPresignedUploadUrl.mock.calls[0];
    expect(keyArg).toMatch(/\.webp$/);
  });

  it('throws ConversationNotFoundError when conversation does not exist', async () => {
    mockConvFindUnique.mockResolvedValue(null);

    await expect(getUploadUrl(USER_A, CONV_ID, 'image/jpeg')).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it('throws ConversationForbiddenError when caller is not a participant', async () => {
    await expect(getUploadUrl('stranger-id', CONV_ID, 'image/jpeg')).rejects.toBeInstanceOf(ConversationForbiddenError);
  });

  it('throws ConversationArchivedError when conversation is archived', async () => {
    mockConvFindUnique.mockResolvedValue(makeConvRow({ isArchived: true }));

    await expect(getUploadUrl(USER_A, CONV_ID, 'image/jpeg')).rejects.toBeInstanceOf(ConversationArchivedError);
  });
});
