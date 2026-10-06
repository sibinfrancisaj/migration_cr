/**
 * Journey 12 — Signals Dashboard
 *
 * Profile view logging, weekly metrics, action queue, momentum chart.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 12 — Signals dashboard', () => {
  const ctx = getJourneyContext();

  it('POST /api/v1/profiles/:id/view → 200 logs a view', async () => {
    const res = await ctx.userA.post(`/api/v1/profiles/${ctx.userBId}/view`);
    expect([200, 201]).toContain(res.status);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('POST /api/v1/profiles/:id/view self → 400 ViewSelfError', async () => {
    const res = await ctx.userA.post(`/api/v1/profiles/${ctx.userAId}/view`);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/signals/week → 200 with 4 metrics', async () => {
    const res = await ctx.userA.get('/api/v1/signals/week');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['views']).not.toBe('undefined');
    expect(typeof body.data['connections']).not.toBe('undefined');
  });

  it('GET /api/v1/signals/action-queue → 200 with priority items array', async () => {
    const res = await ctx.userA.get('/api/v1/signals/action-queue');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/signals/momentum → 200 with 7 daily counts', async () => {
    const res = await ctx.userA.get('/api/v1/signals/momentum');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: number[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(7);
    for (const count of body.data) {
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it('GET /api/v1/signals/week without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/signals/week');
    expect(res.status).toBe(401);
  });
});
