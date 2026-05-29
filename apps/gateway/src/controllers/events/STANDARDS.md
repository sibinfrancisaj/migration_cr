# STANDARDS — controllers/events

## Purpose
HTTP layer for gathering/event RSVP — calls `@abroad-matrimony/gatherings`, returns `ApiResponse`.

## Conventions
- `mapEventError()` maps domain errors using `EVENT_ERRORS` / `EVENT_MESSAGES` constants
- `rsvp` and `cancelRsvp` both return `null` data — no entity to return
- `attendees` includes `meta.total` for list count
- Log with `createChildLogger({ module: 'gateway:events:<action>', requestId })`

## Anti-patterns
- Do NOT inline error message strings — all messages live in `events.constants.ts`
- Do NOT call `getEventAttendees` without verifying auth — `requireAuth` is at the router level
