import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  getCurrentPrompt,
  respondToPrompt,
  getPromptResponses,
  resonateResponse,
  unresonateResponse,
  PromptNotFoundError,
  PromptResponseNotFoundError,
  AlreadyRespondedError,
  AlreadyResonatedError,
  ResonateNotFoundError,
} from '@abroad-matrimony/prompts';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { PromptResponseType } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PROMPT_ERRORS, PROMPT_MESSAGES } from '../../constants/prompts.constants.js';
import type {
  PromptIdParams,
  ResponseIdParams,
  RespondToPromptBody,
  PromptResponsesQuery,
} from '../../schemas/prompts/prompts.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapPromptError(err: unknown, next: NextFunction): void {
  if (err instanceof PromptNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROMPT_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof PromptResponseNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROMPT_ERRORS.RESPONSE_NOT_FOUND));
    return;
  }
  if (err instanceof AlreadyRespondedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, PROMPT_ERRORS.ALREADY_RESPONDED));
    return;
  }
  if (err instanceof AlreadyResonatedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, PROMPT_ERRORS.ALREADY_RESONATED));
    return;
  }
  if (err instanceof ResonateNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROMPT_ERRORS.RESONATE_NOT_FOUND));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const promptsController = {
  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:prompts:current', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      log.info('Get current prompt', { userId });

      const prompt = await getCurrentPrompt(userId);

      const body: ApiResponse<typeof prompt> = {
        success: true,
        data: prompt,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapPromptError(err, next);
    }
  },

  async respond(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:prompts:respond', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { promptId } = req.params as unknown as PromptIdParams;
      const { text, type, mediaUrl } = req.body as RespondToPromptBody;

      log.info('Respond to prompt', { userId, promptId });

      const dto = await respondToPrompt(userId, promptId, text, type as PromptResponseType, mediaUrl);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: PROMPT_MESSAGES.RESPONSE_SUBMITTED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapPromptError(err, next);
    }
  },

  async getResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:prompts:responses', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { promptId } = req.params as unknown as PromptIdParams;
      const { page, limit } = req.query as unknown as PromptResponsesQuery;

      log.info('Get prompt responses', { userId, promptId, page, limit });

      const result = await getPromptResponses(userId, promptId, page, limit);

      const body: ApiResponse<typeof result.responses> = {
        success: true,
        data: result.responses,
        meta: { total: result.total, page, limit },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapPromptError(err, next);
    }
  },

  async resonate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:prompts:resonate', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { responseId } = req.params as unknown as ResponseIdParams;

      log.info('Resonate with response', { userId, responseId });

      await resonateResponse(userId, responseId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: PROMPT_MESSAGES.RESONATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapPromptError(err, next);
    }
  },

  async unresonate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:prompts:unresonate', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { responseId } = req.params as unknown as ResponseIdParams;

      log.info('Remove resonate from response', { userId, responseId });

      await unresonateResponse(userId, responseId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: PROMPT_MESSAGES.RESONATE_REMOVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapPromptError(err, next);
    }
  },
};
