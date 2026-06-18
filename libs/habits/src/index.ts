import { prisma } from '@abroad-matrimony/db';
import { cacheGet, cacheSet } from '@abroad-matrimony/cache';
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

export interface HabitWithStreakDto extends HabitSummaryDto {
  /** 7-element boolean array, Monday = index 0, Sunday = index 6. */
  thisWeekDots: boolean[];
}

export interface WeeklyHabitHistoryDto {
  /** ISO YYYY-MM-DD of the Monday that starts this week. */
  weekStartDate: string;
  /** Number of days the habit was completed in this week (0–7). */
  completedDays: number;
  /** Per-day completion: index 0 = Monday … index 6 = Sunday. */
  dailyDots: boolean[];
}

export interface WeeklyReflectionDto {
  insight: string;
  whyItMatters: string;
  /** ISO YYYY-MM-DD of the Monday of the current week. */
  weekStartDate: string;
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

// ─── Cache key constants ──────────────────────────────────────────────────────

const WEEKLY_REFLECTION_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const WEEKLY_REFLECTION_CACHE_PREFIX = 'habit:weekly-reflection:';

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
 * Returns the Monday of the week containing `date` at 00:00:00.000.
 * JavaScript getDay(): 0=Sun, 1=Mon, ..., 6=Sat.
 */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + daysToMonday);
  return d;
}

/**
 * Returns a 7-element boolean array (Mon–Sun) indicating which days of the
 * given week appear in `logDateSet`.
 */
function buildWeekDots(weekMonday: Date, logDateSet: Set<string>): boolean[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekMonday);
    day.setDate(day.getDate() + i);
    return logDateSet.has(day.toISOString().split('T')[0]);
  });
}

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

// ─── Phase 9 service functions ────────────────────────────────────────────────

/**
 * HABIT-004: All 10 habits with streak stats + thisWeekDots (7-bool Mon–Sun).
 */
export async function getAllHabitsWithStreaks(userId: string): Promise<HabitWithStreakDto[]> {
  const today = new Date();
  const weekMonday = getWeekMonday(today);

  // Fetch all logs: streaks (no date filter) + this week's dots
  const allLogs = await prisma.habitLog.findMany({
    where: { userId, completed: true },
    orderBy: { logDate: 'desc' },
    select: { habitKey: true, logDate: true },
  });

  // Group dates by habitKey
  const grouped = new Map<string, string[]>();
  for (const entry of allLogs) {
    const key = entry.habitKey;
    const dateStr = entry.logDate.toISOString().split('T')[0];
    const existing = grouped.get(key) ?? [];
    existing.push(dateStr);
    grouped.set(key, existing);
  }

  // Build this-week date set (all habits together — filter per habit below)
  const weekMondayStr = weekMonday.toISOString().split('T')[0];

  return Object.values(HabitKey).map((habitKey) => {
    const dates = grouped.get(habitKey) ?? [];
    const { currentStreak, longestStreak } = computeStreaks(dates);
    const logDateSet = new Set(dates);
    const thisWeekDots = buildWeekDots(weekMonday, logDateSet);

    // Verify week start is included (for no-activity weeks all dots are false — correct)
    void weekMondayStr;

    return {
      habitKey,
      label: HABIT_LABELS[habitKey],
      currentStreak,
      longestStreak,
      totalCompleted: dates.length,
      lastLoggedDate: dates[0] ?? null,
      thisWeekDots,
    };
  });
}

/**
 * HABIT-007: Per-habit weekly history for chart rendering.
 *
 * @param weeks  Number of weeks to return (1–52, default 8); ordered oldest-first.
 */
export async function getHabitHistory(
  userId: string,
  habitKey: HabitKey,
  weeks = 8,
): Promise<WeeklyHabitHistoryDto[]> {
  const today = new Date();
  const currentMonday = getWeekMonday(today);

  // Start date = Monday of (weeks-1) weeks ago
  const startDate = new Date(currentMonday);
  startDate.setDate(startDate.getDate() - (weeks - 1) * 7);

  const logs = await prisma.habitLog.findMany({
    where: {
      userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      habitKey: habitKey as any,
      completed: true,
      logDate: { gte: startDate },
    },
    select: { logDate: true },
  });

  const logDateSet = new Set(logs.map((l) => l.logDate.toISOString().split('T')[0]));

  const result: WeeklyHabitHistoryDto[] = [];
  for (let w = 0; w < weeks; w++) {
    const monday = new Date(startDate);
    monday.setDate(monday.getDate() + w * 7);
    const dailyDots = buildWeekDots(monday, logDateSet);
    result.push({
      weekStartDate: monday.toISOString().split('T')[0],
      completedDays: dailyDots.filter(Boolean).length,
      dailyDots,
    });
  }

  return result;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/**
 * HABIT-005: Rule-based weekly reflection, cached in Redis 7 days per user.
 */
export async function getWeeklyReflection(userId: string): Promise<WeeklyReflectionDto> {
  const cacheKey = `${WEEKLY_REFLECTION_CACHE_PREFIX}${userId}`;
  const cached = await cacheGet<WeeklyReflectionDto>(cacheKey);
  if (cached) return cached;

  const weekStartDate = getWeekMonday(new Date()).toISOString().split('T')[0];

  // Look at last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await prisma.habitLog.findMany({
    where: { userId, completed: true, logDate: { gte: thirtyDaysAgo } },
    select: { habitKey: true, logDate: true },
  });

  let result: WeeklyReflectionDto;

  if (logs.length === 0) {
    result = {
      insight: 'Start logging habits this week to unlock your personalised reflection.',
      whyItMatters: 'Consistent habits signal stability and self-awareness — qualities that matter in a long-term partner.',
      weekStartDate,
    };
  } else {
    // Day-of-week frequency (0=Sun … 6=Sat)
    const dayCount = new Array(7).fill(0) as number[];
    const habitCount: Record<string, number> = {};

    for (const logEntry of logs) {
      const dow = logEntry.logDate.getDay();
      dayCount[dow]++;
      habitCount[logEntry.habitKey] = (habitCount[logEntry.habitKey] ?? 0) + 1;
    }

    const bestDayIdx = dayCount.indexOf(Math.max(...dayCount));
    const bestDay = DAYS[bestDayIdx];

    const topHabitKey = (Object.entries(habitCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as HabitKey | null;
    const topHabitLabel = topHabitKey ? HABIT_LABELS[topHabitKey] : 'your habits';

    result = {
      insight: `You are most consistent on ${bestDay}s. Your strongest habit is ${topHabitLabel}.`,
      whyItMatters: 'Partners who share consistent self-improvement habits show higher long-term compatibility.',
      weekStartDate,
    };
  }

  await cacheSet(cacheKey, result, WEEKLY_REFLECTION_TTL_SECONDS);
  return result;
}

/**
 * HABIT-006: Toggle whether the user's habit summary is visible on their profile.
 */
export async function updateSummaryVisibility(userId: string, visible: boolean): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: { habitSummaryVisible: visible },
  });
  log.info('updateSummaryVisibility', { userId, visible });
}

/**
 * HABIT-008: Returns the fraction of days (0.0–1.0) the user logged any habit
 * in the last 30 days. Used by the matching algorithm.
 */
export async function getHabitConsistencyRate(userId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await prisma.habitLog.findMany({
    where: { userId, completed: true, logDate: { gte: thirtyDaysAgo } },
    select: { logDate: true },
    distinct: ['logDate'],
  });

  // Unique days with at least one habit logged / 30
  return Math.min(logs.length / 30, 1.0);
}

/**
 * HABIT-008: Returns the set of HabitKeys the user has logged in the last 30 days.
 * Used to compute overlap with another user.
 */
export async function getActiveHabitKeys(userId: string): Promise<Set<HabitKey>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await prisma.habitLog.findMany({
    where: { userId, completed: true, logDate: { gte: thirtyDaysAgo } },
    select: { habitKey: true },
    distinct: ['habitKey'],
  });

  return new Set(logs.map((l) => l.habitKey as HabitKey));
}
