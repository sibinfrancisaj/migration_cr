/**
 * Journey 07 — Payments (read-only checks)
 *
 * We only test safe read operations — no real checkout sessions created.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 07 — Payments (read-only)', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/payment/membership → 200', async () => {
    const res = await ctx.userA.get('/api/v1/payment/membership');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> | null };
    expect(body.success).toBe(true);
    // data is null when no membership exists — both null and object are valid
    expect(body.data === null || typeof body.data === 'object').toBe(true);
  });

  it('GET /api/v1/payment/diamonds/balance → 200 with numeric balance', async () => {
    const res = await ctx.userA.get('/api/v1/payment/diamonds/balance');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['balance']).toBe('number');
    expect(body.data['balance']).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/payment/membership without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/payment/membership');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/payment/diamonds/spend without body → 400', async () => {
    const res = await ctx.userA.post('/api/v1/payment/diamonds/spend', {});
    expect(res.status).toBe(400);
  });
});
