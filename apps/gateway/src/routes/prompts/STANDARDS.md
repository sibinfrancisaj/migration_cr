# STANDARDS — routes/prompts

## Purpose
Mounts weekly prompt and response routes under `/api/v1/prompts`.
All routes require authentication.

## Route map
| Method | Path                                  | Middleware chain                                                |
|--------|---------------------------------------|----------------------------------------------------------------|
| GET    | `/`                                   | requireAuth                                                    |
| POST   | `/:promptId/respond`                  | requireAuth · validateParams · validateBody                    |
| GET    | `/:promptId/responses`                | requireAuth · validateParams · validateQuery                   |
| POST   | `/responses/:responseId/resonate`     | requireAuth · validateParams(responseIdParamSchema)            |
| DELETE | `/responses/:responseId/resonate`     | requireAuth · validateParams(responseIdParamSchema)            |

## Conventions
- `/responses/:responseId/resonate` path has two static segments before the param — no collision with `/:promptId`
- `promptId` and `responseId` are both validated as UUIDs
- `page`/`limit` use `z.coerce.number()` on query schema

## Anti-patterns
- Do NOT hardcode prompt week logic here — that belongs in `libs/prompts`
