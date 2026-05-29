# STANDARDS — routes/habits

## Purpose
Mounts habit logging and streak routes under `/api/v1/habits`.
All routes require authentication.

## Route map
| Method | Path                        | Middleware chain                                                       |
|--------|-----------------------------|------------------------------------------------------------------------|
| GET    | `/`                         | requireAuth                                                            |
| POST   | `/:habitKey/log`            | requireAuth · validateParams(habitKeyParamSchema) · validateBody(...)  |
| DELETE | `/:habitKey/log/:date`      | requireAuth · validateParams(deleteHabitLogParamSchema)                |
| GET    | `/:habitKey/streak`         | requireAuth · validateParams(habitKeyParamSchema)                      |
| POST   | `/reflection`               | requireAuth · validateBody(habitReflectionSchema)                      |

## Conventions
- `habitKey` is validated as `HabitKey` enum; `date` validated as `YYYY-MM-DD` regex
- `/reflection` is a single-segment static path — safe before `/:habitKey` two-segment routes
- The `habitKey` for reflection is in the POST body (not the URL) — matches service API

## Anti-patterns
- Do NOT add date math or streak calculations here — that belongs in `libs/habits`
- Do NOT skip `validateParams` on routes that include `habitKey`
