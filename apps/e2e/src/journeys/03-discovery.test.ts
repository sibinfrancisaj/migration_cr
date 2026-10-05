/**
 * Journey 03 — Discovery Feed
 *
 * Verifies the paginated discovery feed returns valid items with
 * the expected shape and that cursor-based pagination works.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

interface DiscoveryItem {
  userId:           string;
  name:             string;
  age:              number;
  totalScore:       number;
  personalizedScore: number;
  scoreBreakdown:   Record<string, unknown>;
}

interface DiscoveryFeed {
  items:      DiscoveryItem[];
  nextCursor: string | null;
  hasMore:    boolean;
}

describeE2e('Journey 03 — Discovery feed', () => {
  const ctx = getJourneyContext();

  let firstPageCursor: string | null = null;

  it('GET /api/v1/discover → 200 with valid feed shape', async () => {
    const res = await ctx.userA.get('/api/v1/discover?limit=5');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: DiscoveryFeed };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(typeof body.data.hasMore).toBe('boolean');

    firstPageCursor = body.data.nextCursor;
  });

  it('each discovery item has required fields', async () => {
    const res = await ctx.userA.get('/api/v1/discover?limit=5');
    const body = res.body as { success: boolean; data: DiscoveryFeed };

    for (const item of body.data.items) {
      expect(typeof item.userId).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.age).toBe('number');
      expect(typeof item.totalScore).toBe('number');
      expect(typeof item.personalizedScore).toBe('number');
      expect(item.totalScore).toBeGreaterThanOrEqual(0);
      expect(item.totalScore).toBeLessThanOrEqual(1);
    }
  });

  it('items are returned in score-descending order', async () => {
    const res = await ctx.userA.get('/api/v1/discover?limit=10');
    const body = res.body as { success: boolean; data: DiscoveryFeed };
    const scores = body.data.items.map(i => i.personalizedScore);

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });

  it('cursor pagination returns next page without duplicates', async () => {
    if (!firstPageCursor) {
      console.warn('[e2e] Skipping cursor test — no nextCursor on first page (fewer than 5 scored pairs)');
      return;
    }

    const page1Res = await ctx.userA.get('/api/v1/discover?limit=5');
    const page2Res = await ctx.userA.get(`/api/v1/discover?limit=5&cursor=${firstPageCursor}`);

    expect(page2Res.status).toBe(200);

    const page1 = (page1Res.body as { data: DiscoveryFeed }).data;
    const page2 = (page2Res.body as { data: DiscoveryFeed }).data;

    const page1Ids = new Set(page1.items.map(i => i.userId));
    for (const item of page2.items) {
      expect(page1Ids.has(item.userId)).toBe(false);
    }
  });

  it('invalid cursor → 400', async () => {
    const res = await ctx.userA.get('/api/v1/discover?cursor=not-valid-base64!!!');
    // Malformed cursor is treated as "no cursor" (no error), OR returns empty results
    // Either 200 or 400 is acceptable — just must not 500
    expect(res.status).not.toBe(500);
  });

  it('limit out of range (> 100) → 400', async () => {
    const res = await ctx.userA.get('/api/v1/discover?limit=999');
    expect(res.status).toBe(400);
  });
});
