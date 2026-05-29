// Profile service
export {
  createProfileService,
  getOwnProfile,
  getProfileById,
  ProfileAlreadyExistsError,
} from './profile.service.js';
export type { CreateProfileInput } from './profile.service.js';

// Real-life answer service
export {
  upsertRealLifeAnswer,
  ProfileNotFoundError,
} from './real-life-answer.service.js';
export type { UpsertRealLifeAnswerInput } from './real-life-answer.service.js';

// Story prompt service
export {
  upsertStoryPrompt,
} from './story-prompt.service.js';
export type { UpsertStoryPromptInput } from './story-prompt.service.js';

// Media service
export {
  uploadProfilePhoto,
  PhotoLimitExceededError,
  InvalidMimeTypeError,
  MAX_PHOTOS_PER_USER,
} from './media.service.js';
export type { UploadProfilePhotoInput } from './media.service.js';

// Completion score helper
export { recalculateCompletionScore } from './score.service.js';

// Profile extensions (pause, voice intro)
export {
  toggleProfilePause,
  getVoiceIntroUploadUrl,
  saveVoiceIntro,
  VoiceIntroLimitError,
} from './extensions.service.js';
