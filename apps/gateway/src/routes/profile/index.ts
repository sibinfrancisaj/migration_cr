import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateParams } from '../../middleware/validate.middleware.js';
import { uploadSinglePhoto } from '../../middleware/upload.middleware.js';
import { createProfileSchema } from '../../schemas/profile/create-profile.schema.js';
import {
  realLifeAnswerParamsSchema,
  upsertRealLifeAnswerSchema,
} from '../../schemas/profile/upsert-real-life-answer.schema.js';
import {
  storyPromptParamsSchema,
  upsertStoryPromptSchema,
} from '../../schemas/profile/upsert-story-prompt.schema.js';
import { profileController } from '../../controllers/profile/profile.controller.js';
import { profileExtensionsController } from '../../controllers/profile/profile-extensions.controller.js';
import { voiceIntroUploadSchema, saveVoiceIntroSchema } from '../../schemas/profile/voice-intro.schema.js';

export const profileRouter = Router();

// POST /api/v1/profile — create profile for the authenticated user
profileRouter.post(
  '/',
  requireAuth,
  validateBody(createProfileSchema),
  profileController.create,
);

// GET /api/v1/profile/me — fetch own profile (must be before /:id routes)
profileRouter.get(
  '/me',
  requireAuth,
  profileController.getOwnProfile,
);

// PUT /api/v1/profile/real-life/:questionKey — upsert a real-life answer
profileRouter.put(
  '/real-life/:questionKey',
  requireAuth,
  validateParams(realLifeAnswerParamsSchema),
  validateBody(upsertRealLifeAnswerSchema),
  profileController.upsertRealLifeAnswer,
);

// PUT /api/v1/profile/story/:promptKey — upsert a story prompt answer
profileRouter.put(
  '/story/:promptKey',
  requireAuth,
  validateParams(storyPromptParamsSchema),
  validateBody(upsertStoryPromptSchema),
  profileController.upsertStoryPrompt,
);

// POST /api/v1/profile/media — upload a profile photo (multipart/form-data, field: "photo")
profileRouter.post(
  '/media',
  requireAuth,
  uploadSinglePhoto,
  profileController.uploadPhoto,
);

// PUT /api/v1/profile/pause — toggle profile visibility
profileRouter.put(
  '/pause',
  requireAuth,
  profileExtensionsController.togglePause,
);

// POST /api/v1/profile/voice-intro/upload-url — get presigned S3 URL for voice intro
profileRouter.post(
  '/voice-intro/upload-url',
  requireAuth,
  validateBody(voiceIntroUploadSchema),
  profileExtensionsController.getVoiceUploadUrl,
);

// POST /api/v1/profile/voice-intro — register uploaded voice intro
profileRouter.post(
  '/voice-intro',
  requireAuth,
  validateBody(saveVoiceIntroSchema),
  profileExtensionsController.saveVoiceIntro,
);
