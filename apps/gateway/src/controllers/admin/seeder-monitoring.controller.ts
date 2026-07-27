import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getSeederStatus, flushAllSeeded,
  triggerDrip, triggerActivity,
  pauseDrip, resumeDrip,
  pauseActivity, resumeActivity,
  seedGroups,
} from '../../services/seeder-monitoring.service.js';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';

export const seederMonitoringController = {

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:seeder:status', requestId: req.requestId });
    try {
      log.info('Admin get seeder status');
      const data = await getSeederStatus();
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async flush(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:seeder:flush', requestId: req.requestId });
    try {
      log.info('Admin flush seeded data');
      const data = await flushAllSeeded();
      const body: ApiResponse<typeof data> = { success: true, data, meta: { message: 'Seeded data flushed' }, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

  async triggerDrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:seeder:trigger-drip', requestId: req.requestId });
    try {
      log.info('Admin trigger drip');
      const data = await triggerDrip();
      res.status(data.success ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },

  async triggerActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:seeder:trigger-activity', requestId: req.requestId });
    try {
      log.info('Admin trigger social loop');
      const data = await triggerActivity();
      res.status(data.success ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },

  async pauseDrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pauseDrip();
      res.status(HTTP_STATUS.OK).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },

  async resumeDrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await resumeDrip();
      res.status(HTTP_STATUS.OK).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },

  async pauseActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pauseActivity();
      res.status(HTTP_STATUS.OK).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },

  async resumeActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await resumeActivity();
      res.status(HTTP_STATUS.OK).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },

  async seedGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await seedGroups();
      res.status(HTTP_STATUS.OK).json({ success: data.success, data, requestId: req.requestId });
    } catch (err) { next(err); }
  },
};
