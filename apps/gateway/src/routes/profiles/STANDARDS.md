# STANDARDS — routes/profiles

## Purpose
Public profile lookup routes under `/api/v1/profiles`.
All routes require authentication. Static sub-routes (e.g. `/compare`) must be registered before `/:id` to avoid Express path shadowing.

## Route map
| Method | Path                    | Middleware chain                                                  |
|--------|-------------------------|-------------------------------------------------------------------|
| POST   | `/:id/view`             | requireAuth · validateParams(profileIdParamsSchema)              |
| GET    | `/:id/match-context`    | requireAuth · validateParams(profileIdParamsSchema)              |
| GET    | `/:id`                  | requireAuth · validateParams(profileIdParamsSchema)              |

Routes added via profile router (not here):
- `GET /profile/match-tuning/impact` — must be before `/match-tuning`
- `GET /profile/match-tuning`, `POST /profile/match-tuning`
- `PUT /profile/privacy-controls`, `POST/DELETE /profile/pause-visibility`
- `GET /profile/access-levels`

## Conventions
- All `id` path params are UUIDs validated by `profileIdParamsSchema`
- `POST /:id/view` is idempotent — deduplication logic is in the service layer
- Static routes registered BEFORE `/:id` to avoid shadowing

## Anti-patterns
- Do NOT add business logic to this router; delegate to controller → service
- Do NOT reorder: `/:id/view`, `/:id/match-context` must come before `/:id`
