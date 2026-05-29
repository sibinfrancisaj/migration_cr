import {
  listHabits,
  logHabit,
  deleteHabitLog,
  getHabitStreak,
  addHabitReflection,
  HabitAlreadyLoggedError,
  HabitLogNotFoundError,
  HABIT_LABELS,
} from '../index.js';
import { HabitKey } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockHabitLogFindMany  = jest.fn();
const mockHabitLogFindUnique = jest.fn();
const mockHabitLogCreate    = jest.fn();
const mockHabitLogDelete    = jest.fn();
const mockHabitLogUpdate    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    habitLog: {
      findMany:   (...a: unknown[]) => mockHabitLogFindMany(...a),
      findUnique: (...a: unknown[]) => mockHabitLogFindUnique(...a),
      create:     (...a: unknown[]) => mockHabitLogCreate(...a),
      delete:     (...a: unknown[]) => mockHabitLogDelete(...a),
      update:     (...a: unknown[]) => mockHabitLogUpdate(...a),
    },
  },
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
