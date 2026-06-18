# STANDARDS — controllers/saved

## Purpose
HTTP layer for saved-profile shortlist — calls `@abroad-matrimony/saved-profiles`, returns `ApiResponse`.

## Conventions
- `mapSavedError()` maps domain errors using `SAVED_ERRORS` / `SAVED_MESSAGES` constants
- `save` returns 201; `list`, `update`, `unsave` return 200
- `update` passes only `label`/`notes` — caller cannot update `savedUserId`
- Log with `createChildLogger({ module: 'gateway:saved:<action>', requestId })`

## Anti-patterns
- Do NOT inline error message strings — all messages live in `saved.constants.ts`
- Do NOT cast label enum in the controller — pass it typed via the schema
