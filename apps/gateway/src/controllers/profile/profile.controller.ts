import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import {
  createProfileService,
  getOwnProfile,
  getProfileById,
  ProfileAlreadyExistsError,
  upsertRealLifeAnswer,
  upsertStoryPrompt,
  uploadProfilePhoto,
  ProfileNotFoundError,
  PhotoLimitExceededError,
  InvalidMimeTypeError,
} from '@abroad-matrimony/profile';
import type { ApiResponse, ProfileDto, RealLifeAnswerDto, StoryPromptAnswerDto, MediaDto } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PROFILE_ERRORS } from '../../constants/profile.constants.js';
import type { CreateProfileBody } from '../../schemas/profile/create-profile.schema.js';
import type {
  RealLifeAnswerParams,
  UpsertRealLifeAnswerBody,
} from '../../schemas/profile/upsert-real-life-answer.schema.js';
import type {
  StoryPromptParams,
  UpsertStoryPromptBody,
} from '../../schemas/profile/upsert-story-prompt.schema.js';
import type { ProfileIdParams } from '../../schemas/profile/get-profile.schema.js';

export const profileController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile', requestId: req.requestId });
    try {
      const {
        name,
        dateOfBirth,
        gender,
        currentCity,
        currentCountry,
        settlementIntent,
        bio,
      } = req.body as CreateProfileBody;

      // req.user is guaranteed present — requireAuth runs before this controller.
      const userId = req.user!.id;

      const profile = await createProfileService({
        userId,
        name,
        dateOfBirth,
        gender,
        currentCity,
        currentCountry,
        settlementIntent,
        bio,
      });

      log.info('Profile created', { userId, profileId: profile.id });

      const body: ApiResponse<ProfileDto> = {
        success: true,
        data: profile,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      if (err instanceof ProfileAlreadyExistsError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, PROFILE_ERRORS.ALREADY_EXISTS));
        return;
      }
      next(err);
    }
  },

  async upsertRealLifeAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:real-life', requestId: req.requestId });
    try {
      const { questionKey } = req.params as unknown as RealLifeAnswerParams;
      const { value }       = req.body   as UpsertRealLifeAnswerBody;
      const userId          = req.user!.id;

      const answer = await upsertRealLifeAnswer({ userId, questionKey, value });

      log.info('Real-life answer saved', { userId, questionKey });

      const body: ApiResponse<RealLifeAnswerDto> = {
        success: true,
        data: answer,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROFILE_ERRORS.NOT_FOUND));
        return;
      }
      next(err);
    }
  },

  async upsertStoryPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:story', requestId: req.requestId });
    try {
      const { promptKey } = req.params as unknown as StoryPromptParams;
      const { answer }    = req.body   as UpsertStoryPromptBody;
      const userId        = req.user!.id;

      const storyAnswer = await upsertStoryPrompt({ userId, promptKey, answer });

      log.info('Story prompt answer saved', { userId, promptKey });

      const body: ApiResponse<StoryPromptAnswerDto> = {
        success: true,
        data: storyAnswer,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROFILE_ERRORS.NOT_FOUND));
        return;
      }
      next(err);
    }
  },

  async getOwnProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:me', requestId: req.requestId });
    try {
      const userId = req.user!.id;

      const profile = await getOwnProfile(userId);

      log.info('Own profile fetched', { userId });

      const body: ApiResponse<ProfileDto> = {
        success: true,
        data: profile,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROFILE_ERRORS.NOT_FOUND));
        return;
      }
      next(err);
    }
  },

  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profile:media', requestId: req.requestId });
    try {
      const userId = req.user!.id;
      // req.file is guaranteed by uploadSinglePhoto middleware
      const { buffer, mimetype, originalname } = req.file!;

      const media = await uploadProfilePhoto({
        userId,
        buffer,
        mimeType: mimetype,
        filename: originalname,
      });

      log.info('Profile photo uploaded', { userId, mediaId: media.id });

      const body: ApiResponse<MediaDto> = {
        success: true,
        data: media,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.CREATED).json(body);
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROFILE_ERRORS.NOT_FOUND));
        return;
      }
      if (err instanceof PhotoLimitExceededError) {
        next(new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, PROFILE_ERRORS.PHOTO_LIMIT_EXCEEDED));
        return;
      }
      if (err instanceof InvalidMimeTypeError) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, PROFILE_ERRORS.INVALID_MIME_TYPE));
        return;
      }
      next(err);
    }
  },

  async getProfileById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:profiles:id', requestId: req.requestId });
    try {
      const { id } = req.params as unknown as ProfileIdParams;

      const profile = await getProfileById(id);

      log.info('Profile fetched by ID', { profileId: id });

      const body: ApiResponse<ProfileDto> = {
        success: true,
        data: profile,
        requestId: req.requestId,
      };
      res.status(HTTP_STATUS.OK).json(body);
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        next(new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, PROFILE_ERRORS.NOT_FOUND));
        return;
      }
      next(err);
    }
  },
};
