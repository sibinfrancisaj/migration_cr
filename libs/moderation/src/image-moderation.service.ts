/**
 * PROD-003 — Google Vision SafeSearch image moderation.
 *
 * Called before a profile photo is acknowledged as uploaded.
 * Short-circuits (safe=true) when GOOGLE_VISION_API_KEY is absent.
 *
 * Rejects images rated LIKELY or VERY_LIKELY for adult/violence content.
 */
import { createChildLogger } from '@abroad-matrimony/logger';
import { getEnv } from '@abroad-matrimony/config';

const log = createChildLogger({ module: 'moderation:image' });

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

// ── Error types ───────────────────────────────────────────────────────────────

export class ImageModerationRejectedError extends Error {
  constructor(public readonly reason: string) {
    super(`IMAGE_MODERATION_REJECTED: ${reason}`);
    this.name = 'ImageModerationRejectedError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SafeSearchLikelihood = 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';

interface SafeSearchAnnotation {
  adult?: SafeSearchLikelihood;
  violence?: SafeSearchLikelihood;
  racy?: SafeSearchLikelihood;
}

const REJECTED_LIKELIHOODS: SafeSearchLikelihood[] = ['LIKELY', 'VERY_LIKELY'];

export interface ModerationResult {
  safe: boolean;
  reason?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

function isVisionConfigured(): boolean {
  return !!process.env['GOOGLE_VISION_API_KEY'];
}

/**
 * Checks an image (as a base64 string or a URL) against Google Vision SafeSearch.
 *
 * @param imageBase64 Base64-encoded image bytes (without data-URI prefix).
 * @returns { safe: true } or { safe: false, reason }
 */
export async function checkImageSafety(imageBase64: string): Promise<ModerationResult> {
  if (!isVisionConfigured()) {
    log.debug('Google Vision not configured — skipping moderation');
    return { safe: true };
  }

  const apiKey = process.env['GOOGLE_VISION_API_KEY']!;

  const requestBody = {
    requests: [{
      image: { content: imageBase64 },
      features: [{ type: 'SAFE_SEARCH_DETECTION' }],
    }],
  };

  let annotation: SafeSearchAnnotation;

  try {
    const res = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      log.warn('Vision API returned non-OK status', { status: res.status });
      return { safe: true }; // fail-open — don't block upload on Vision API errors
    }

    const data = await res.json() as { responses?: Array<{ safeSearchAnnotation?: SafeSearchAnnotation }> };
    annotation = data.responses?.[0]?.safeSearchAnnotation ?? {};
  } catch (err) {
    log.warn('Vision API call failed — fail-open', { err });
    return { safe: true };
  }

  if (annotation.adult && REJECTED_LIKELIHOODS.includes(annotation.adult)) {
    log.warn('Image rejected: adult content', { adult: annotation.adult });
    return { safe: false, reason: 'adult content detected' };
  }

  if (annotation.violence && REJECTED_LIKELIHOODS.includes(annotation.violence)) {
    log.warn('Image rejected: violent content', { violence: annotation.violence });
    return { safe: false, reason: 'violent content detected' };
  }

  return { safe: true };
}

/**
 * Convenience wrapper that throws `ImageModerationRejectedError` when unsafe.
 * Use this in upload controllers.
 */
export async function assertImageSafe(imageBase64: string): Promise<void> {
  const result = await checkImageSafety(imageBase64);
  if (!result.safe) {
    throw new ImageModerationRejectedError(result.reason ?? 'content policy violation');
  }
}
