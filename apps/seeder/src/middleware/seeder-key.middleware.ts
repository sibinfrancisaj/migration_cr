/**
 * SEED-008 — Seeder control API auth middleware.
 * All control endpoints require `X-Seeder-Key: <SEEDER_SECRET>` header.
 */
import type { Request, Response, NextFunction } from 'express';
import { getSeederEnv } from '../lib/seeder-env.js';

export function requireSeederKey(req: Request, res: Response, next: NextFunction): void {
  const env = getSeederEnv();
  const key = req.headers['x-seeder-key'];

  if (!key || key !== env.SEEDER_SECRET) {
    res.status(401).json({ success: false, error: 'Invalid or missing X-Seeder-Key header' });
    return;
  }

  next();
}
