import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { getQueueHealth } from '../../services/queue-health.service.js';
import { HTTP_STATUS } from '../../constants/index.js';

export const queueHealthController = {

  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:queue-health', requestId: req.requestId });
    try {
      log.info('Admin get queue health');
      const data = await getQueueHealth();
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },

};
