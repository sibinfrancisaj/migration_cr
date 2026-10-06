/**
 * Journey 13 — Habits / Consistency Hub
 *
 * List habits, log one, read streak, get weekly reflection and history.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 13 — Habits', () => {
  const ctx = getJourneyContext();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const HABIT_KEY = 'MORNING_REFLECTION';

  it('GET /api/v1/habits → 200 with all 10 habits', async () => {
    const res = await ctx.userA.get('/api/v1/habits');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(10);
  });

  it('POST /api/v1/habits/:habitKey/log → 200 logs today\'s habit', async () => {
    const res = await ctx.userA.post(`/api/v1/habits/${HABIT_KEY}/log`, { date: today });
    expect([200, 201]).toContain(res.status);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('GET /api/v1/habits/:habitKey/streak → 200 with streak count', async () => {
    const res = await ctx.userA.get(`/api/v1/habits/${HABIT_KEY}/streak`);
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: { currentStreak: number } };
    expect(body.success).toBe(true);
    expect(typeof body.data.currentStreak).toBe('number');
    expect(body.data.currentStreak).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/habits/streaks → 200 with all habits + thisWeekDots', async () => {
    const res = await ctx.userA.get('/api/v1/habits/streaks');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: Array<{
      key: string; thisWeekDots: boolean[]; currentStreak: number;
    }> };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    for (const habit of body.data) {
      expect(typeof habit.key).toBe('string');
      expect(Array.isArray(habit.thisWeekDots)).toBe(true);
      expect(habit.thisWeekDots).toHaveLength(7);
    }
  });

  it('GET /api/v1/habits/weekly-reflection → 200 or 204', async () => {
    const res = await ctx.userA.get('/api/v1/habits/weekly-reflection');
    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      const body = res.body as { success: boolean };
      expect(body.success).toBe(true);
    }
  });

  it('GET /api/v1/habits/:habitKey/history?weeks=4 → 200 with weekly data', async () => {
    const res = await ctx.userA.get(`/api/v1/habits/${HABIT_KEY}/history?weeks=4`);
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(4);
  });

  it('GET /api/v1/habits without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/habits');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/habits/INVALID_KEY/log → 400', async () => {
    const res = await ctx.userA.post('/api/v1/habits/INVALID_KEY/log', { date: today });
    expect(res.status).toBe(400);
  });
});
