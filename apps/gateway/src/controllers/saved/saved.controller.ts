import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  listSavedProfiles,
  saveProfile,
  updateSavedProfile,
  unsaveProfile,
  compareSavedProfiles,
  SavedProfileNotFoundError,
  AlreadySavedError,
  SaveSelfError,
  ProfileNotSavedError,
} from '@abroad-matrimony/saved-profiles';
import type { ApiResponse } from '@abroad-matrimony/shared';
import { SavedProfileLabel } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { SAVED_ERRORS, SAVED_MESSAGES } from '../../constants/saved.constants.js';
import type {
  SaveProfileBody,
  SavedUserIdParams,
  UpdateSavedProfileBody,
  ListSavedQuery,
  AddNoteBody,
  CompareQuery,
} from '../../schemas/saved/saved.schema.js';

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapSavedError(err: unknown, next: NextFunction): void {
  if (err instanceof SavedProfileNotFoundError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, SAVED_ERRORS.NOT_FOUND));
    return;
  }
  if (err instanceof AlreadySavedError) {
    next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, SAVED_ERRORS.ALREADY_SAVED));
    return;
  }
  if (err instanceof SaveSelfError) {
    next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, SAVED_ERRORS.SAVE_SELF));
    return;
  }
  if (err instanceof ProfileNotSavedError) {
    next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, SAVED_ERRORS.PROFILE_NOT_SAVED));
    return;
  }
  next(err);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const savedController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:saved:list', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { label } = req.query as unknown as ListSavedQuery;

      log.info('List saved profiles', { userId, label });

      const saved = await listSavedProfiles(userId, label as SavedProfileLabel | undefined);

      const body: ApiResponse<typeof saved> = {
        success: true,
        data: saved,
        meta: { total: saved.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapSavedError(err, next);
    }
  },

  async save(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:saved:save', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { savedUserId, label, notes } = req.body as SaveProfileBody;

      log.info('Save profile', { userId, savedUserId });

      const dto = await saveProfile(userId, savedUserId, label as SavedProfileLabel, notes);

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: SAVED_MESSAGES.SAVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      mapSavedError(err, next);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:saved:update', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { savedUserId } = req.params as unknown as SavedUserIdParams;
      const updates = req.body as UpdateSavedProfileBody;

      log.info('Update saved profile', { userId, savedUserId });

      const dto = await updateSavedProfile(
        userId,
        savedUserId,
        { label: updates.label as SavedProfileLabel | undefined, notes: updates.notes },
      );

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: SAVED_MESSAGES.UPDATED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapSavedError(err, next);
    }
  },

  async unsave(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:saved:unsave', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { savedUserId } = req.params as unknown as SavedUserIdParams;

      log.info('Unsave profile', { userId, savedUserId });

      await unsaveProfile(userId, savedUserId);

      const body: ApiResponse<null> = {
        success: true,
        data: null,
        meta: { message: SAVED_MESSAGES.REMOVED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapSavedError(err, next);
    }
  },

  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:saved:addNote', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { savedUserId } = req.params as unknown as SavedUserIdParams;
      const { notes } = req.body as AddNoteBody;

      log.info('Add note to saved profile', { userId, savedUserId });

      const dto = await updateSavedProfile(userId, savedUserId, { notes });

      const body: ApiResponse<typeof dto> = {
        success: true,
        data: dto,
        meta: { message: SAVED_MESSAGES.NOTE_ADDED },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapSavedError(err, next);
    }
  },

  async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:saved:compare', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      const { ids } = req.query as unknown as CompareQuery;

      log.info('Compare saved profiles', { userId, ids });

      const results = await compareSavedProfiles(userId, ids);

      const body: ApiResponse<typeof results> = {
        success: true,
        data: results,
        meta: { total: results.length },
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      mapSavedError(err, next);
    }
  },
};
