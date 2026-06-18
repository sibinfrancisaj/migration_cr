/**
 * AI-006 tests — Quiet Window / Timezone-Aware Delivery.
 */

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const mockEmbeddingFindUnique = jest.fn();
jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profileEmbedding: { findUnique: (...a: unknown[]) => mockEmbeddingFindUnique(...a) },
  },
}));

import { getContactWindow, isWithinWindow, msUntilWindowOpens } from '../quiet-window.js';
import type { ContactWindow } from '../types/ai.types.js';

const UTC_WINDOW: ContactWindow = { startHour: 8, endHour: 22, timezone: 'UTC' };

beforeEach(() => jest.clearAllMocks());

// ── getContactWindow ──────────────────────────────────────────────────────────
describe('getContactWindow()', () => {
  it('returns stored window when ProfileEmbedding exists', async () => {
    mockEmbeddingFindUnique.mockResolvedValue({
      recommendedContactWindow: { startHour: 9, endHour: 21, timezone: 'Europe/Berlin' },
    });
    const window = await getContactWindow('user-aaa');
    expect(window.startHour).toBe(9);
    expect(window.timezone).toBe('Europe/Berlin');
  });

  it('returns default window when no embedding exists', async () => {
    mockEmbeddingFindUnique.mockResolvedValue(null);
    const window = await getContactWindow('user-aaa');
    expect(window.timezone).toBe('UTC');
    expect(window.startHour).toBe(8);
  });

  it('returns default window when DB throws', async () => {
    mockEmbeddingFindUnique.mockRejectedValue(new Error('DB error'));
    const window = await getContactWindow('user-aaa');
    expect(window.timezone).toBe('UTC');
  });
});

// ── isWithinWindow ────────────────────────────────────────────────────────────
describe('isWithinWindow()', () => {
  it('returns true during window hours (UTC noon)', () => {
    const noon = new Date('2026-06-01T12:00:00Z'); // 12:00 UTC
    expect(isWithinWindow(UTC_WINDOW, noon)).toBe(true);
  });

  it('returns false outside window hours (UTC 23:00)', () => {
    const night = new Date('2026-06-01T23:00:00Z'); // 23:00 UTC
    expect(isWithinWindow(UTC_WINDOW, night)).toBe(false);
  });

  it('returns false before window start (UTC 06:00)', () => {
    const early = new Date('2026-06-01T06:00:00Z'); // 06:00 UTC
    expect(isWithinWindow(UTC_WINDOW, early)).toBe(false);
  });

  it('returns true at startHour boundary', () => {
    const start = new Date('2026-06-01T08:00:00Z'); // 08:00 UTC
    expect(isWithinWindow(UTC_WINDOW, start)).toBe(true);
  });

  it('returns false at endHour boundary', () => {
    const end = new Date('2026-06-01T22:00:00Z'); // 22:00 UTC
    expect(isWithinWindow(UTC_WINDOW, end)).toBe(false);
  });

  it('returns true for unknown timezone (safe default)', () => {
    const unknownWindow: ContactWindow = { startHour: 8, endHour: 22, timezone: 'Invalid/Zone' };
    expect(isWithinWindow(unknownWindow, new Date())).toBe(true);
  });
});

// ── msUntilWindowOpens ────────────────────────────────────────────────────────
describe('msUntilWindowOpens()', () => {
  it('returns hours until startHour when before window', () => {
    const earlyMorning = new Date('2026-06-01T05:00:00Z'); // 05:00 UTC — 3h before window starts at 08:00
    const ms = msUntilWindowOpens(UTC_WINDOW, earlyMorning);
    expect(ms).toBe(3 * 60 * 60 * 1000);
  });

  it('returns hours to next-day window start when past endHour', () => {
    const night = new Date('2026-06-01T23:00:00Z'); // 23:00 UTC — 9h before next day's 08:00
    const ms = msUntilWindowOpens(UTC_WINDOW, night);
    expect(ms).toBe(9 * 60 * 60 * 1000);
  });

  it('returns fallback 1h for invalid timezone', () => {
    const badWindow: ContactWindow = { startHour: 8, endHour: 22, timezone: 'Bad/Zone' };
    const ms = msUntilWindowOpens(badWindow, new Date());
    expect(ms).toBe(60 * 60 * 1000);
  });
});

