import { MockMessagingAdapter } from '../adapters/mock.messaging.adapter.js';
import { MessageType } from '../types/messaging.types.js';

describe('MockMessagingAdapter', () => {
  let adapter: MockMessagingAdapter;

  const CONV = 'conv-001';
  const USER_A = 'user-a';
  const USER_B = 'user-b';

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
  });

  // ─── sendMessage ──────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('returns a MessageDto with correct fields', async () => {
      const result = await adapter.sendMessage({
        conversationId: CONV,
        senderId: USER_A,
        type: MessageType.TEXT,
        content: 'Hello!',
      });

      expect(result.id).toBeDefined();
      expect(result.conversationId).toBe(CONV);
      expect(result.senderId).toBe(USER_A);
      expect(result.type).toBe(MessageType.TEXT);
      expect(result.content).toBe('Hello!');
      expect(result.flagCount).toBe(0);
      expect(result.isHidden).toBe(false);
      expect(result.readAt).toBeNull();
      expect(result.createdAt).toBeDefined();
    });

    it('stores mediaUrl for IMAGE messages', async () => {
      const result = await adapter.sendMessage({
        conversationId: CONV,
        senderId: USER_A,
        type: MessageType.IMAGE,
        content: '',
        mediaUrl: 'https://cdn.example.com/img.jpg',
      });

      expect(result.mediaUrl).toBe('https://cdn.example.com/img.jpg');
    });

    it('stores durationSeconds for VOICE messages', async () => {
      const result = await adapter.sendMessage({
        conversationId: CONV,
        senderId: USER_A,
        type: MessageType.VOICE,
        content: '',
        mediaUrl: 'https://cdn.example.com/voice.m4a',
        durationSeconds: 42,
      });

      expect(result.durationSeconds).toBe(42);
    });

    it('assigns unique IDs to each message', async () => {
      const m1 = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'a' });
      const m2 = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'b' });
      expect(m1.id).not.toBe(m2.id);
    });
  });

  // ─── getMessages ──────────────────────────────────────────────────────────

  describe('getMessages', () => {
    beforeEach(async () => {
      // Insert 5 messages with distinct timestamps
      for (let i = 0; i < 5; i++) {
        await adapter.sendMessage({
          conversationId: CONV,
          senderId: USER_A,
          type: MessageType.TEXT,
          content: `msg-${i}`,
        });
        // tiny delay so createdAt differs
        await new Promise((r) => setTimeout(r, 2));
      }
    });

    it('returns newest-first order', async () => {
      const result = await adapter.getMessages(CONV, 10);
      const timestamps = result.messages.map((m) => m.createdAt);
      const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
      expect(timestamps).toEqual(sorted);
    });

    it('respects the limit', async () => {
      const result = await adapter.getMessages(CONV, 3);
      expect(result.messages).toHaveLength(3);
      expect(result.hasMore).toBe(true);
    });

    it('hasMore is false when all messages fit in limit', async () => {
      const result = await adapter.getMessages(CONV, 10);
      expect(result.hasMore).toBe(false);
    });

    it('filters by beforeCursor', async () => {
      const first = await adapter.getMessages(CONV, 2);
      const cursor = first.cursor!;
      const second = await adapter.getMessages(CONV, 10, cursor);
      // all second-page messages must be older than cursor
      for (const m of second.messages) {
        expect(m.createdAt < cursor).toBe(true);
      }
    });

    it('returns empty result for unknown conversation', async () => {
      const result = await adapter.getMessages('unknown-conv', 10);
      expect(result.messages).toHaveLength(0);
      expect(result.cursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });

  // ─── markRead ─────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('sets readAt on the target message', async () => {
      const msg = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'hi' });
      await adapter.markRead({ conversationId: CONV, userId: USER_B, messageId: msg.id });
      const updated = adapter._messages.find((m) => m.id === msg.id);
      expect(updated?.readAt).not.toBeNull();
    });

    it('does not throw for unknown messageId', async () => {
      await expect(
        adapter.markRead({ conversationId: CONV, userId: USER_B, messageId: 'ghost' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── incrementFlagCount ───────────────────────────────────────────────────

  describe('incrementFlagCount', () => {
    it('increments flagCount and returns updated value', async () => {
      const msg = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'bad' });
      const count = await adapter.incrementFlagCount(CONV, msg.id, 5);
      expect(count).toBe(1);
    });

    it('auto-hides message when flagCount reaches threshold', async () => {
      const msg = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'bad' });
      await adapter.incrementFlagCount(CONV, msg.id, 3);
      await adapter.incrementFlagCount(CONV, msg.id, 3);
      const count = await adapter.incrementFlagCount(CONV, msg.id, 3); // 3rd flag — triggers hide
      expect(count).toBe(3);
      const stored = adapter._messages.find((m) => m.id === msg.id);
      expect(stored?.isHidden).toBe(true);
    });

    it('returns 0 for unknown messageId', async () => {
      const count = await adapter.incrementFlagCount(CONV, 'ghost', 3);
      expect(count).toBe(0);
    });
  });

  // ─── unhideMessage ────────────────────────────────────────────────────────

  describe('unhideMessage', () => {
    it('sets isHidden to false', async () => {
      const msg = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'bad' });
      await adapter.incrementFlagCount(CONV, msg.id, 1); // immediately hidden
      await adapter.unhideMessage(CONV, msg.id);
      const stored = adapter._messages.find((m) => m.id === msg.id);
      expect(stored?.isHidden).toBe(false);
    });
  });

  // ─── deleteMessage ────────────────────────────────────────────────────────

  describe('deleteMessage', () => {
    it('removes the message from the store', async () => {
      const msg = await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'delete me' });
      await adapter.deleteMessage(CONV, msg.id);
      const found = adapter._messages.find((m) => m.id === msg.id);
      expect(found).toBeUndefined();
    });

    it('does not throw for unknown messageId', async () => {
      await expect(adapter.deleteMessage(CONV, 'ghost')).resolves.toBeUndefined();
    });
  });

  // ─── _reset ───────────────────────────────────────────────────────────────

  describe('_reset', () => {
    it('clears all stored messages', async () => {
      await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'a' });
      await adapter.sendMessage({ conversationId: CONV, senderId: USER_A, type: MessageType.TEXT, content: 'b' });
      adapter._reset();
      expect(adapter._messages).toHaveLength(0);
    });
  });
});
