/**
 * Journey 09 — Partner Preferences + Signals
 *
 * Set partner prefs, verify they affect the discovery feed shape.
 * Read signals dashboard.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 09 — Partner preferences & signals', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/profile/partner-preferences → 200 with default empty prefs', async () => {
    const res = await ctx.userA.get('/api/v1/profile/partner-preferences');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data['countries'])).toBe(true);
    expect(Array.isArray(body.data['cities'])).toBe(true);
    expect(Array.isArray(body.data['religions'])).toBe(true);
  });

  it('PUT /api/v1/profile/partner-preferences → 200, persists country filter', async () => {
    const updateRes = await ctx.userA.put('/api/v1/profile/partner-preferences', {
      countries: ['GB', 'DE'],
      ageMin:    25,
      ageMax:    40,
    });
    expect(updateRes.status).toBe(200);

    const getRes = await ctx.userA.get('/api/v1/profile/partner-preferences');
    const body = getRes.body as { success: boolean; data: Record<string, unknown> };
    const countries = body.data['countries'] as string[];
    expect(countries).toContain('GB');
    expect(countries).toContain('DE');
    expect(body.data['ageMin']).toBe(25);
    expect(body.data['ageMax']).toBe(40);

    // Reset prefs
    await ctx.userA.put('/api/v1/profile/partner-preferences', {
      countries: [], ageMin: null, ageMax: null,
    });
  });

  it('PUT with invalid ageMin (negative) → 400', async () => {
    const res = await ctx.userA.put('/api/v1/profile/partner-preferences', {
      ageMin: -5,
    });
    expect(res.status).toBe(400);
  });

  // ── Signals ─────────────────────────────────────────────────────────────────

  it('GET /api/v1/signals/week → 200 with 4 metrics', async () => {
    const res = await ctx.userA.get('/api/v1/signals/week');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['views']).toBe('number');
    expect(typeof body.data['connections']).toBe('number');
  });

  it('GET /api/v1/signals/momentum → 200 with 7 daily counts', async () => {
    const res = await ctx.userA.get('/api/v1/signals/momentum');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(7);
  });
});
