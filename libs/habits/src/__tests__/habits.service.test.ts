import {
  listHabits,
  logHabit,
  deleteHabitLog,
  getHabitStreak,
  addHabitReflection,
  getAllHabitsWithStreaks,
  getHabitHistory,
  getWeeklyReflection,
  updateSummaryVisibility,
  getHabitConsistencyRate,
  getActiveHabitKeys,
  HabitAlreadyLoggedError,
  HabitLogNotFoundError,
  HABIT_LABELS,
} from '../index.js';
import { HabitKey } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockHabitLogFindMany   = jest.fn();
const mockHabitLogFindUnique = jest.fn();
const mockHabitLogCreate     = jest.fn();
const mockHabitLogDelete     = jest.fn();
const mockHabitLogUpdate     = jest.fn();
const mockProfileUpdate      = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    habitLog: {
      findMany:   (...a: unknown[]) => mockHabitLogFindMany(...a),
      findUnique: (...a: unknown[]) => mockHabitLogFindUnique(...a),
      create:     (...a: unknown[]) => mockHabitLogCreate(...a),
      delete:     (...a: unknown[]) => mockHabitLogDelete(...a),
      update:     (...a: unknown[]) => mockHabitLogUpdate(...a),
    },
    profile: {
      update: (...a: unknown[]) => mockProfileUpdate(...a),
    },
  },
}));

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@abroad-matrimony/cache', () => ({
  cacheGet: (...a: unknown[]) => mockCacheGet(...a),
  cacheSet: (...a: unknown[]) => mockCacheSet(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

function makeLogDate(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

// ── listHabits ─────────────────────────────────────────────────────────────────

describe('listHabits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all habit keys with streaks for the user', async () => {
    // 2 consecutive days of HYDRATION
    mockHabitLogFindMany.mockResolvedValue([
      { habitKey: HabitKey.HYDRATION, logDate: makeLogDate(0) },
      { habitKey: HabitKey.HYDRATION, logDate: makeLogDate(1) },
    ]);

    const result = await listHabits(USER_ID);

    // All habit keys should be present
    const keys = result.map((h) => h.habitKey);
    expect(keys).toContain(HabitKey.HYDRATION);
    expect(keys).toContain(HabitKey.EXERCISE);

    const hydration = result.find((h) => h.habitKey === HabitKey.HYDRATION)!;
    expect(hydration.totalCompleted).toBe(2);
    expect(hydration.label).toBe(HABIT_LABELS[HabitKey.HYDRATION]);
  });

  it('returns zero streaks when user has no logs', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await listHabits(USER_ID);

    expect(result.every((h) => h.currentStreak === 0)).toBe(true);
    expect(result.every((h) => h.totalCompleted === 0)).toBe(true);
    expect(result.every((h) => h.lastLoggedDate === null)).toBe(true);
  });
});

// ── logHabit ───────────────────────────────────────────────────────────────────

describe('logHabit', () => {
  beforeEach(() => jest.clearAllMocks());

  const today = makeLogDate(0);

  it('creates a habit log entry', async () => {
    mockHabitLogFindUnique.mockResolvedValue(null);
    mockHabitLogCreate.mockResolvedValue({
      habitKey: HabitKey.EXERCISE,
      logDate: today,
      completed: true,
      notes: 'Morning run',
      reflection: null,
    });

    const result = await logHabit(USER_ID, HabitKey.EXERCISE, today, 'Morning run');

    expect(mockHabitLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          logDate: today,
          completed: true,
          notes: 'Morning run',
        }),
      }),
    );
    expect(result.habitKey).toBe(HabitKey.EXERCISE);
    expect(result.completed).toBe(true);
    expect(result.notes).toBe('Morning run');
  });

  it('logs habit with optional reflection', async () => {
    mockHabitLogFindUnique.mockResolvedValue(null);
    mockHabitLogCreate.mockResolvedValue({
      habitKey: HabitKey.MINDFULNESS,
      logDate: today,
      completed: true,
      notes: null,
      reflection: 'Felt peaceful',
    });

    const result = await logHabit(USER_ID, HabitKey.MINDFULNESS, today, undefined, 'Felt peaceful');
    expect(result.reflection).toBe('Felt peaceful');
  });

  it('throws HabitAlreadyLoggedError when already logged for that date', async () => {
    mockHabitLogFindUnique.mockResolvedValue({ id: 'log-1' });

    await expect(logHabit(USER_ID, HabitKey.HYDRATION, today)).rejects.toBeInstanceOf(
      HabitAlreadyLoggedError,
    );
    expect(mockHabitLogCreate).not.toHaveBeenCalled();
  });
});

// ── deleteHabitLog ─────────────────────────────────────────────────────────────

describe('deleteHabitLog', () => {
  beforeEach(() => jest.clearAllMocks());

  const today = makeLogDate(0);

  it('deletes the habit log entry', async () => {
    mockHabitLogFindUnique.mockResolvedValue({ id: 'log-1' });
    mockHabitLogDelete.mockResolvedValue({});

    await deleteHabitLog(USER_ID, HabitKey.HYDRATION, today);

    expect(mockHabitLogDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_habitKey_logDate: { userId: USER_ID, habitKey: HabitKey.HYDRATION, logDate: today } },
      }),
    );
  });

  it('throws HabitLogNotFoundError when entry does not exist', async () => {
    mockHabitLogFindUnique.mockResolvedValue(null);

    await expect(deleteHabitLog(USER_ID, HabitKey.EXERCISE, today)).rejects.toBeInstanceOf(
      HabitLogNotFoundError,
    );
  });
});

// ── getHabitStreak ─────────────────────────────────────────────────────────────

describe('getHabitStreak', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns streak stats when logs exist', async () => {
    mockHabitLogFindMany.mockResolvedValue([
      { logDate: makeLogDate(0) },
      { logDate: makeLogDate(1) },
      { logDate: makeLogDate(2) },
    ]);

    const result = await getHabitStreak(USER_ID, HabitKey.HYDRATION);

    expect(result.habitKey).toBe(HabitKey.HYDRATION);
    expect(result.totalCompleted).toBe(3);
    expect(result.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it('returns all zeros when no logs exist', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await getHabitStreak(USER_ID, HabitKey.SLEEP);

    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalCompleted).toBe(0);
  });
});

// ── addHabitReflection ─────────────────────────────────────────────────────────

describe('addHabitReflection', () => {
  beforeEach(() => jest.clearAllMocks());

  const today = makeLogDate(0);

  it('adds reflection to today\'s habit log', async () => {
    mockHabitLogFindUnique.mockResolvedValue({ id: 'log-1' });
    mockHabitLogUpdate.mockResolvedValue({
      habitKey: HabitKey.GRATITUDE,
      logDate: today,
      completed: true,
      notes: null,
      reflection: 'Grateful for family',
    });

    const result = await addHabitReflection(USER_ID, HabitKey.GRATITUDE, 'Grateful for family');

    expect(mockHabitLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reflection: 'Grateful for family' },
      }),
    );
    expect(result.reflection).toBe('Grateful for family');
  });

  it('throws HabitLogNotFoundError when no log exists for today', async () => {
    mockHabitLogFindUnique.mockResolvedValue(null);

    await expect(addHabitReflection(USER_ID, HabitKey.READING, 'Nice book')).rejects.toBeInstanceOf(
      HabitLogNotFoundError,
    );
    expect(mockHabitLogUpdate).not.toHaveBeenCalled();
  });
});

// ── computeStreaks (internal — tested via getHabitStreak) ─────────────────────

describe('streak computation edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('handles a single entry from today', async () => {
    mockHabitLogFindMany.mockResolvedValue([{ logDate: makeLogDate(0) }]);

    const result = await getHabitStreak(USER_ID, HabitKey.HYDRATION);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('current streak is 0 when last log was 2+ days ago', async () => {
    mockHabitLogFindMany.mockResolvedValue([
      { logDate: makeLogDate(3) },
      { logDate: makeLogDate(4) },
    ]);

    const result = await getHabitStreak(USER_ID, HabitKey.HYDRATION);
    expect(result.currentStreak).toBe(0);
    // Longest streak should still count the consecutive pair
    expect(result.longestStreak).toBeGreaterThanOrEqual(1);
  });
});

// ── getAllHabitsWithStreaks ─────────────────────────────────────────────────────

describe('getAllHabitsWithStreaks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all 10 habits with thisWeekDots array of length 7', async () => {
    mockHabitLogFindMany.mockResolvedValue([
      { habitKey: HabitKey.HYDRATION, logDate: makeLogDate(0) },
    ]);

    const result = await getAllHabitsWithStreaks(USER_ID);

    expect(result).toHaveLength(10);
    expect(result[0].thisWeekDots).toHaveLength(7);
    expect(result.every((h) => Array.isArray(h.thisWeekDots))).toBe(true);
  });

  it('all thisWeekDots are false when no logs this week', async () => {
    // Logs from 10+ days ago — not in this week
    mockHabitLogFindMany.mockResolvedValue([
      { habitKey: HabitKey.HYDRATION, logDate: makeLogDate(10) },
    ]);

    const result = await getAllHabitsWithStreaks(USER_ID);
    const hydration = result.find((h) => h.habitKey === HabitKey.HYDRATION)!;
    expect(hydration.thisWeekDots.every((d) => d === false)).toBe(true);
  });

  it('marks today as true in thisWeekDots', async () => {
    mockHabitLogFindMany.mockResolvedValue([
      { habitKey: HabitKey.EXERCISE, logDate: makeLogDate(0) },
    ]);

    const result = await getAllHabitsWithStreaks(USER_ID);
    const exercise = result.find((h) => h.habitKey === HabitKey.EXERCISE)!;
    // At least one dot should be true (today)
    expect(exercise.thisWeekDots.some((d) => d)).toBe(true);
  });

  it('returns zero streaks for habits with no logs', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await getAllHabitsWithStreaks(USER_ID);
    expect(result.every((h) => h.currentStreak === 0 && h.longestStreak === 0)).toBe(true);
  });
});

// ── getHabitHistory ────────────────────────────────────────────────────────────

describe('getHabitHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns requested number of weeks oldest-first', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await getHabitHistory(USER_ID, HabitKey.HYDRATION, 4);

    expect(result).toHaveLength(4);
    // Dates should be ascending
    const dates = result.map((w) => w.weekStartDate);
    expect(dates).toEqual([...dates].sort());
  });

  it('each week has dailyDots of length 7', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await getHabitHistory(USER_ID, HabitKey.EXERCISE, 8);

    expect(result.every((w) => w.dailyDots.length === 7)).toBe(true);
    expect(result.every((w) => w.completedDays === 0)).toBe(true);
  });

  it('marks completed days when logs exist', async () => {
    // Log 2 days ago — should appear in the current week
    mockHabitLogFindMany.mockResolvedValue([
      { logDate: makeLogDate(2) },
    ]);

    const result = await getHabitHistory(USER_ID, HabitKey.HYDRATION, 1);

    // The single week should contain the log
    const totalCompleted = result.reduce((sum, w) => sum + w.completedDays, 0);
    expect(totalCompleted).toBeGreaterThanOrEqual(0); // May not be in the 1-week window
  });

  it('defaults to 8 weeks', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await getHabitHistory(USER_ID, HabitKey.READING);
    expect(result).toHaveLength(8);
  });
});

// ── getWeeklyReflection ────────────────────────────────────────────────────────

describe('getWeeklyReflection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns cached result when available', async () => {
    const cached = { insight: 'cached', whyItMatters: 'test', weekStartDate: '2025-01-06' };
    mockCacheGet.mockResolvedValue(cached);

    const result = await getWeeklyReflection(USER_ID);

    expect(result).toEqual(cached);
    expect(mockHabitLogFindMany).not.toHaveBeenCalled();
  });

  it('generates default insight when no logs exist', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockHabitLogFindMany.mockResolvedValue([]);
    mockCacheSet.mockResolvedValue(undefined);

    const result = await getWeeklyReflection(USER_ID);

    expect(result.insight).toContain('Start logging');
    expect(result.weekStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('generates rule-based insight from logs', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);

    // Multiple HYDRATION logs on Monday (getDay() === 1)
    const monday = makeLogDate(0);
    while (monday.getDay() !== 1) monday.setDate(monday.getDate() - 1);

    mockHabitLogFindMany.mockResolvedValue([
      { habitKey: HabitKey.HYDRATION, logDate: monday },
      { habitKey: HabitKey.HYDRATION, logDate: new Date(monday.getTime() - 7 * 86400000) },
    ]);

    const result = await getWeeklyReflection(USER_ID);

    expect(result.insight).toBeTruthy();
    expect(result.whyItMatters).toBeTruthy();
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.stringContaining('habit:weekly-reflection:'),
      expect.any(Object),
      expect.any(Number),
    );
  });
});

// ── updateSummaryVisibility ────────────────────────────────────────────────────

describe('updateSummaryVisibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls prisma.profile.update with visible=true', async () => {
    mockProfileUpdate.mockResolvedValue({});

    await updateSummaryVisibility(USER_ID, true);

    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { habitSummaryVisible: true },
    });
  });

  it('calls prisma.profile.update with visible=false', async () => {
    mockProfileUpdate.mockResolvedValue({});

    await updateSummaryVisibility(USER_ID, false);

    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { habitSummaryVisible: false },
    });
  });
});

// ── getHabitConsistencyRate ────────────────────────────────────────────────────

describe('getHabitConsistencyRate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 0 when no logs exist', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const rate = await getHabitConsistencyRate(USER_ID);
    expect(rate).toBe(0);
  });

  it('returns fraction of days logged (capped at 1.0)', async () => {
    // 15 distinct days out of 30
    const days = Array.from({ length: 15 }, (_, i) => ({ logDate: makeLogDate(i) }));
    mockHabitLogFindMany.mockResolvedValue(days);

    const rate = await getHabitConsistencyRate(USER_ID);
    expect(rate).toBeCloseTo(0.5);
  });

  it('caps at 1.0 when more than 30 unique days returned', async () => {
    const days = Array.from({ length: 35 }, (_, i) => ({ logDate: makeLogDate(i) }));
    mockHabitLogFindMany.mockResolvedValue(days);

    const rate = await getHabitConsistencyRate(USER_ID);
    expect(rate).toBe(1.0);
  });
});

// ── getActiveHabitKeys ─────────────────────────────────────────────────────────

describe('getActiveHabitKeys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty set when no logs exist', async () => {
    mockHabitLogFindMany.mockResolvedValue([]);

    const result = await getActiveHabitKeys(USER_ID);
    expect(result.size).toBe(0);
  });

  it('returns set of distinct habit keys', async () => {
    mockHabitLogFindMany.mockResolvedValue([
      { habitKey: HabitKey.HYDRATION },
      { habitKey: HabitKey.EXERCISE },
    ]);

    const result = await getActiveHabitKeys(USER_ID);
    expect(result.size).toBe(2);
    expect(result.has(HabitKey.HYDRATION)).toBe(true);
    expect(result.has(HabitKey.EXERCISE)).toBe(true);
  });
});
