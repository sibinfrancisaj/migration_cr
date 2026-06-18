# STANDARDS — controllers/prompts

## Purpose
HTTP layer for weekly prompts and resonate reactions — calls `@abroad-matrimony/prompts`, returns `ApiResponse`.

## Conventions
- `mapPromptError()` maps all 5 domain errors using `PROMPT_ERRORS` / `PROMPT_MESSAGES` constants
- `respond` returns 201; `resonate` / `unresonate` return 200 with `null` data
- Log with `createChildLogger({ module: 'gateway:prompts:<action>', requestId })`

## Anti-patterns
- Do NOT inline error message strings — all messages live in `prompts.constants.ts`
- Do NOT determine which prompt is active here — `getCurrentPrompt()` handles it
