import {
  listCurrentIntroductions,
  listIntroductionHistory,
  acceptIntroduction,
  declineIntroduction,
  getWeekKey,
  IntroductionNotFoundError,
  IntroductionForbiddenError,
  IntroductionExpiredError,
  IntroductionAlreadyRespondedError,
} from '../index.js';
import { IntroductionStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockIntroFindMany  = jest.fn();
const mockIntroFindUnique = jest.fn();
const mockIntroUpdate    = jest.fn();
const mockIntroCount     = jest.fn();
const mockTransaction    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    introduction: {
      findMany:   (...a: unknown[]) => mockIntroFindMany(...a),
      findUnique: (...a: unknown[]) => mockIntroFindUnique(...a),
      update:     (...a: unknown[]) => mockIntroUpdate(...a),
      count:      (...a: unknown[]) => mockIntroCount(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_A_ID = 'user-a-uuid';
const USER_B_ID = 'user-b-uuid';
const INTRO_ID  = 'intro-uuid-1';
const GROUP_ID  = 'group-uuid-1';

const FUTURE_DATE = new Date(Date.now() + 7 * 86400000);
const PAST_DATE   = new Date(Date.now() - 7 * 86400000);

const userAProfile = { name: 'Rahul', currentCity: 'London', currentCountry: 'UK', verificationStatus: 'APPROVED' };
const userBProfile = { name: 'Priya', currentCity: 'Dubai', currentCountry: 'UAE', verificationStatus: 'PENDING' };

function makeIntro(overrides: Partial<{
  id: string;
  groupId: string;
  weekKey: string;
  status: string;
  expiresAt: Date;
  acceptedByA: boolean;
  acceptedByB: boolean;
  userAId: string;
  userBId: string;
  createdAt: Date;
  userA: unknown;
  userB: unknown;
}> = {}) {
  return {
    id:          overrides.id          ?? INTRO_ID,
    groupId:     overrides.groupId     ?? GROUP_ID,
    weekKey:     overrides.weekKey     ?? getWeekKey(new Date()),
    status:      overrides.status      ?? IntroductionStatus.PENDING,
    expiresAt:   overrides.expiresAt   ?? FUTURE_DATE,
    acceptedByA: overrides.acceptedByA ?? false,
    acceptedByB: overrides.acceptedByB ?? false,
    userAId:     overrides.userAId     ?? USER_A_ID,
    userBId:     overrides.userBId     ?? USER_B_ID,
    createdAt:   overrides.createdAt   ?? new Date('2026-05-01'),
    userA: overrides.userA ?? { id: USER_A_ID, profile: userAProfile },
    userB: overrides.userB ?? { id: USER_B_ID, profile: userBProfile },
  };
}

// ── getWeekKey ─────────────────────────────────────────────────────────────────

describe('getWeekKey', () => {
  it('returns week key in YYYY-WXX format', () => {
    const key = getWeekKey(new Date('2026-05-27'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns consistent week key for same date', () => {
    const d = new Date('2026-05-27');
    expect(getWeekKey(d)).toBe(getWeekKey(d));
  });

  it('returns different week keys for dates 7 days apart', () => {
    const d1 = new Date('2026-05-20');
    const d2 = new Date('2026-05-27');
    expect(getWeekKey(d1)).not.toBe(getWeekKey(d2));
  });
});

// ── listCurrentIntroductions ───────────────────────────────────────────────────

describe('listCurrentIntroductions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns introductions for current week with correct acceptedByMe', async () => {
    mockIntroFindMany.mockResolvedValue([makeIntro({ acceptedByA: true })]);

    const result = await listCurrentIntroductions(USER_A_ID);

    expect(result).toHaveLength(1);
    expect(result[0].acceptedByMe).toBe(true);    // userA accepted
    expect(result[0].acceptedByOther).toBe(false); // userB has not
    expect(result[0].otherUser?.name).toBe('Priya');
  });

  it('sets acceptedByMe correctly for userB perspective', async () => {
    mockIntroFindMany.mockResolvedValue([makeIntro({ acceptedByB: true })]);

    const result = await listCurrentIntroductions(USER_B_ID);
    expect(result[0].acceptedByMe).toBe(true);
    expect(result[0].otherUser?.name).toBe('Rahul');
  });

  it('returns empty array when no introductions', async () => {
    mockIntroFindMany.mockResolvedValue([]);
    const result = await listCurrentIntroductions(USER_A_ID);
    expect(result).toEqual([]);
  });
});

// ── listIntroductionHistory ────────────────────────────────────────────────────

describe('listIntroductionHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated history with total count', async () => {
    const pastWeekKey = '2026-W01';
    const rows = [makeIntro({ weekKey: pastWeekKey })];
    // $transaction receives an array of Promises (Prisma operations), not functions
    mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) => {
      return await Promise.all(promises);
    });
    mockIntroFindMany.mockResolvedValue(rows);
    mockIntroCount.mockResolvedValue(1);

    const result = await listIntroductionHistory(USER_A_ID, 1, 10);

    expect(result.total).toBe(1);
    expect(result.intros).toHaveLength(1);
  });

  it('returns empty history when no past introductions', async () => {
    mockTransaction.mockImplementation(async (promises: Promise<unknown>[]) => {
      return await Promise.all(promises);
    });
    mockIntroFindMany.mockResolvedValue([]);
    mockIntroCount.mockResolvedValue(0);

    const result = await listIntroductionHistory(USER_A_ID, 1, 10);
    expect(result.total).toBe(0);
    expect(result.intros).toEqual([]);
  });
});

// ── acceptIntroduction ─────────────────────────────────────────────────────────

describe('acceptIntroduction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts introduction for userA — status stays PENDING when userB has not accepted', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro());
    mockIntroUpdate.mockResolvedValue(makeIntro({ acceptedByA: true, status: IntroductionStatus.PENDING }));

    const result = await acceptIntroduction(INTRO_ID, USER_A_ID);

    expect(mockIntroUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acceptedByA: true }),
      }),
    );
    expect(result.acceptedByMe).toBe(true);
  });

  it('status becomes MATCHED when both parties accept', async () => {
    // userB had already accepted
    mockIntroFindUnique.mockResolvedValue(makeIntro({ acceptedByB: true }));
    mockIntroUpdate.mockResolvedValue(makeIntro({ acceptedByA: true, acceptedByB: true, status: IntroductionStatus.MATCHED }));

    const result = await acceptIntroduction(INTRO_ID, USER_A_ID);
    expect(result.status).toBe(IntroductionStatus.MATCHED);
  });

  it('throws IntroductionNotFoundError when intro does not exist', async () => {
    mockIntroFindUnique.mockResolvedValue(null);
    await expect(acceptIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionNotFoundError);
  });

  it('throws IntroductionForbiddenError when caller is not userA or userB', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro());
    await expect(acceptIntroduction(INTRO_ID, 'stranger-id')).rejects.toBeInstanceOf(IntroductionForbiddenError);
  });

  it('throws IntroductionExpiredError when intro is expired', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ status: IntroductionStatus.EXPIRED, expiresAt: PAST_DATE }));
    await expect(acceptIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionExpiredError);
  });

  it('throws IntroductionExpiredError when expiresAt is in the past', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ expiresAt: PAST_DATE }));
    await expect(acceptIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionExpiredError);
  });

  it('throws IntroductionAlreadyRespondedError when already accepted by same user', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ acceptedByA: true }));
    await expect(acceptIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionAlreadyRespondedError);
  });

  it('throws IntroductionAlreadyRespondedError when intro is DECLINED', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ status: IntroductionStatus.DECLINED }));
    await expect(acceptIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionAlreadyRespondedError);
  });
});

// ── declineIntroduction ────────────────────────────────────────────────────────

describe('declineIntroduction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('declines a pending introduction', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro());
    mockIntroUpdate.mockResolvedValue(makeIntro({ status: IntroductionStatus.DECLINED }));

    const result = await declineIntroduction(INTRO_ID, USER_A_ID);

    expect(mockIntroUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: IntroductionStatus.DECLINED }),
      }),
    );
    expect(result.status).toBe(IntroductionStatus.DECLINED);
  });

  it('throws IntroductionNotFoundError when not found', async () => {
    mockIntroFindUnique.mockResolvedValue(null);
    await expect(declineIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionNotFoundError);
  });

  it('throws IntroductionForbiddenError when caller is not involved', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro());
    await expect(declineIntroduction(INTRO_ID, 'stranger-id')).rejects.toBeInstanceOf(IntroductionForbiddenError);
  });

  it('throws IntroductionExpiredError when expiresAt is in the past', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ expiresAt: PAST_DATE }));
    await expect(declineIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionExpiredError);
  });

  it('throws IntroductionAlreadyRespondedError when already DECLINED', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ status: IntroductionStatus.DECLINED }));
    await expect(declineIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionAlreadyRespondedError);
  });

  it('throws IntroductionAlreadyRespondedError when already MATCHED', async () => {
    mockIntroFindUnique.mockResolvedValue(makeIntro({ status: IntroductionStatus.MATCHED }));
    await expect(declineIntroduction(INTRO_ID, USER_A_ID)).rejects.toBeInstanceOf(IntroductionAlreadyRespondedError);
  });
});
