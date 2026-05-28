import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getAdminFlagSummary,
  resolveFlag,
  FlagNotFoundError,
} from '@abroad-matrimony/messaging';
import type { FlagDto } from '@abroad-matrimony/messaging';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { FLAG_ERRORS, FLAG_MESSAGES } from '../../constants/flag.constants.js';
import type { ResolveFlagBody, AdminFlagsQuery } from '../../schemas/admin/resolve-flag.schema.js';

export const flagsController = {
  /**
   * GET /admin/users/:userId/flags?page=1&limit=20
   *
   * Returns paginated moderation flags for a specific user.
   * Requires SUPERADMIN, OPS, or MODERATOR role.
   */
  async listByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:list', requestId: req.requestId });
    try {
      const { userId } = req.params as { userId: string };
      const { page, limit } = req.query as unknown as AdminFlagsQuery;

      log.info('Admin flag list requested', { moderatorId: req.admin!.id, userId, page, limit });

      const { flags, total } = await getAdminFlagSummary(userId, page, limit);

      const body: ApiResponse<FlagDto[]> = {
        success: true,
        data: flags,
        meta: {
          total,
          hasMore: page * limit < total,
          message: FLAG_MESSAGES.FLAGS_RETRIEVED,
        },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /admin/flags/:flagId
   *
   * Resolve or dismiss a moderation flag.
   * Optionally takes an action (MESSAGE_REMOVED, USER_SUSPENDED, etc.).
   *
   * Side-effects:
   *   - MESSAGE_REMOVED → hides the Firestore message doc
   *   - DISMISSED with no remaining open flags → unhides the message
   *
   * 404 if the flag does not exist.
   */
  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:flags:resolve', requestId: req.requestId });
    try {
      const moderatorId = req.admin!.id;
      const { flagId } = req.params as { flagId: string };
      const { status, actionTaken, resolution } = req.body as ResolveFlagBody;

      log.info('Admin flag resolve requested', { moderatorId, flagId, status, actionTaken });

      const flag = await resolveFlag(flagId, moderatorId, { status, actionTaken, resolution });

      const body: ApiResponse<FlagDto> = {
        success: true,
        data: flag,
        meta: { message: FLAG_MESSAGES.FLAG_RESOLVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof FlagNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, FLAG_ERRORS.FLAG_NOT_FOUND));
        return;
      }
      next(err);
    }
  },
};
