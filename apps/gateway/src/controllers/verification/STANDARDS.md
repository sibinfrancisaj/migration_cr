# STANDARDS — controllers/verification

## Purpose
HTTP layer for identity verification — calls `@abroad-matrimony/verification`, returns `ApiResponse`.

## Conventions
- `mapVerificationError()` handles `VerificationAlreadySubmittedError` → 409 using `VERIFICATION_ERRORS` constants
- `getUploadUrl` passes `fileType` + `mimeType` from query; `submit` passes S3 keys from body
- Upload URL returns `{ uploadUrl, s3Key }` — client uploads to S3, then submits S3 keys to `/verification`
- Log with `createChildLogger({ module: 'gateway:verification:<action>', requestId })`

## Anti-patterns
- Do NOT call S3 SDK directly here — use `getVerificationUploadUrl()` from the lib
- Do NOT return raw S3 presigned URLs with credentials in error responses
