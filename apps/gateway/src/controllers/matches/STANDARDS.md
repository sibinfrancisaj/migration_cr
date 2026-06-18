# STANDARDS — controllers/matches

## Purpose
HTTP layer for match-tuning preferences — calls `getMatchTuning()`/`setMatchTuning()` from `@abroad-matrimony/matching`.

## Conventions
- `get` returns the current tuning DTO; `set` updates weights and returns the updated DTO
- Both handlers forward all errors directly to `next(err)` — no domain-specific error classes yet
- Log with `createChildLogger({ module: 'gateway:matches:tuning:<action>', requestId })`
- Weights are a `Record<string, number>` — key is dimension name, value is 0.1–3.0

## Anti-patterns
- Do NOT validate weight ranges here — enforced by `setMatchTuningSchema` Zod `refine`
- Do NOT call the scoring algorithm directly — `setMatchTuning` triggers recomputation in the service
