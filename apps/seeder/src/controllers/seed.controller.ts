/**
 * SEED-008 — Seeder control API controller.
 * GET /seed/status, POST /seed/run, POST /seed/flush,
 * POST /seed/pause, POST /seed/resume
 */
import type { Request, Response, NextFunction } from 'express';
import { getSeederStatus } from '../services/status.service.js';
import { flushAllSeededData } from '../services/flush.service.js';
import { seedSystemGroups } from '../services/group-seed.service.js';
import { triggerImmediateDrip } from '../jobs/drip.job.js';
import { pauseDrip, resumeDrip, getState } from '../lib/seeder-state.js';
import { seederLog } from '../lib/seeder-logger.js';

export const seedController = {
  /** GET /seed/status */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await getSeederStatus();
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },

  /** POST /seed/run — ensure system groups exist then trigger immediate drip */
  async triggerRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (getState().running) {
        res.status(409).json({ success: false, error: 'A seeder job is already running' });
        return;
      }
      // GRP-R-007: ensure system groups exist before profiles are created
      const groupResult = await seedSystemGroups();
      seederLog.info('System groups ensured before drip', groupResult);

      const jobId = await triggerImmediateDrip();
      seederLog.info('Manual drip triggered via control API', { jobId });
      res.status(202).json({ success: true, data: { jobId, message: 'Drip job queued', groups: groupResult } });
    } catch (err) {
      next(err);
    }
  },

  /** POST /seed/groups — create/verify system groups (idempotent, standalone) */
  async seedGroups(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      seederLog.info('Manual system group seed requested');
      const result = await seedSystemGroups();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /** POST /seed/flush — wipe all seeded data */
  async flush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { confirm } = req.body as { confirm?: string };
      if (confirm !== 'FLUSH_ALL_SEEDED_DATA') {
        res.status(400).json({
          success: false,
          error: 'Must include { "confirm": "FLUSH_ALL_SEEDED_DATA" } in body',
        });
        return;
      }

      seederLog.warn('Flush requested via control API');
      const result = await flushAllSeededData();
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err?.message?.includes('Cannot flush while')) {
        res.status(409).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  },

  /** POST /seed/pause — pause drip scheduler */
  pause(_req: Request, res: Response): void {
    pauseDrip();
    res.json({ success: true, data: { dripPaused: true } });
  },

  /** POST /seed/resume — resume drip scheduler */
  resume(_req: Request, res: Response): void {
    resumeDrip();
    res.json({ success: true, data: { dripPaused: false } });
  },
};
