# STANDARDS — routes/trust

## Purpose
Mounts block, unblock, and report routes under `/api/v1/trust`.
All routes require authentication.

## Route map
| Method | Path              | Middleware chain                                          |
|--------|-------------------|-----------------------------------------------------------|
| POST   | `/block`          | requireAuth · validateBody(blockUserSchema)              |
| DELETE | `/block/:userId`  | requireAuth · validateParams(userIdParamSchema)          |
| GET    | `/blocks`         | requireAuth                                              |
| POST   | `/report`         | requireAuth · validateBody(reportUserSchema)             |

## Conventions
- `userId` in DELETE path is validated as a UUID
- `reason` for block is optional free text; `reason` for report is a `FlagReason` enum (required)
- All paths are static or one-segment — no UUID param conflicts

## Anti-patterns
- Do NOT skip `validateBody` on block/report routes — prevents missing `userId`/`reason`
- Do NOT add trust-signal computation here — that belongs in `libs/trust`
