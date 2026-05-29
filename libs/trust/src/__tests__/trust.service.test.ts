import {
  blockUser,
  unblockUser,
  listBlocks,
  reportUser,
  getSignals,
  AlreadyBlockedError,
  BlockNotFoundError,
  BlockSelfError,
  ReportSelfError,
} from '../index.js';
import { FlagReason } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUserBlockFindUnique = jest.fn();
const mockUserBlockFindMany   = jest.fn();
const mockUserBlockCreate     = jest.fn();
const mockUserBlockDelete     = jest.fn();
const mockConnectionUpdateMany = jest.fn();
const mockFlagCreate          = jest.fn();
const mockConnectionCount     = jest.fn();
const mockIntroductionCount   = jest.fn();
const mockCheckInFindMany     = jest.fn();
const mockTransaction         = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    userBlock: {
      findUnique: (...a: unknown[]) => mockUserBlockFindUnique(...a),
      findMany:   (...a: unknown[]) => mockUserBlockFindMany(...a),
      create:     (...a: unknown[]) => mockUserBlockCreate(...a),
      delete:     (...a: unknown[]) => mockUserBlockDelete(...a),
    },
    connection: {
      updateMany: (...a: unknown[]) => mockConnectionUpdateMany(...a),
      count:      (...a: unknown[]) => mockConnectionCount(...a),
    },
    flag: {
      create: (...a: unknown[]) => mockFlagCreate(...a),
    },
    introduction: {
      count: (...a: unknown[]) => mockIntroductionCount(...a),
    },
    checkIn: {
      findMany: (...a: unknown[]) => mockCheckInFindMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const BLOCKER_ID = 'user-blocker-uuid';
const BLOCKED_ID = 'user-blocked-uuid';

const BLOCK_ROW = {
  id: 'block-1',
  blockerId: BLOCKER_ID,
  blockedId: BLOCKED_ID,
  reason: null,
  createdAt: new Date('2026-05-01'),
  blocked: { profile: { name: 'John' } },
};

// ── blockUser ──────────────────────────────────────────────────────────────────

describe('blockUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a block and cancels pending connections', async () => {
    mockUserBlockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockUserBlockCreate.mockResolvedValue(BLOCK_ROW);
    mockConnectionUpdateMany.mockResolvedValue({ count: 1 });

    const result = await blockUser(BLOCKER_ID, BLOCKED_ID);

    expect(mockUserBlockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blockerId: BLOCKER_ID,
          blockedId: BLOCKED_ID,
        }),
      }),
    );
    expect(result.id).toBe('block-1');
    expect(result.blockedUserId).toBe(BLOCKED_ID);
    expect(result.blockedUserName).toBe('John');
  });

  it('creates block with reason', async () => {
    mockUserBlockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockUserBlockCreate.mockResolvedValue({ ...BLOCK_ROW, reason: 'Harassment' });
    mockConnectionUpdateMany.mockResolvedValue({ count: 0 });

    await blockUser(BLOCKER_ID, BLOCKED_ID, 'Harassment');
    expect(mockUserBlockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'Harassment' }),
      }),
    );
  });

  it('throws BlockSelfError when trying to block self', async () => {
    await expect(blockUser(BLOCKER_ID, BLOCKER_ID)).rejects.toBeInstanceOf(BlockSelfError);
    expect(mockUserBlockFindUnique).not.toHaveBeenCalled();
  });

  it('throws AlreadyBlockedError when already blocked', async () => {
    mockUserBlockFindUnique.mockResolvedValue({ id: 'block-1' });
    await expect(blockUser(BLOCKER_ID, BLOCKED_ID)).rejects.toBeInstanceOf(AlreadyBlockedError);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns null blockedUserName when blocked user has no profile', async () => {
    mockUserBlockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockUserBlockCreate.mockResolvedValue({
      ...BLOCK_ROW,
      blocked: { profile: null },
    });
    mockConnectionUpdateMany.mockResolvedValue({ count: 0 });

    const result = await blockUser(BLOCKER_ID, BLOCKED_ID);
    expect(result.blockedUserName).toBeNull();
  });
});

// ── unblockUser ────────────────────────────────────────────────────────────────

describe('unblockUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes the block record', async () => {
    mockUserBlockFindUnique.mockResolvedValue({ id: 'block-1' });
    mockUserBlockDelete.mockResolvedValue({});

    await unblockUser(BLOCKER_ID, BLOCKED_ID);

    expect(mockUserBlockDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blockerId_blockedId: { blockerId: BLOCKER_ID, blockedId: BLOCKED_ID } },
      }),
    );
  });

  it('throws BlockNotFoundError when block does not exist', async () => {
    mockUserBlockFindUnique.mockResolvedValue(null);
    await expect(unblockUser(BLOCKER_ID, BLOCKED_ID)).rejects.toBeInstanceOf(BlockNotFoundError);
  });
});

// ── listBlocks ─────────────────────────────────────────────────────────────────

describe('listBlocks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all blocks for a user', async () => {
    mockUserBlockFindMany.mockResolvedValue([BLOCK_ROW]);

    const result = await listBlocks(BLOCKER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].blockedUserId).toBe(BLOCKED_ID);
    expect(result[0].blockedUserName).toBe('John');
  });

  it('returns empty array when no blocks', async () => {
    mockUserBlockFindMany.mockResolvedValue([]);
    const result = await listBlocks(BLOCKER_ID);
    expect(result).toEqual([]);
  });
});

// ── reportUser ─────────────────────────────────────────────────────────────────

describe('reportUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a flag/report record', async () => {
    mockFlagCreate.mockResolvedValue({
      id: 'flag-1',
      reporterId: BLOCKER_ID,
      targetUserId: BLOCKED_ID,
      targetEntityType: 'user',
      targetEntityId: BLOCKED_ID,
      reason: FlagReason.HARASSMENT,
      description: 'Repeatedly offensive',
      status: 'PENDING',
      createdAt: new Date(),
    });

    const result = await reportUser(BLOCKER_ID, BLOCKED_ID, FlagReason.HARASSMENT, 'Repeatedly offensive');

    expect(mockFlagCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterId: BLOCKER_ID,
          targetUserId: BLOCKED_ID,
          reason: FlagReason.HARASSMENT,
          description: 'Repeatedly offensive',
        }),
      }),
    );
    expect(result.reason).toBe(FlagReason.HARASSMENT);
    expect(result.targetUserId).toBe(BLOCKED_ID);
  });

  it('throws ReportSelfError when trying to report self', async () => {
    await expect(reportUser(BLOCKER_ID, BLOCKER_ID, FlagReason.SPAM)).rejects.toBeInstanceOf(
      ReportSelfError,
    );
    expect(mockFlagCreate).not.toHaveBeenCalled();
  });
});

// ── getSignals ─────────────────────────────────────────────────────────────────

describe('getSignals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns correct engagement signals', async () => {
    // connectionsSent7d, connectionsReceived7d, totalAccepted, totalSent, introductions
    mockConnectionCount
      .mockResolvedValueOnce(3)  // connectionsSent7d
      .mockResolvedValueOnce(2)  // connectionsReceived7d
      .mockResolvedValueOnce(5)  // totalAccepted
      .mockResolvedValueOnce(10); // totalSent
    mockIntroductionCount.mockResolvedValue(1);
    mockCheckInFindMany.mockResolvedValue([
      { weekKey: '2026-W22' },
      { weekKey: '2026-W21' },
      { weekKey: '2026-W20' },
    ]);

    const result = await getSignals(BLOCKER_ID);

    expect(result.connectionRequestsSent7d).toBe(3);
    expect(result.connectionRequestsReceived7d).toBe(2);
    expect(result.matchRate).toBe(50); // 5/10 * 100
    expect(result.introductionsThisWeek).toBe(1);
    expect(result.checkInsStreak).toBeGreaterThanOrEqual(1);
    expect(result.profileViews7d).toBe(0); // placeholder
    expect(result.profileViews30d).toBe(0); // placeholder
  });

  it('returns 0 matchRate when no connections sent', async () => {
    mockConnectionCount
      .mockResolvedValueOnce(0)  // connectionsSent7d
      .mockResolvedValueOnce(0)  // connectionsReceived7d
      .mockResolvedValueOnce(0)  // totalAccepted
      .mockResolvedValueOnce(0); // totalSent
    mockIntroductionCount.mockResolvedValue(0);
    mockCheckInFindMany.mockResolvedValue([]);

    const result = await getSignals(BLOCKER_ID);

    expect(result.matchRate).toBe(0);
    expect(result.checkInsStreak).toBe(0);
  });
});
