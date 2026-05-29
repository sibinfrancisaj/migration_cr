# STANDARDS — routes/events

## Purpose
Mounts gathering/event RSVP routes under `/api/v1/events`.
All routes require authentication.

## Route map
| Method | Path                      | Middleware chain                                          |
|--------|---------------------------|-----------------------------------------------------------|
| GET    | `/`                       | requireAuth · validateQuery(listEventsQuerySchema)        |
| GET    | `/:eventId`               | requireAuth · validateParams(eventIdParamSchema)          |
| POST   | `/:eventId/rsvp`          | requireAuth · validateParams(eventIdParamSchema)          |
| DELETE | `/:eventId/rsvp`          | requireAuth · validateParams(eventIdParamSchema)          |
| GET    | `/:eventId/attendees`     | requireAuth · validateParams(eventIdParamSchema)          |

## Conventions
- `eventId` is validated as a UUID
- `tag` query param is validated as `EventTag` enum (optional)
- RSVP creation is POST, RSVP cancellation is DELETE — both share `/:eventId/rsvp`

## Anti-patterns
- Do NOT skip `validateParams` for routes with `:eventId`
- Do NOT add capacity-check logic here — enforced in `libs/gatherings`
