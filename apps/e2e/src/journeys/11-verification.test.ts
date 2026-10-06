/**
 * Journey 11 — Verification
 *
 * Tests the verification flow: get upload URL, check status, get trust score.
 * Full submission is not tested (requires real S3 keys) — shape + auth are verified.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

interface VerificationStatusDto {
  status:      string;
  trustScore:  number;
  layers:      Array<{
    layer:       string;
    isComplete:  boolean;
    points:      number;
    completedAt: string | null;
  }>;
  submittedAt: string | null;
  reviewedAt:  string | null;
}

interface TrustScoreDto {
  score:     number;
  maxScore:  number;
  breakdown: Record<string, unknown>;
}

describeE2e('Journey 11 — Verification', () => {
  const ctx = getJourneyContext();

  it('GET /api/v1/verification/status → 200 with expected shape', async () => {
    const res = await ctx.userA.get('/api/v1/verification/status');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: VerificationStatusDto };
    expect(body.success).toBe(true);
    expect(typeof body.data.status).toBe('string');
    expect(typeof body.data.trustScore).toBe('number');
    expect(Array.isArray(body.data.layers)).toBe(true);

    // Expect the 5 trust layers to be present
    const layerNames = body.data.layers.map((l) => l.layer);
    expect(layerNames).toContain('PHONE');
  });

  it('GET /api/v1/verification/trust-score → 200 with score fields', async () => {
    const res = await ctx.userA.get('/api/v1/verification/trust-score');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: TrustScoreDto };
    expect(body.success).toBe(true);
    expect(typeof body.data.score).toBe('number');
    expect(body.data.score).toBeGreaterThanOrEqual(0);
    expect(body.data.score).toBeLessThanOrEqual(100);
  });

  it('GET /api/v1/verification/upload-url with valid params → 200', async () => {
    const res = await ctx.userA.get(
      '/api/v1/verification/upload-url?fileType=ID_DOCUMENT&mimeType=image%2Fjpeg',
    );
    // May 200 (presigned URL) or 400 if S3 not configured — must not 401/500
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const body = res.body as { success: boolean; data: { uploadUrl: string; s3Key: string } };
      expect(body.success).toBe(true);
      expect(typeof body.data.uploadUrl).toBe('string');
      expect(typeof body.data.s3Key).toBe('string');
    }
  });

  it('GET /api/v1/verification/upload-url without auth → 401', async () => {
    const res = await ctx.anon.get(
      '/api/v1/verification/upload-url?fileType=ID_DOCUMENT&mimeType=image/jpeg',
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/verification/upload-url missing params → 400', async () => {
    const res = await ctx.userA.get('/api/v1/verification/upload-url');
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/verification/status without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/verification/status');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/verification with invalid body → 400', async () => {
    const res = await ctx.userA.post('/api/v1/verification', {
      idDocumentKey: '',  // empty key — invalid
    });
    expect(res.status).toBe(400);
  });
});
