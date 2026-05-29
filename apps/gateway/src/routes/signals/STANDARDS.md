# STANDARDS — routes/signals

## Purpose
Exposes engagement signal metrics under `/api/v1/signals`.
All routes require authentication.

## Route map
| Method | Path | Middleware chain |
|--------|------|-----------------|
| GET    | `/`  | requireAuth     |

## Conventions
- No request body or query params — signals are derived from the authenticated user's activity
- Returns a single `SignalDto` object with engagement metrics

## Anti-patterns
- Do NOT add query filtering here — signal aggregation lives in `libs/trust`
- Do NOT call Prisma directly from this file
