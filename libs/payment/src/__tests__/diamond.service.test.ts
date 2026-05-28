import { getDiamondBalance, creditDiamonds, spendDiamonds, refundDiamonds, InsufficientDiamondsError } from '../diamond.service.js';
import { DiamondReason } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFindFirst = jest.fn();
const mockCreate    = jest.fn();

// $transaction executes the callback with a mock tx object
const mockTransaction = jest.fn().mockImplementation((cb: (tx: unknown) => unknown) =>
  cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
);

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    diamondLedger: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      create:    (...a: unknown[]) => mockCreate(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('getDiamondBalance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 0 when no ledger entries exist', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await getDiamondBalance(USER_ID)).toBe(0);
  });

  it('returns the latest balanceAfter value', async () => {
    mockFindFirst.mockResolvedValue({ balanceAfter: 150 });
    expect(await getDiamondBalance(USER_ID)).toBe(150);
  });
});

describe('creditDiamonds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a ledger entry and returns the new balance', async () => {
    mockFindFirst.mockResolvedValue({ balanceAfter: 50 });
    mockCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
    );

    const newBalance = await creditDiamonds({
      userId: USER_ID,
      delta: 100,
      reason: DiamondReason.PURCHASE,
    });

    expect(newBalance).toBe(150);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_ID, delta: 100, balanceAfter: 150 }),
    });
  });

  it('starts from 0 when no prior ledger entries exist', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
    );

    const newBalance = await creditDiamonds({
      userId: USER_ID,
      delta: 50,
      reason: DiamondReason.ADMIN_GRANT,
    });

    expect(newBalance).toBe(50);
  });

  it('throws when delta is zero or negative', async () => {
    await expect(creditDiamonds({ userId: USER_ID, delta: 0, reason: DiamondReason.PURCHASE }))
      .rejects.toThrow('delta must be positive');

    await expect(creditDiamonds({ userId: USER_ID, delta: -10, reason: DiamondReason.PURCHASE }))
      .rejects.toThrow('delta must be positive');
  });
});

describe('spendDiamonds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deducts diamonds and returns the new balance', async () => {
    mockFindFirst.mockResolvedValue({ balanceAfter: 100 });
    mockCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
    );

    const newBalance = await spendDiamonds(USER_ID, 30, DiamondReason.FEATURE_UNLOCK);

    expect(newBalance).toBe(70);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_ID, delta: -30, balanceAfter: 70 }),
    });
  });

  it('throws InsufficientDiamondsError when balance is too low', async () => {
    mockFindFirst.mockResolvedValue({ balanceAfter: 20 });
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
    );

    await expect(spendDiamonds(USER_ID, 50, DiamondReason.FEATURE_UNLOCK))
      .rejects.toThrow(InsufficientDiamondsError);
  });

  it('throws InsufficientDiamondsError when balance is 0', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
    );

    await expect(spendDiamonds(USER_ID, 1, DiamondReason.FEATURE_UNLOCK))
      .rejects.toThrow(InsufficientDiamondsError);
  });

  it('throws when amount is zero or negative', async () => {
    await expect(spendDiamonds(USER_ID, 0, DiamondReason.FEATURE_UNLOCK))
      .rejects.toThrow('amount must be positive');
    await expect(spendDiamonds(USER_ID, -5, DiamondReason.FEATURE_UNLOCK))
      .rejects.toThrow('amount must be positive');
  });
});

describe('refundDiamonds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('credits diamonds with REFUND reason and returns new balance', async () => {
    mockFindFirst.mockResolvedValue({ balanceAfter: 0 });
    mockCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ diamondLedger: { findFirst: mockFindFirst, create: mockCreate } }),
    );

    const newBalance = await refundDiamonds(USER_ID, 100);
    expect(newBalance).toBe(100);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: DiamondReason.REFUND, delta: 100 }),
    });
  });
});
