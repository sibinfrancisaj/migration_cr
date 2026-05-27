import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { createProfileService, ProfileAlreadyExistsError } from '@abroad-matrimony/profile';
import type { ApiResponse, ProfileDto } from '@abroad-matrimony/shared';
import { AppError } from '../../middleware/error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../../constants/index.js';
import { PROFILE_ERRORS } from '../../constants/profile.constants.js';
import type { CreateProfileBody } from '../../schemas/profile/create-profile.schema.js';

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
};
