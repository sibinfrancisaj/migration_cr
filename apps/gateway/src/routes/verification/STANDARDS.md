# STANDARDS — routes/verification

## Purpose
Mounts identity verification routes under `/api/v1/verification`.
All routes require authentication.

## Route map
| Method | Path              | Middleware chain                                              |
|--------|-------------------|---------------------------------------------------------------|
| GET    | `/upload-url`     | requireAuth · validateQuery(verificationUploadUrlSchema)      |
| POST   | `/`               | requireAuth · validateBody(submitVerificationSchema)          |
| GET    | `/status`         | requireAuth                                                   |
| GET    | `/trust-score`    | requireAuth                                                   |

## Conventions
- `fileType` query param is validated as `id_document | selfie`
- `mimeType` query param validated as `image/jpeg | image/png | image/webp`
- `/upload-url` must appear before any future `/:id` routes to avoid shadowing

## Anti-patterns
- Do NOT call S3 or storage adapters in this file
- Do NOT skip `validateQuery` on the upload-url route
