import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  flagMessage,
  MessageNotFoundError,
  AlreadyFlaggedError,
  FlagSelfError,
} from '@abroad-matrimony/messaging';
import type { FlagDto } from '@abroad-matrimony/messaging';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { FLAG_ERRORS, FLAG_MESSAGES } from '../../constants/flag.constants.js';
import type { FlagMessageBody } from '../../schemas/messages/flag.schema.js';

export const messagesController = {
  /**
   * POST /api/v1/messages/:msgId/flag
   *
   * Report a message for moderation.
   *
   * 404 if the message does not exist.
   * 409 if the caller already flagged this message, or is trying to flag
   *     their own message.
   */
  async flagMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:messages:flag', requestId: req.requestId });
    try {
      const reporterId = req.user!.id;
      const { msgId } = req.params as { msgId: string };
      const { reason, description } = req.body as FlagMessageBody;

      log.info('Flag message requested', { reporterId, msgId, reason });

      const flag = await flagMessage(reporterId, msgId, reason, description);

      const body: ApiResponse<FlagDto> = {
        success: true,
        data: flag,
        meta: { message: FLAG_MESSAGES.FLAG_CREATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      if (err instanceof MessageNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, FLAG_ERRORS.MESSAGE_NOT_FOUND));
        return;
      }
      if (err instanceof AlreadyFlaggedError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, FLAG_ERRORS.ALREADY_FLAGGED));
        return;
      }
      if (err instanceof FlagSelfError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, FLAG_ERRORS.FLAG_SELF));
        return;
      }
      next(err);
    }
  },
};
