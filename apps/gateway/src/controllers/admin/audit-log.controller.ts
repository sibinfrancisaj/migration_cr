import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { listAuditLogs } from '@abroad-matrimony/auth';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { HTTP_STATUS } from '../../constants/index.js';

export const auditLogController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:audit-log:list', requestId: req.requestId });
    try {
      const { adminId, action, entity, from, to, limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list audit logs', { adminId, action, entity });
      const result = await listAuditLogs({
        adminId,
        action,
        entity,
        from,
        to,
        limit: limit ? Number(limit) : undefined,
        cursor,
      });
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { next(err); }
  },
};
