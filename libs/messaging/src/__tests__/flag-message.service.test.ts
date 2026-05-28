import {
  flagMessage,
  getAdminFlagSummary,
  resolveFlag,
  MessageNotFoundError,
  AlreadyFlaggedError,
  FlagSelfError,
  FlagNotFoundError,
  FLAG_AUTO_HIDE_THRESHOLD,
} from '../flag-message.service.js';
import { FlagReason, FlagAction } from '@abroad-matrimony/shared';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockMessageFindUnique = jest.fn();
const mockFlagFindFirst     = jest.fn();
const mockFlagFindUnique    = jest.fn();
const mockFlagCreate        = jest.fn();
const mockFlagFindMany      = jest.fn();
const mockFlagCount         = jest.fn();
const mockFlagUpdate        = jest.fn();
const mockMessageUpdate     = jest.fn();
const mockTransaction       = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    message: {
      findUnique: (...a: unknown[]) => mockMessageFindUnique(...a),
      update:     (...a: unknown[]) => mockMessageUpdate(...a),
    },
    flag: {
      findFirst:  (...a: unknown[]) => mockFlagFindFirst(...a),
      findUnique: (...a: unknown[]) => mockFlagFindUnique(...a),
      create:     (...a: unknown[]) => mockFlagCreate(...a),
      findMany:   (...a: unknown[]) => mockFlagFindMany(...a),
      count:      (...a: unknown[]) => mockFlagCount(...a),
      update:     (...a: unknown[]) => mockFlagUpdate(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

// ─── Mock MessagingAdapter ─────────────────────────────────────────────────────

const mockIncrementFlagCount = jest.fn();
const mockHideMessage        = jest.fn();
const mockUnhideMessage      = jest.fn();

jest.mock('../adapters/index.js', () => ({
  getMessagingAdapter: () => ({
    incrementFlagCount: mockIncrementFlagCount,
    hideMessage:        mockHideMessage,
    unhideMessage:      mockUnhideMessage,
  }),
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

const MSG_ID       = 'msg-uuid-001';
const CONV_ID      = 'conv-uuid-001';
const REPORTER_ID  = 'user-reporter';
const SENDER_ID    = 'user-sender';
const MOD_ID       = 'admin-mod-1';

const MESSAGE_ROW = {
  id: MSG_ID,
  conversationId: CONV_ID,
  senderId: SENDER_ID,
};

const FLAG_ROW = {
  id: 'flag-uuid-1',
  reporterId: REPORTER_ID,
  targetUserId: SENDER_ID,
  targetEntityType: 'message',
  targetEntityId: MSG_ID,
  reason: FlagReason.SPAM,
  description: null,
  status: 'OPEN',
  actionTaken: null,
  resolution: null,
  resolvedAt: null,
  createdAt: new Date('2026-05-28T00:00:00.000Z'),
};

// ─── flagMessage() tests ──────────────────────────────────────────────────────

describe('flagMessage()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageFindUnique.mockResolvedValue(MESSAGE_ROW);
    mockFlagFindFirst.mockResolvedValue(null); // no existing flag
    mockFlagCreate.mockResolvedValue(FLAG_ROW);
    mockIncrementFlagCount.mockResolvedValue(1);
    mockMessageUpdate.mockResolvedValue({});
  });

  describe('happy path', () => {
    it('creates a flag and increments Firestore flagCount', async () => {
      const result = await flagMessage(REPORTER_ID, MSG_ID, FlagReason.SPAM);

      expect(mockFlagCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reporterId: REPORTER_ID,
            targetUserId: SENDER_ID,
            targetEntityType: 'message',
            targetEntityId: MSG_ID,
          }),
        }),
      );
      expect(mockIncrementFlagCount).toHaveBeenCalledWith(
        CONV_ID,
        MSG_ID,
        FLAG_AUTO_HIDE_THRESHOLD,
      );
      expect(result.id).toBe('flag-uuid-1');
    });

    it('mirrors isHidden=true to Postgres when threshold is reached', async () => {
      mockIncrementFlagCount.mockResolvedValue(FLAG_AUTO_HIDE_THRESHOLD);

      await flagMessage(REPORTER_ID, MSG_ID, FlagReason.SPAM);

      expect(mockMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MSG_ID },
          data: expect.objectContaining({ isHidden: true }),
        }),
      );
    });

    it('does not set isHidden when below threshold', async () => {
      mockIncrementFlagCount.mockResolvedValue(1);

      await flagMessage(REPORTER_ID, MSG_ID, FlagReason.SPAM);

      expect(mockMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ isHidden: true }),
        }),
      );
    });

    it('stores optional description', async () => {
      await flagMessage(REPORTER_ID, MSG_ID, FlagReason.HARASSMENT, 'Offensive language');

      expect(mockFlagCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'Offensive language' }),
        }),
      );
    });

    it('continues even if Firestore incrementFlagCount fails', async () => {
      mockIncrementFlagCount.mockRejectedValue(new Error('Firestore unreachable'));

      // Should not throw
      await expect(flagMessage(REPORTER_ID, MSG_ID, FlagReason.SPAM)).resolves.toBeDefined();
    });
  });

  describe('validation errors', () => {
    it('throws MessageNotFoundError when message does not exist', async () => {
      mockMessageFindUnique.mockResolvedValue(null);

      await expect(flagMessage(REPORTER_ID, MSG_ID, FlagReason.SPAM)).rejects.toBeInstanceOf(
        MessageNotFoundError,
      );
      expect(mockFlagCreate).not.toHaveBeenCalled();
    });

    it('throws FlagSelfError when reporter is the message sender', async () => {
      await expect(flagMessage(SENDER_ID, MSG_ID, FlagReason.SPAM)).rejects.toBeInstanceOf(
        FlagSelfError,
      );
      expect(mockFlagCreate).not.toHaveBeenCalled();
    });

    it('throws AlreadyFlaggedError when reporter already flagged this message', async () => {
      mockFlagFindFirst.mockResolvedValue({ id: 'existing-flag' });

      await expect(flagMessage(REPORTER_ID, MSG_ID, FlagReason.SPAM)).rejects.toBeInstanceOf(
        AlreadyFlaggedError,
      );
      expect(mockFlagCreate).not.toHaveBeenCalled();
    });
  });
});

// ─── getAdminFlagSummary() tests ──────────────────────────────────────────────

describe('getAdminFlagSummary()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (queries: unknown[]) =>
      Promise.all(queries.map((q) => (typeof q === 'function' ? q() : q))),
    );
  });

  it('returns paginated flags and total', async () => {
    mockFlagFindMany.mockResolvedValue([FLAG_ROW]);
    mockFlagCount.mockResolvedValue(1);
    mockTransaction.mockResolvedValue([[FLAG_ROW], 1]);

    const result = await getAdminFlagSummary(SENDER_ID, 1, 20);

    expect(result.flags).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.flags[0].id).toBe('flag-uuid-1');
  });

  it('returns empty list when no flags', async () => {
    mockTransaction.mockResolvedValue([[], 0]);

    const result = await getAdminFlagSummary(SENDER_ID, 1, 20);

    expect(result.flags).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── resolveFlag() tests ──────────────────────────────────────────────────────

describe('resolveFlag()', () => {
  const UPDATED_FLAG = {
    ...FLAG_ROW,
    status: 'RESOLVED',
    actionTaken: null,
    moderatorId: MOD_ID,
    resolvedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFlagFindUnique.mockResolvedValue({
      id: 'flag-uuid-1',
      targetEntityId: MSG_ID,
      targetEntityType: 'message',
      status: 'OPEN',
    });
    mockFlagUpdate.mockResolvedValue(UPDATED_FLAG);
    mockMessageFindUnique.mockResolvedValue({ conversationId: CONV_ID });
    mockHideMessage.mockResolvedValue(undefined);
    mockUnhideMessage.mockResolvedValue(undefined);
    mockMessageUpdate.mockResolvedValue({});
    mockFlagCount.mockResolvedValue(0);
  });

  describe('RESOLVED without action', () => {
    it('updates flag status to RESOLVED', async () => {
      const result = await resolveFlag('flag-uuid-1', MOD_ID, { status: 'RESOLVED' });

      expect(mockFlagUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'flag-uuid-1' },
          data: expect.objectContaining({ status: 'RESOLVED', moderatorId: MOD_ID }),
        }),
      );
      expect(result.status).toBe('RESOLVED');
    });
  });

  describe('MESSAGE_REMOVED action', () => {
    it('calls hideMessage on adapter and mirrors to Postgres', async () => {
      mockFlagUpdate.mockResolvedValue({
        ...UPDATED_FLAG,
        actionTaken: FlagAction.MESSAGE_REMOVED,
      });

      await resolveFlag('flag-uuid-1', MOD_ID, {
        status: 'RESOLVED',
        actionTaken: FlagAction.MESSAGE_REMOVED,
      });

      expect(mockHideMessage).toHaveBeenCalledWith(CONV_ID, MSG_ID);
      expect(mockMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isHidden: true }) }),
      );
    });

    it('continues even if hideMessage fails (non-fatal)', async () => {
      mockHideMessage.mockRejectedValue(new Error('Firestore down'));

      await expect(
        resolveFlag('flag-uuid-1', MOD_ID, {
          status: 'RESOLVED',
          actionTaken: FlagAction.MESSAGE_REMOVED,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('DISMISSED action — unhide logic', () => {
    it('calls unhideMessage when no other open flags remain', async () => {
      mockFlagCount.mockResolvedValue(0);

      await resolveFlag('flag-uuid-1', MOD_ID, { status: 'DISMISSED' });

      expect(mockUnhideMessage).toHaveBeenCalledWith(CONV_ID, MSG_ID);
    });

    it('does NOT call unhideMessage when other open flags remain', async () => {
      mockFlagCount.mockResolvedValue(2);

      await resolveFlag('flag-uuid-1', MOD_ID, { status: 'DISMISSED' });

      expect(mockUnhideMessage).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    it('throws FlagNotFoundError when flag does not exist', async () => {
      mockFlagFindUnique.mockResolvedValue(null);

      await expect(
        resolveFlag('non-existent', MOD_ID, { status: 'RESOLVED' }),
      ).rejects.toBeInstanceOf(FlagNotFoundError);
      expect(mockFlagUpdate).not.toHaveBeenCalled();
    });
  });
});

// ─── Error class shape tests ──────────────────────────────────────────────────

describe('Error classes', () => {
  it.each([
    ['MessageNotFoundError', MessageNotFoundError],
    ['AlreadyFlaggedError', AlreadyFlaggedError],
    ['FlagSelfError', FlagSelfError],
    ['FlagNotFoundError', FlagNotFoundError],
  ])('%s has correct name and is an Error', (name, Cls) => {
    const err = new (Cls as new () => Error)();
    expect(err.name).toBe(name);
    expect(err instanceof Error).toBe(true);
  });
});
