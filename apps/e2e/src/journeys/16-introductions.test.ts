/**
 * Journey 16 — Introductions (Weekly Drop)
 *
 * List current introductions, view detail, check why-this-match on a profile.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

interface IntroductionDto {
  id:        string;
  status:    string;
  matchedUserId: string;
}

describeE2e('Journey 16 — Introductions', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/introductions → 200 with intro list', async () => {
    const res = await ctx.userA.get('/api/v1/introductions');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/introductions/drops → 200 with active drops', async () => {
    const res = await ctx.userA.get('/api/v1/introductions/drops');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/profiles/:id/match-context → 200 with score + breakdown', async () => {
    const res = await ctx.userA.get(`/api/v1/profiles/${ctx.userBId}/match-context`);
    expect(res.status).toBe(200);

    const body = res.body as {
      success: boolean;
      data: {
        totalScore:    number;
        scoreBreakdown: Record<string, unknown>;
        cards:         unknown[];
      };
    };
    expect(body.success).toBe(true);
    expect(typeof body.data.totalScore).toBe('number');
    expect(Array.isArray(body.data.cards)).toBe(true);
  });

  it('GET /api/v1/introductions without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/introductions');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/profiles/00000000-0000-0000-0000-000000000000/match-context → 404', async () => {
    const res = await ctx.userA.get(
      '/api/v1/profiles/00000000-0000-0000-0000-000000000000/match-context',
    );
    expect(res.status).toBe(404);
  });
});
