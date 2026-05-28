export const PROFILE_ERRORS = {
  ALREADY_EXISTS:       'A profile already exists for this account.',
  NOT_FOUND:            'Profile not found. Create your profile first.',
  PHOTO_LIMIT_EXCEEDED: 'You have reached the maximum of 6 photos.',
  INVALID_MIME_TYPE:    'Only JPEG, PNG, and WebP images are allowed.',
  NO_FILE_UPLOADED:     'No file was provided. Please attach an image.',
  FILE_TOO_LARGE:       'File size exceeds the 5 MB limit.',
} as const;

export const PROFILE_MESSAGES = {
  CREATED:        'Profile created successfully.',
  PHOTO_UPLOADED: 'Photo uploaded successfully.',
} as const;
