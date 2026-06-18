/**
 * SEED-003 — S3 photo assignment service.
 *
 * Lists all objects at SEEDER_PHOTO_S3_PREFIX on first call, caches keys split
 * by gender subfolder, and picks a random key per profile.
 * Falls back gracefully when S3 is not configured or the prefix is empty.
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { seederLog } from '../lib/seeder-logger.js';
import { getSeederEnv } from '../lib/seeder-env.js';

interface PhotoCache {
  male: string[];
  female: string[];
}

let _cache: PhotoCache | null = null;
let _s3: S3Client | null = null;

function getS3(): S3Client | null {
  if (!process.env['AWS_ACCESS_KEY_ID'] || !process.env['AWS_S3_BUCKET']) return null;
  if (_s3) return _s3;
  _s3 = new S3Client({ region: process.env['AWS_REGION'] ?? 'ap-south-1' });
  return _s3;
}

export async function warmPhotoCache(): Promise<void> {
  const s3 = getS3();
  if (!s3) {
    seederLog.warn('S3 not configured — seeded profiles will have no photos');
    _cache = { male: [], female: [] };
    return;
  }

  const env = getSeederEnv();
  const bucket = process.env['AWS_S3_BUCKET']!;
  const prefix = env.SEEDER_PHOTO_S3_PREFIX;

  try {
    const [maleResult, femaleResult] = await Promise.all([
      s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${prefix}/male/` })),
      s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${prefix}/female/` })),
    ]);

    const male = (maleResult.Contents ?? [])
      .map((o) => o.Key!)
      .filter((k) => !k.endsWith('/'));

    const female = (femaleResult.Contents ?? [])
      .map((o) => o.Key!)
      .filter((k) => !k.endsWith('/'));

    _cache = { male, female };
    seederLog.info('Photo cache warmed', { maleCount: male.length, femaleCount: female.length });
  } catch (err) {
    seederLog.warn('Failed to warm photo cache — seeded profiles will have no photos', { err });
    _cache = { male: [], female: [] };
  }
}

/**
 * Returns a CloudFront/S3 public URL for a random photo matching the given gender.
 * Returns null if no photos are available for that gender.
 */
export function pickPhotoUrl(gender: 'male' | 'female'): string | null {
  if (!_cache) return null;
  const keys = _cache[gender];
  if (keys.length === 0) return null;

  const key = keys[Math.floor(Math.random() * keys.length)]!;
  const cfDomain = process.env['AWS_CLOUDFRONT_DOMAIN'];
  const bucket = process.env['AWS_S3_BUCKET'];

  if (cfDomain) return `https://${cfDomain}/${key}`;
  if (bucket) return `https://${bucket}.s3.${process.env['AWS_REGION'] ?? 'ap-south-1'}.amazonaws.com/${key}`;
  return null;
}
