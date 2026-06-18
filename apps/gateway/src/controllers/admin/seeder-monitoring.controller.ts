import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getSeederStatus, flushAllSeeded } from '../../services/seeder-monitoring.service.js';
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
};
