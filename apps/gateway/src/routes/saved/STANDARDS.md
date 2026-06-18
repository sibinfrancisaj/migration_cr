# STANDARDS — routes/saved

## Purpose
Mounts saved-profile shortlist routes under `/api/v1/saved`.
All routes require authentication.

## Route map
| Method | Path                  | Middleware chain                                                 |
|--------|-----------------------|------------------------------------------------------------------|
| GET    | `/`                   | requireAuth · validateQuery(listSavedQuerySchema)               |
| POST   | `/`                   | requireAuth · validateBody(saveProfileSchema)                   |
| PATCH  | `/:savedUserId`       | requireAuth · validateParams · validateBody                     |
| DELETE | `/:savedUserId`       | requireAuth · validateParams(savedUserIdParamSchema)            |

## Conventions
- `savedUserId` is a UUID validated at the route level
- `label` filter is optional and validated as `SavedProfileLabel` enum
- PATCH requires at least one field (enforced by Zod `refine` in `updateSavedProfileSchema`)

## Anti-patterns
- Do NOT skip `validateBody` on the PATCH route — empty updates must be rejected
