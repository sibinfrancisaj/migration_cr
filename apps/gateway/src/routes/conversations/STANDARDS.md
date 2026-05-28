# STANDARDS — routes/conversations

## Purpose
Mounts GET conversation list, single conversation, and paginated message routes under
`/api/v1/conversations`. All routes require authentication.

## Route map
| Method | Path                              | Middleware chain                               |
|--------|-----------------------------------|------------------------------------------------|
| GET    | `/`                               | requireAuth                                    |
| GET    | `/:convId`                        | requireAuth · validateParams(convIdSchema)     |
| GET    | `/:convId/messages`               | requireAuth · validateParams · validateQuery   |

## Conventions
- `convId` is validated as a UUID at the route level before the controller runs
- `cursor` + `limit` are validated via `messagesQuerySchema` (limit 1–100, default 50)
- Route file is path + middleware only — zero business logic here

## Anti-patterns
- Do NOT add any logic to this file — all logic lives in the controller
- Do NOT skip `validateParams` for routes with path parameters
