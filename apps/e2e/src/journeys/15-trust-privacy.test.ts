/**
 * Journey 15 — Trust Center & Privacy Controls
 *
 * Trust score retrieval, privacy controls update, profile pause.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 15 — Trust center & privacy', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/trust → 200 with trust score 0–100', async () => {
    const res = await ctx.userA.get('/api/v1/trust');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: { score: number; layers: unknown[] } };
    expect(body.success).toBe(true);
    expect(typeof body.data.score).toBe('number');
    expect(body.data.score).toBeGreaterThanOrEqual(0);
    expect(body.data.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.data.layers)).toBe(true);
  });

  it('PUT /api/v1/profile/privacy-controls → 200 updates privacy settings', async () => {
    const res = await ctx.userA.put('/api/v1/profile/privacy-controls', {
      showPhotosBeforeMutual:  false,
      showBioBeforeMutual:     true,
      showAnswersBeforeMutual: false,
    });
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('PUT /api/v1/profile/privacy-controls partial update → 200', async () => {
    const res = await ctx.userA.put('/api/v1/profile/privacy-controls', {
      showPhotosBeforeMutual: true,
    });
    expect(res.status).toBe(200);
  });

  it('POST /api/v1/profile/pause-visibility → 200 pauses profile', async () => {
    const res = await ctx.userA.post('/api/v1/profile/pause-visibility');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('DELETE /api/v1/profile/pause-visibility → 200 resumes profile', async () => {
    const res = await ctx.userA.del('/api/v1/profile/pause-visibility');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('GET /api/v1/profile/access-levels → 200 returns PUBLIC/TRUSTED/FAMILY', async () => {
    const res = await ctx.userA.get('/api/v1/profile/access-levels');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Array<{ key: string }> };
    expect(body.success).toBe(true);
    const keys = body.data.map((a) => a.key);
    expect(keys).toContain('PUBLIC');
    expect(keys).toContain('TRUSTED');
    expect(keys).toContain('FAMILY');
  });

  it('POST /api/v1/trust/block → 200 blocks userB', async () => {
    const res = await ctx.userA.post('/api/v1/trust/block', {
      blockedUserId: ctx.userBId,
    });
    expect([200, 201, 409]).toContain(res.status); // 409 if already blocked
    if (res.status !== 409) {
      const body = res.body as { success: boolean };
      expect(body.success).toBe(true);
    }
  });

  it('DELETE /api/v1/trust/block/:userId → 200 unblocks userB', async () => {
    const res = await ctx.userA.del(`/api/v1/trust/block/${ctx.userBId}`);
    expect([200, 404]).toContain(res.status); // 404 if wasn't blocked
  });

  it('GET /api/v1/trust without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/trust');
    expect(res.status).toBe(401);
  });
});
