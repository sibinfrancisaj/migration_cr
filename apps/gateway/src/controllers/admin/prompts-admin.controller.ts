import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listAdminPrompts,
  getAdminPrompt,
  createPrompt,
  updatePrompt,
  PromptAdminNotFoundError,
  PromptAlreadyExistsError,
} from '@abroad-matrimony/prompts';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';

const PROMPTS_ADMIN_ERRORS = {
  NOT_FOUND:     'Prompt not found',
  ALREADY_EXISTS: 'A prompt already exists for this week',
} as const;

function mapPromptAdminError(err: unknown, next: NextFunction): void {
  if (err instanceof PromptAdminNotFoundError)  { next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROMPTS_ADMIN_ERRORS.NOT_FOUND)); return; }
  if (err instanceof PromptAlreadyExistsError)  { next(new AppError(HTTP_STATUS.CONFLICT,  ERROR_CODES.CONFLICT,  PROMPTS_ADMIN_ERRORS.ALREADY_EXISTS)); return; }
  next(err);
}

export const promptsAdminController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:prompts:list', requestId: req.requestId });
    try {
      const { limit, cursor } = req.query as Record<string, string | undefined>;
      log.info('Admin list prompts');
      const result = await listAdminPrompts({ limit: limit ? Number(limit) : undefined, cursor });
      const body: ApiResponse<typeof result> = { success: true, data: result, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapPromptAdminError(err, next); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:prompts:get', requestId: req.requestId });
    try {
      const { promptId } = req.params;
      log.info('Admin get prompt', { promptId });
      const data = await getAdminPrompt(promptId);
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapPromptAdminError(err, next); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:prompts:create', requestId: req.requestId });
    try {
      log.info('Admin create prompt');
      const data = await createPrompt(
        req.body as Parameters<typeof createPrompt>[0],
        req.admin!.id,
        req.ip ?? '',
      );
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) { mapPromptAdminError(err, next); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:admin:prompts:update', requestId: req.requestId });
    try {
      const { promptId } = req.params;
      log.info('Admin update prompt', { promptId });
      const data = await updatePrompt(
        promptId,
        req.body as Parameters<typeof updatePrompt>[1],
        req.admin!.id,
        req.ip ?? '',
      );
      const body: ApiResponse<typeof data> = { success: true, data, requestId: req.requestId };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) { mapPromptAdminError(err, next); }
  },
};
