import {
  listDropsForUser,
  getDropDetail,
  earlyAccessDrop,
  unlockDropEarly,
  IntroductionDropNotFoundError,
  DropNotLiveError,
  InsufficientDiamondsForDropError,
  AlreadyUnlockedError,
} from '../drop.service.js';
import { DiamondReason } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDropFindMany    = jest.fn();
const mockDropFindUnique  = jest.fn();
const mockIntroUpdateMany = jest.fn();
const mockSpendDiamonds   = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    introductionDrop: {
      findMany:   (...a: unknown[]) => mockDropFindMany(...a),
      findUnique: (...a: unknown[]) => mockDropFindUnique(...a),
    },
    introduction: {
      updateMany: (...a: unknown[]) => mockIntroUpdateMany(...a),
    },
  },
}));

jest.mock('@abroad-matrimony/payment', () => {
  class InsufficientDiamondsError extends Error {
    constructor() {
      super('INSUFFICIENT_DIAMONDS');
      this.name = 'InsufficientDiamondsError';
    }
  }
  return {
    spendDiamonds: (...a: unknown[]) => mockSpendDiamonds(...a),
    InsufficientDiamondsError,
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID   = 'user-uuid-1';
const DROP_ID   = 'drop-uuid-1';
const USER_B_ID = 'user-b-uuid-1';

const FUTURE_DATE = new Date(Date.now() + 7 * 86_400_000);
const PAST_DATE   = new Date(Date.now() - 1_000);

function makeIntro(overrides: Record<string, unknown> = {}) {
  return {
    id:              'intro-uuid-1',
    status:          'PENDING',
    userAId:         USER_ID,
    viewedEarlyAt:   null,
    unlockedEarlyAt: null,
    userB: {
      id:           USER_B_ID,
      profile:      { name: 'Priya', currentCity: 'London', currentCountry: 'UK', verificationStatus: 'APPROVED' },
      profileMedia: [{ url: 'https://cdn.test/photo.jpg' }],
    },
    ...overrides,
  };
}

function makeDrop(overrides: Record<string, unknown> = {}) {
  return {
    id:              DROP_ID,
    name:            'London Singles Drop',
    criteria:        {},
    status:          'LIVE',
    releaseAt:       FUTURE_DATE,
    expiresAt:       FUTURE_DATE,
    earlyAccessCost: 5,
    unlockCost:      10,
    introductions:   [makeIntro()],
    ...overrides,
  };
}

// ── listDropsForUser ───────────────────────────────────────────────────────────

describe('listDropsForUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns formatted summaries for LIVE drops', async () => {
    const drop = {
      id:              DROP_ID,
      name:            'London Singles Drop',
      status:          'LIVE',
      releaseAt:       FUTURE_DATE,
      expiresAt:       FUTURE_DATE,
      earlyAccessCost: 5,
      unlockCost:      10,
      introductions:   [{ id: 'i1', viewedEarlyAt: null, unlockedEarlyAt: null }],
    };
    mockDropFindMany.mockResolvedValue([drop]);

    const result = await listDropsForUser(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(DROP_ID);
    expect(result[0].name).toBe('London Singles Drop');
    expect(result[0].pairingCount).toBe(1);
    expect(result[0].isEarlyAccessed).toBe(false);
    expect(result[0].isUnlocked).toBe(false);
    expect(result[0].earlyAccessCost).toBe(5);
    expect(result[0].unlockCost).toBe(10);
  });

  it('flags isEarlyAccessed when at least one intro has viewedEarlyAt', async () => {
    const drop = {
      id:              DROP_ID,
      name:            'Drop',
      status:          'LIVE',
      releaseAt:       FUTURE_DATE,
      expiresAt:       FUTURE_DATE,
      earlyAccessCost: 5,
      unlockCost:      10,
      introductions:   [{ id: 'i1', viewedEarlyAt: new Date(), unlockedEarlyAt: null }],
    };
    mockDropFindMany.mockResolvedValue([drop]);

    const result = await listDropsForUser(USER_ID);
    expect(result[0].isEarlyAccessed).toBe(true);
    expect(result[0].isUnlocked).toBe(false);
  });

  it('flags isUnlocked when at least one intro has unlockedEarlyAt', async () => {
    const drop = {
      id:              DROP_ID,
      name:            'Drop',
      status:          'LIVE',
      releaseAt:       FUTURE_DATE,
      expiresAt:       FUTURE_DATE,
      earlyAccessCost: 5,
      unlockCost:      10,
      introductions:   [{ id: 'i1', viewedEarlyAt: new Date(), unlockedEarlyAt: new Date() }],
    };
    mockDropFindMany.mockResolvedValue([drop]);

    const result = await listDropsForUser(USER_ID);
    expect(result[0].isEarlyAccessed).toBe(true);
    expect(result[0].isUnlocked).toBe(true);
  });

  it('returns empty array when no drops', async () => {
    mockDropFindMany.mockResolvedValue([]);
    const result = await listDropsForUser(USER_ID);
    expect(result).toEqual([]);
  });
});

// ── getDropDetail ──────────────────────────────────────────────────────────────

describe('getDropDetail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns drop detail with blurred name when not released and not unlocked', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ releaseAt: FUTURE_DATE }));

    const result = await getDropDetail(DROP_ID, USER_ID);

    expect(result.id).toBe(DROP_ID);
    expect(result.pairings).toHaveLength(1);
    expect(result.pairings[0].name).toBe('Hidden');
    expect(result.pairings[0].currentCity).toBeUndefined();
  });

  it('shows full profile when drop releaseAt is in the past', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ releaseAt: PAST_DATE }));

    const result = await getDropDetail(DROP_ID, USER_ID);
    expect(result.pairings[0].name).toBe('Priya');
    expect(result.pairings[0].currentCity).toBe('London');
    expect(result.pairings[0].currentCountry).toBe('UK');
    expect(result.pairings[0].verificationStatus).toBe('APPROVED');
  });

  it('shows full profile when unlockedEarlyAt is set (regardless of release)', async () => {
    mockDropFindUnique.mockResolvedValue(
      makeDrop({ introductions: [makeIntro({ unlockedEarlyAt: new Date() })] }),
    );

    const result = await getDropDetail(DROP_ID, USER_ID);
    expect(result.pairings[0].name).toBe('Priya');
  });

  it('throws IntroductionDropNotFoundError when drop not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(getDropDetail(DROP_ID, USER_ID)).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('returns photoUrl from profileMedia', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ releaseAt: PAST_DATE }));

    const result = await getDropDetail(DROP_ID, USER_ID);
    expect(result.pairings[0].photoUrl).toBe('https://cdn.test/photo.jpg');
  });
});

// ── earlyAccessDrop ────────────────────────────────────────────────────────────

describe('earlyAccessDrop', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws IntroductionDropNotFoundError when drop not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(earlyAccessDrop(USER_ID, DROP_ID)).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('throws DropNotLiveError for DRAFT drop', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'DRAFT' }));
    await expect(earlyAccessDrop(USER_ID, DROP_ID)).rejects.toBeInstanceOf(DropNotLiveError);
  });

  it('throws DropNotLiveError for EXPIRED drop', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'EXPIRED' }));
    await expect(earlyAccessDrop(USER_ID, DROP_ID)).rejects.toBeInstanceOf(DropNotLiveError);
  });

  it('charges earlyAccessCost diamonds and stamps viewedEarlyAt', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ earlyAccessCost: 5 }));
    mockSpendDiamonds.mockResolvedValue(undefined);
    mockIntroUpdateMany.mockResolvedValue({ count: 1 });

    await earlyAccessDrop(USER_ID, DROP_ID);

    expect(mockSpendDiamonds).toHaveBeenCalledWith(USER_ID, 5, DiamondReason.INTRO_EARLY_VIEW);
    expect(mockIntroUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dropId: DROP_ID, userAId: USER_ID, viewedEarlyAt: null }),
        data:  expect.objectContaining({ viewedEarlyAt: expect.any(Date) }),
      }),
    );
  });

  it('is idempotent — no charge when all intros already have viewedEarlyAt', async () => {
    mockDropFindUnique.mockResolvedValue(
      makeDrop({ introductions: [makeIntro({ viewedEarlyAt: new Date() })] }),
    );

    await earlyAccessDrop(USER_ID, DROP_ID);

    expect(mockSpendDiamonds).not.toHaveBeenCalled();
    expect(mockIntroUpdateMany).not.toHaveBeenCalled();
  });

  it('throws InsufficientDiamondsForDropError when diamonds insufficient', async () => {
    const { InsufficientDiamondsError } = await import('@abroad-matrimony/payment');
    mockDropFindUnique.mockResolvedValue(makeDrop());
    mockSpendDiamonds.mockRejectedValue(new (InsufficientDiamondsError as any)());

    await expect(earlyAccessDrop(USER_ID, DROP_ID)).rejects.toBeInstanceOf(InsufficientDiamondsForDropError);
  });

  it('allows SCHEDULED drop status', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'SCHEDULED' }));
    mockSpendDiamonds.mockResolvedValue(undefined);
    mockIntroUpdateMany.mockResolvedValue({ count: 1 });

    await expect(earlyAccessDrop(USER_ID, DROP_ID)).resolves.not.toThrow();
    expect(mockSpendDiamonds).toHaveBeenCalled();
  });
});

// ── unlockDropEarly ────────────────────────────────────────────────────────────

describe('unlockDropEarly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws IntroductionDropNotFoundError when drop not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(unlockDropEarly(USER_ID, DROP_ID)).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('throws DropNotLiveError for DRAFT drop', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'DRAFT' }));
    await expect(unlockDropEarly(USER_ID, DROP_ID)).rejects.toBeInstanceOf(DropNotLiveError);
  });

  it('throws AlreadyUnlockedError when all intros already have unlockedEarlyAt', async () => {
    mockDropFindUnique.mockResolvedValue(
      makeDrop({ introductions: [makeIntro({ unlockedEarlyAt: new Date() })] }),
    );
    await expect(unlockDropEarly(USER_ID, DROP_ID)).rejects.toBeInstanceOf(AlreadyUnlockedError);
  });

  it('charges incremental cost (unlockCost - earlyAccessCost)', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ earlyAccessCost: 5, unlockCost: 10 }));
    mockSpendDiamonds.mockResolvedValue(undefined);
    mockIntroUpdateMany.mockResolvedValue({ count: 1 });

    await unlockDropEarly(USER_ID, DROP_ID);

    expect(mockSpendDiamonds).toHaveBeenCalledWith(USER_ID, 5, DiamondReason.INTRO_EARLY_UNLOCK);
  });

  it('does not charge when incremental cost is 0 (unlockCost equals earlyAccessCost)', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ earlyAccessCost: 10, unlockCost: 10 }));
    mockIntroUpdateMany.mockResolvedValue({ count: 1 });

    await unlockDropEarly(USER_ID, DROP_ID);

    expect(mockSpendDiamonds).not.toHaveBeenCalled();
  });

  it('throws InsufficientDiamondsForDropError when diamonds insufficient', async () => {
    const { InsufficientDiamondsError } = await import('@abroad-matrimony/payment');
    mockDropFindUnique.mockResolvedValue(makeDrop({ earlyAccessCost: 5, unlockCost: 10 }));
    mockSpendDiamonds.mockRejectedValue(new (InsufficientDiamondsError as any)());

    await expect(unlockDropEarly(USER_ID, DROP_ID)).rejects.toBeInstanceOf(InsufficientDiamondsForDropError);
  });

  it('stamps both unlockedEarlyAt and viewedEarlyAt on updateMany', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ earlyAccessCost: 0, unlockCost: 0 }));
    mockIntroUpdateMany.mockResolvedValue({ count: 1 });

    await unlockDropEarly(USER_ID, DROP_ID);

    expect(mockIntroUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unlockedEarlyAt: expect.any(Date),
          viewedEarlyAt:   expect.any(Date),
        }),
      }),
    );
  });

  it('allows SCHEDULED drop status', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'SCHEDULED', earlyAccessCost: 0, unlockCost: 0 }));
    mockIntroUpdateMany.mockResolvedValue({ count: 1 });

    await expect(unlockDropEarly(USER_ID, DROP_ID)).resolves.not.toThrow();
  });
});
