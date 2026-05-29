# STANDARDS — controllers/trust

## Purpose
HTTP layer for block/unblock/report — calls `@abroad-matrimony/trust`, returns `ApiResponse`.

## Conventions
- `mapTrustError()` maps domain errors using `TRUST_ERRORS` / `TRUST_MESSAGES` constants
- `block` and `report` return the DTO; `unblock` returns `null` data
- `report` uses `FlagReason` enum from `@abroad-matrimony/shared` for reason casting
- Log with `createChildLogger({ module: 'gateway:trust:<action>', requestId })`

## Anti-patterns
- Do NOT inline error message strings — all messages live in `trust.constants.ts`
- Do NOT allow self-block/self-report through — enforced by `BlockSelfError`/`ReportSelfError` domain errors
