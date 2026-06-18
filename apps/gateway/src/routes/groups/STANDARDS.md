# STANDARDS — routes/groups

## Purpose
Mounts group discovery and membership routes under `/api/v1/groups`.
All routes require authentication.

## Route map
| Method | Path                      | Middleware chain                                         |
|--------|---------------------------|----------------------------------------------------------|
| GET    | `/`                       | requireAuth · validateQuery(listGroupsQuerySchema)       |
| GET    | `/:groupId`               | requireAuth · validateParams(groupIdParamSchema)         |
| POST   | `/:groupId/join`          | requireAuth · validateParams(groupIdParamSchema)         |
| DELETE | `/:groupId/leave`         | requireAuth · validateParams(groupIdParamSchema)         |
| GET    | `/:groupId/members`       | requireAuth · validateParams(groupIdParamSchema)         |
| GET    | `/:groupId/events`        | requireAuth · validateParams(groupIdParamSchema)         |

## Conventions
- `groupId` is validated as a UUID at the route level
- `country`/`region` are optional free-text filters (max 100 chars each)

## Anti-patterns
- Do NOT embed group membership logic here — it lives in `groupsController`
- Do NOT skip `validateParams` for routes with `:groupId`
