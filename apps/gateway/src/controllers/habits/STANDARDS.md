# STANDARDS — controllers/habits

## Purpose
HTTP layer for habit logging and streaks — calls `@abroad-matrimony/habits`, returns `ApiResponse`.

## Conventions
- `mapHabitError()` handles `HabitLogNotFoundError` → 404 and `HabitAlreadyLoggedError` → 409 using `HABIT_ERRORS`
- `logDate` is normalized to midnight UTC in the controller before passing to the service
- `habitKey` URL param is validated as `HabitKey` enum before reaching the controller
- Log with `createChildLogger({ module: 'gateway:habits:<action>', requestId })`

## Anti-patterns
- Do NOT compute streaks in this controller — delegate entirely to `getHabitStreak()`
- Do NOT accept ISO datetime strings for `logDate` — only `YYYY-MM-DD` format (enforced by schema)
