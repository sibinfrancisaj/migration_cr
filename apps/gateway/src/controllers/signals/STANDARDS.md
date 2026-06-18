# STANDARDS — controllers/signals

## Purpose
HTTP layer for engagement signal read — calls `getSignals()` from `@abroad-matrimony/trust`, returns `ApiResponse`.

## Conventions
- Single handler: `get` — no write operations
- Import and use `HTTP_STATUS.OK` — never use raw numeric literals
- Log with `createChildLogger({ module: 'gateway:signals', requestId })`
- All errors forwarded directly to `next(err)` — no domain-specific error classes

## Anti-patterns
- Do NOT inline `res.status(200)` — always use `HTTP_STATUS.OK`
- Do NOT add query filtering here — signal computation is internal to `libs/trust`
