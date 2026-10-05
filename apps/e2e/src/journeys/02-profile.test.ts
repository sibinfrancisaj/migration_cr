/**
 * Journey 02 — Profile
 *
 * Happy path: read own profile, read another user's public profile.
 * Verifies that seeder-created profiles are fully readable via the API.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 02 — Profile', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/profile/me → 200 with profile fields', async () => {
    const res = await ctx.userA.get('/api/v1/profile/me');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['name']).toBe('string');
    expect(typeof body.data['completionScore']).toBe('number');
    expect(body.data['userId']).toBe(ctx.userAId);
  });

  it('GET /api/v1/profiles/:id → 200 for seeded user B (public profile)', async () => {
    const res = await ctx.userA.get(`/api/v1/profiles/${ctx.userBId}`);
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data['userId']).toBe(ctx.userBId);
  });

  it('GET /api/v1/profiles/:id with unknown UUID → 404', async () => {
    const res = await ctx.userA.get('/api/v1/profiles/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/profile/match-tuning → 200', async () => {
    const res = await ctx.userA.get('/api/v1/profile/match-tuning');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    // weights may be empty for a new user — just verify shape
    expect(typeof body.data['weights']).toBe('object');
  });

  it('GET /api/v1/profile/access-levels → 200 with PUBLIC/TRUSTED/FAMILY tiers', async () => {
    const res = await ctx.userA.get('/api/v1/profile/access-levels');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
  });
});
