export const VERIFICATION_ERRORS = {
  ALREADY_SUBMITTED: 'A verification request is already pending or under review',
  NOT_FOUND: 'Verification request not found',
  INVALID_FILE_TYPE: 'Invalid file type for verification document',
} as const;

export const VERIFICATION_MESSAGES = {
  SUBMITTED: 'Verification request submitted successfully',
  UPLOAD_URL_GENERATED: 'Upload URL generated',
} as const;
