import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { HabitKey } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'habits' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class HabitLogNotFoundError extends Error {
  constructor() {
    super('HABIT_LOG_NOT_FOUND');
    this.name = 'HabitLogNotFoundError';
  }
}

export class HabitAlreadyLoggedError extends Error {
  constructor() {
    super('HABIT_ALREADY_LOGGED');
    this.name = 'HabitAlreadyLoggedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface HabitSummaryDto {
  habitKey: string;
  label: string;
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
  lastLoggedDate: string | null;
}

export interface HabitLogDto {
  habitKey: string;
  logDate: string;
  completed: boolean;
  notes: string | null;
  reflection: string | null;
}

export interface HabitStreakDto {
  habitKey: string;
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable labels for each habit key. */
export const HABIT_LABELS: Record<HabitKey, string> = {
  [HabitKey.HYDRATION]: 'Drink water',
  [HabitKey.SLEEP]: 'Sleep on time',
  [HabitKey.EXERCISE]: 'Exercise',
  [HabitKey.MINDFULNESS]: 'Mindfulness / Meditation',
  [HabitKey.PRAYER]: 'Prayer / Spirituality',
  [HabitKey.GRATITUDE]: 'Gratitude journaling',
  [HabitKey.READING]: 'Reading',
  [HabitKey.JOURNALING]: 'Journaling',
  [HabitKey.NO_ALCOHOL]: 'No alcohol',
  [HabitKey.NO_SMOKING]: 'No smoking',
};

/**
 * Compute current streak and longest streak from an array of ISO date strings (sorted desc).
 */
function computeStreaks(dates: string[]): { currentStreak: number; longestStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const sorted = [...dates].sort((a, b) => (a > b ? -1 : 1)); // newest first

  // Current streak: consecutive days starting from today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  // Check if streak is still active (logged today or yesterday)
  const mostRecent = new Date(sorted[0]);
  const daysDiff = Math.floor((today.getTime() - mostRecent.getTime()) / 86400000);
  const streakActive = daysDiff <= 1;

  if (streakActive) {
    // Build consecutive streak going backwards from most recent
    let prev = mostRecent;
    for (const dateStr of sorted) {
      const d = new Date(dateStr);
      const diff = Math.floor((prev.getTime() - d.getTime()) / 86400000);
      if (diff <= 1) {
        streak++;
        prev = d;
      } else {
        break;
      }
    }
    currentStreak = streak;
  }

  // Longest streak: scan all dates
  streak = 1;
  longestStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const curr = new Date(sorted[i]);
    const prev = new Date(sorted[i - 1]);
    const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else if (diff > 1) {
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, streak, currentStreak);

  return { currentStreak, longestStreak };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List all habits with their streak stats for the user.
 */
export async function listHabits(userId: string): Promise<HabitSummaryDto[]> {
  const logs = await prisma.habitLog.findMany({
    where: { userId, completed: true },
    orderBy: { logDate: 'desc' },
    select: { habitKey: true, logDate: true },
  });

  // Group by habit key
  const grouped = new Map<string, string[]>();
  for (const entry of logs) {
    const key = entry.habitKey;
    const existing = grouped.get(key) ?? [];
    existing.push(entry.logDate.toISOString().split('T')[0]);
    grouped.set(key, existing);
  }

  return Object.values(HabitKey).map((habitKey) => {
    const dates = grouped.get(habitKey) ?? [];
    const { currentStreak, longestStreak } = computeStreaks(dates);
    return {
      habitKey,
      label: HABIT_LABELS[habitKey],
      currentStreak,
      longestStreak,
      totalCompleted: dates.length,
      lastLoggedDate: dates[0] ?? null,
    };
  });
}

/**
 * Log a habit for today (or a specific date).
 *
 * @throws {HabitAlreadyLoggedError} — already logged for that date
 */
export async function logHabit(
  userId: string,
  habitKey: HabitKey,
  logDate: Date,
  notes?: string,
  reflection?: string,
): Promise<HabitLogDto> {
  const existing = await prisma.habitLog.findUnique({
    where: { userId_habitKey_logDate: { userId, habitKey, logDate } },
    select: { id: true },
  });

  if (existing) {
    log.warn('logHabit — already logged', { userId, habitKey, logDate });
    throw new HabitAlreadyLoggedError();
  }

  const entry = await prisma.habitLog.create({
    data: {
      userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      habitKey: habitKey as any,
      logDate,
      completed: true,
      notes: notes ?? null,
      reflection: reflection ?? null,
    },
  });

  log.info('logHabit — logged', { userId, habitKey, logDate });

  return {
    habitKey: entry.habitKey,
    logDate: entry.logDate.toISOString().split('T')[0],
    completed: entry.completed,
    notes: entry.notes,
    reflection: entry.reflection,
  };
}

/**
 * Delete a habit log entry for a given date.
 *
 * @throws {HabitLogNotFoundError}
 */
export async function deleteHabitLog(
  userId: string,
  habitKey: HabitKey,
  logDate: Date,
): Promise<void> {
  const entry = await prisma.habitLog.findUnique({
    where: { userId_habitKey_logDate: { userId, habitKey, logDate } },
    select: { id: true },
  });

  if (!entry) throw new HabitLogNotFoundError();

  await prisma.habitLog.delete({
    where: { userId_habitKey_logDate: { userId, habitKey, logDate } },
  });

  log.info('deleteHabitLog — deleted', { userId, habitKey, logDate });
}

/**
 * Get streak information for a single habit.
 *
 * @throws {HabitLogNotFoundError} — if no logs exist for that habit (returns zeros instead)
 */
export async function getHabitStreak(
  userId: string,
  habitKey: HabitKey,
): Promise<HabitStreakDto> {
  const logs = await prisma.habitLog.findMany({
    where: { userId, habitKey, completed: true },
    orderBy: { logDate: 'desc' },
    select: { logDate: true },
  });

  const dates = logs.map((l) => l.logDate.toISOString().split('T')[0]);
  const { currentStreak, longestStreak } = computeStreaks(dates);

  return {
    habitKey,
    currentStreak,
    longestStreak,
    totalCompleted: dates.length,
  };
}

/**
 * Add or update a reflection note for today's habit log.
 *
 * @throws {HabitLogNotFoundError} — no log found for today
 */
export async function addHabitReflection(
  userId: string,
  habitKey: HabitKey,
  reflection: string,
): Promise<HabitLogDto> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entry = await prisma.habitLog.findUnique({
    where: { userId_habitKey_logDate: { userId, habitKey, logDate: today } },
  });

  if (!entry) throw new HabitLogNotFoundError();

  const updated = await prisma.habitLog.update({
    where: { userId_habitKey_logDate: { userId, habitKey, logDate: today } },
    data: { reflection },
  });

  return {
    habitKey: updated.habitKey,
    logDate: updated.logDate.toISOString().split('T')[0],
    completed: updated.completed,
    notes: updated.notes,
    reflection: updated.reflection,
  };
}
