# STANDARDS — routes/introductions

## Purpose
Mounts weekly intro-drop routes under `/api/v1/introductions`.
All routes require authentication.

## Route map
| Method | Path                      | Middleware chain                                              |
|--------|---------------------------|---------------------------------------------------------------|
| GET    | `/`                       | requireAuth                                                   |
| GET    | `/history`                | requireAuth · validateQuery(introHistoryQuerySchema)          |
| POST   | `/:introId/accept`        | requireAuth · validateParams(introIdParamSchema)              |
| POST   | `/:introId/decline`       | requireAuth · validateParams(introIdParamSchema)              |

## Conventions
- `/history` is a static path — must be defined before any `/:introId` routes
- `introId` is validated as a UUID
- `page` and `limit` use `z.coerce.number()` (query strings are always strings)

## Anti-patterns
- Do NOT add intro-scheduling logic here — that belongs in `libs/introductions`
