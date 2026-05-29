# STANDARDS — controllers/introductions

## Purpose
HTTP layer for weekly intro drops — calls `@abroad-matrimony/introductions`, returns `ApiResponse`.

## Conventions
- `mapIntroError()` maps domain errors to `AppError` using `INTRODUCTION_ERRORS` / `INTRODUCTION_MESSAGES` constants
- `list` returns this week's intros; `history` is paginated with `page`/`limit`
- Log with `createChildLogger({ module: 'gateway:introductions:<action>', requestId })`

## Anti-patterns
- Do NOT determine the current week key here — use `getWeekKey()` in `libs/introductions`
- Do NOT inline error message strings — all messages live in `introductions.constants.ts`
