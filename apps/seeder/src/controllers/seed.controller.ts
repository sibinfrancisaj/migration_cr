/**
 * SEED-008 — Seeder control API controller.
 * GET /seed/status, POST /seed/run, POST /seed/flush,
 * POST /seed/pause, POST /seed/resume, POST /seed/activity,
 * POST /seed/pause-activity, POST /seed/resume-activity
 */
import type { Request, Response, NextFunction } from 'express';
import { getSeederStatus } from '../services/status.service.js';
import { flushAllSeededData } from '../services/flush.service.js';
import { seedSystemGroups } from '../services/group-seed.service.js';
import { triggerImmediateDrip } from '../jobs/drip.job.js';
import { triggerImmediateActivity } from '../jobs/activity.job.js';
import {
  pauseDrip, resumeDrip,
  pauseActivity, resumeActivity,
  getState,
} from '../lib/seeder-state.js';
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
      const groupResult = await seedSystemGroups();
      seederLog.info('System groups ensured before drip', groupResult);

      const jobId = await triggerImmediateDrip();
      seederLog.info('Manual drip triggered via control API', { jobId });
      res.status(202).json({ success: true, data: { jobId, message: 'Drip job queued', groups: groupResult } });
    } catch (err) {
      next(err);
    }
  },

  /** POST /seed/activity — trigger immediate social loop run */
  async triggerActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (getState().activityRunning) {
        res.status(409).json({ success: false, error: 'Activity loop is already running' });
        return;
      }
      const jobId = await triggerImmediateActivity();
      seederLog.info('Manual activity loop triggered', { jobId });
      res.status(202).json({ success: true, data: { jobId, message: 'Activity job queued' } });
    } catch (err) {
      next(err);
    }
  },

  /** POST /seed/groups — create/verify system groups (idempotent) */
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

  pause(_req: Request, res: Response): void {
    pauseDrip();
    res.json({ success: true, data: { dripPaused: true } });
  },

  resume(_req: Request, res: Response): void {
    resumeDrip();
    res.json({ success: true, data: { dripPaused: false } });
  },

  pauseActivityHandler(_req: Request, res: Response): void {
    pauseActivity();
    res.json({ success: true, data: { activityPaused: true } });
  },

  resumeActivityHandler(_req: Request, res: Response): void {
    resumeActivity();
    res.json({ success: true, data: { activityPaused: false } });
  },
};
