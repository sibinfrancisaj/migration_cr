/**
 * Journey 08 — Admin Endpoints
 *
 * Verifies admin-only routes respond correctly.
 * Skipped if no SUPERADMIN user is available.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 08 — Admin endpoints', () => {
  const ctx = getJourneyContext();

  // ── Queue health (new endpoint) ────────────────────────────────────────────

  it('GET /admin/system/queue-health → 200 with all queues', async () => {
    if (!ctx.adminUserId) {
      console.warn('[e2e] Skipping — no SUPERADMIN user found');
      return;
    }
    const res = await ctx.admin.get('/admin/system/queue-health');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: { queues: unknown[]; checkedAt: string } };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.queues)).toBe(true);
    expect(body.data.queues.length).toBeGreaterThanOrEqual(6);
    expect(typeof body.data.checkedAt).toBe('string');
  });

  it('each queue entry has stat fields and a name', async () => {
    if (!ctx.adminUserId) return;

    const res = await ctx.admin.get('/admin/system/queue-health');
    const body = res.body as {
      data: { queues: Array<{ name: string; waiting: number; active: number; failed: number; workerCount: number }> };
    };

    for (const q of body.data.queues) {
      expect(typeof q.name).toBe('string');
      expect(typeof q.waiting).toBe('number');
      expect(typeof q.active).toBe('number');
      expect(typeof q.failed).toBe('number');
      expect(typeof q.workerCount).toBe('number');
    }
  });

  it('GET /admin/system/queue-health without auth → 401', async () => {
    const res = await ctx.anon.get('/admin/system/queue-health');
    expect(res.status).toBe(401);
  });

  // ── Analytics KPI ──────────────────────────────────────────────────────────

  it('GET /admin/analytics/kpi → 200', async () => {
    if (!ctx.adminUserId) return;
    const res = await ctx.admin.get('/admin/analytics/kpi');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
  });

  // ── AI embedding status ────────────────────────────────────────────────────

  it('GET /admin/ai/embeddings/status → 200', async () => {
    if (!ctx.adminUserId) return;
    const res = await ctx.admin.get('/admin/ai/embeddings/status');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(typeof body.data['total']).toBe('number');
  });

  // ── Seeder monitoring ──────────────────────────────────────────────────────

  it('GET /admin/seeder/status → 200', async () => {
    if (!ctx.adminUserId) return;
    const res = await ctx.admin.get('/admin/seeder/status');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
  });

  // ── User listing ───────────────────────────────────────────────────────────

  it('GET /admin/users → 200 with paginated users', async () => {
    if (!ctx.adminUserId) return;
    const res = await ctx.admin.get('/admin/users');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
