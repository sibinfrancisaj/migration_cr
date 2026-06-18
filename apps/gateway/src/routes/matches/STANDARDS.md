# STANDARDS — routes/matches

## Purpose
Mounts match-tuning preference routes under `/api/v1/matches`.
All routes require authentication.

## Route map
| Method | Path       | Middleware chain                                        |
|--------|------------|--------------------------------------------------------|
| GET    | `/tuning`  | requireAuth                                            |
| PUT    | `/tuning`  | requireAuth · validateBody(setMatchTuningSchema)       |

## Conventions
- Weight keys are free-form strings (algorithm dimension names); values are 0.1–3.0
- At least one weight key is required on PUT (enforced by Zod `refine`)
- Weights are clamped to [0.1, 3.0] in both schema and service layer

## Anti-patterns
- Do NOT compute scores here — use `libs/matching`
- Do NOT allow empty weights object — schema `refine` must reject it
