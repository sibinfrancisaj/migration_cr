/**
 * Journey 01 — Health & Public Endpoints
 *
 * Verifies the gateway is alive and public routes respond correctly.
 * No auth required.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 01 — Health & public endpoints', () => {
  const ctx = getJourneyContext();

  it('GET /health → 200 with status ok', async () => {
    const res = await ctx.anon.get('/health');
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['status']).toBe('ok');
  });

  it('GET /unknown-path → 404', async () => {
    const res = await ctx.anon.get('/api/v1/this-does-not-exist');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/profile/me without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/profile/me');
    expect(res.status).toBe(401);
  });
});
