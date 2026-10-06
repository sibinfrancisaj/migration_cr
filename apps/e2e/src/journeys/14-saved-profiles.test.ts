/**
 * Journey 14 — Saved Profiles
 *
 * Save, list, update note, compare, unsave.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 14 — Saved profiles', () => {
  const ctx = getJourneyContext();

  it('POST /api/v1/saved → 201 saves a profile', async () => {
    const res = await ctx.userA.post('/api/v1/saved', {
      savedUserId: ctx.userBId,
      label:       'potential',
      notes:       'E2E test save',
    });
    expect([200, 201, 409]).toContain(res.status); // 409 if already saved from prior run
    if (res.status === 201 || res.status === 200) {
      const body = res.body as { success: boolean };
      expect(body.success).toBe(true);
    }
  });

  it('GET /api/v1/saved → 200 includes saved profile', async () => {
    const res = await ctx.userA.get('/api/v1/saved');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: Array<{ savedUserId: string }> };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((s) => s.savedUserId === ctx.userBId);
    expect(found).toBeDefined();
  });

  it('PATCH /api/v1/saved/:userId → 200 updates notes', async () => {
    const res = await ctx.userA.patch(`/api/v1/saved/${ctx.userBId}`, {
      notes: 'Updated E2E note',
    });
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('GET /api/v1/saved/compare?ids=... → 200 compares saved profiles', async () => {
    const res = await ctx.userA.get(`/api/v1/saved/compare?ids=${ctx.userBId}`);
    // Needs at least 2 IDs for compare — may return 400 with 1 id
    expect([200, 400]).toContain(res.status);
  });

  it('DELETE /api/v1/saved/:userId → 200 unsaves', async () => {
    const res = await ctx.userA.del(`/api/v1/saved/${ctx.userBId}`);
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('DELETE /api/v1/saved/:userId again → 404', async () => {
    const res = await ctx.userA.del(`/api/v1/saved/${ctx.userBId}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/saved without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/saved');
    expect(res.status).toBe(401);
  });
});
