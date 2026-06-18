# STANDARDS — routes/connections

## Purpose
Mounts connection request CRUD routes under `/api/v1/connections`.
All routes require authentication.

## Route map
| Method | Path                              | Middleware chain                                         |
|--------|-----------------------------------|----------------------------------------------------------|
| POST   | `/`                               | requireAuth · validateBody(sendConnectionSchema)         |
| GET    | `/`                               | requireAuth · validateQuery(listConnectionsQuerySchema)  |
| PUT    | `/:connectionId/accept`           | requireAuth · validateParams(connectionIdParamSchema)    |
| PUT    | `/:connectionId/decline`          | requireAuth · validateParams(connectionIdParamSchema)    |
| DELETE | `/:connectionId`                  | requireAuth · validateParams(connectionIdParamSchema)    |

## Conventions
- `connectionId` is validated as a UUID at the route level before the controller runs
- `status` query param is validated as `ConnectionStatus` enum
- `requireAuth` is applied once at the router level — not per route

## Anti-patterns
- Do NOT add conditional logic to this file — logic belongs in `connectionsController`
- Do NOT skip `validateParams` for routes with `:connectionId`
