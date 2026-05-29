/**
 * AI-006 — Quiet Window / Timezone-Aware Notification Delivery.
 *
 * Checks whether the current time is within a user's recommended contact window.
 * Used by the notification worker to defer push notifications during quiet hours.
 *
 * Default window: 08:00–22:00 UTC (when no ProfileEmbedding is present).
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ContactWindow } from './types/ai.types.js';

const log = createChildLogger({ module: 'ai:quiet-window' });

const DEFAULT_WINDOW: ContactWindow = {
  startHour: 8,
  endHour: 22,
  timezone: 'UTC',
};

/**
 * Returns the ContactWindow for a user, falling back to the default if no
 * ProfileEmbedding exists or the window field is not set.
 */
export async function getContactWindow(userId: string): Promise<ContactWindow> {
  try {
    const embedding = await prisma.profileEmbedding.findUnique({
      where: { userId },
      select: { recommendedContactWindow: true },
    });

    if (!embedding?.recommendedContactWindow) return DEFAULT_WINDOW;

    const raw = embedding.recommendedContactWindow as Partial<ContactWindow>;
    if (
      typeof raw.startHour === 'number' &&
      typeof raw.endHour === 'number' &&
      typeof raw.timezone === 'string'
    ) {
      return raw as ContactWindow;
    }

    return DEFAULT_WINDOW;
  } catch (err) {
    log.warn('getContactWindow — DB error, using default window', { userId, err });
    return DEFAULT_WINDOW;
  }
}

/**
 * Returns true if the current wall-clock time is inside the user's delivery window.
 * Returns false if the notification should be deferred.
 *
 * @param window  The ContactWindow to check against.
 * @param now     Current timestamp (defaults to Date.now(); injectable for tests).
 */
export function isWithinWindow(window: ContactWindow, now: Date = new Date()): boolean {
  try {
    // Get current hour in the recipient's local timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: window.timezone,
      hour: 'numeric',
      hour12: false,
    });
    const localHour = parseInt(formatter.format(now), 10);
    return localHour >= window.startHour && localHour < window.endHour;
  } catch {
    // Unknown timezone — allow delivery
    return true;
  }
}

/**
 * Computes the number of milliseconds until the next delivery window opens.
 *
 * @param window  The ContactWindow to compute against.
 * @param now     Current timestamp (defaults to Date.now(); injectable for tests).
 * @returns Milliseconds to wait before re-delivery.
 */
export function msUntilWindowOpens(window: ContactWindow, now: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: window.timezone,
      hour: 'numeric',
      hour12: false,
    });
    const localHour = parseInt(formatter.format(now), 10);

    // Hours to wait until window.startHour
    let hoursToWait: number;
    if (localHour < window.startHour) {
      hoursToWait = window.startHour - localHour;
    } else {
      // Past today's window end — wait until next day's start
      hoursToWait = 24 - localHour + window.startHour;
    }

    return hoursToWait * 60 * 60 * 1000;
  } catch {
    // Unknown timezone — deliver in 1 hour as fallback
    return 60 * 60 * 1000;
  }
}
