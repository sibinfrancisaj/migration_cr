/**
 * Journey 04 — Notification Preferences
 *
 * Get → update → verify preferences are persisted.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

interface NotificationPrefs {
  emailEnabled:     boolean;
  smsEnabled:       boolean;
  pushEnabled:      boolean;
  marketingEnabled: boolean;
}

describeE2e('Journey 04 — Notification preferences', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/notifications/preferences → 200 with all channels', async () => {
    const res = await ctx.userA.get('/api/v1/notifications/preferences');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: NotificationPrefs };
    expect(body.success).toBe(true);
    expect(typeof body.data.emailEnabled).toBe('boolean');
    expect(typeof body.data.smsEnabled).toBe('boolean');
    expect(typeof body.data.pushEnabled).toBe('boolean');
    expect(typeof body.data.marketingEnabled).toBe('boolean');
  });

  it('PUT /api/v1/notifications/preferences → 200, persists change', async () => {
    // Disable marketing, then verify it stuck
    const updateRes = await ctx.userA.put('/api/v1/notifications/preferences', {
      marketingEnabled: false,
    });
    expect(updateRes.status).toBe(200);

    const getRes = await ctx.userA.get('/api/v1/notifications/preferences');
    const body = getRes.body as { success: boolean; data: NotificationPrefs };
    expect(body.data.marketingEnabled).toBe(false);

    // Restore default
    await ctx.userA.put('/api/v1/notifications/preferences', { marketingEnabled: true });
  });

  it('PUT with no fields → 200 (no-op partial update)', async () => {
    const res = await ctx.userA.put('/api/v1/notifications/preferences', {});
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/notifications/preferences without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/notifications/preferences');
    expect(res.status).toBe(401);
  });
});
