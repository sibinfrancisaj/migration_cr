/**
 * Journey 06 — Habits / Consistency Hub
 *
 * Log a habit, verify streaks, weekly reflection.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

describeE2e('Journey 06 — Habits', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/habits → 200 with 10 preset habits', async () => {
    const res = await ctx.userA.get('/api/v1/habits');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(10);
  });

  it('GET /api/v1/habits/streaks → 200', async () => {
    const res = await ctx.userA.get('/api/v1/habits/streaks');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/habits/MORNING_ROUTINE/log → 200 or 409 (idempotent)', async () => {
    const res = await ctx.userA.post('/api/v1/habits/MORNING_ROUTINE/log', { date: TODAY });
    expect([200, 201, 409]).toContain(res.status);
  });

  it('GET /api/v1/habits/MORNING_ROUTINE/streak → 200', async () => {
    const res = await ctx.userA.get('/api/v1/habits/MORNING_ROUTINE/streak');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['currentStreak']).toBe('number');
  });

  it('GET /api/v1/habits/weekly-reflection → 200', async () => {
    const res = await ctx.userA.get('/api/v1/habits/weekly-reflection');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['insight']).toBe('string');
  });

  it('GET /api/v1/habits/MORNING_ROUTINE/history → 200', async () => {
    const res = await ctx.userA.get('/api/v1/habits/MORNING_ROUTINE/history?weeks=4');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST log with invalid habitKey → 400', async () => {
    const res = await ctx.userA.post('/api/v1/habits/NOT_A_REAL_HABIT/log', { date: TODAY });
    expect(res.status).toBe(400);
  });
});
