# Profile Routes — Standards

## Purpose
Express router mounted at `/api/v1/profile`.

## Conventions
- Each route: path + middleware chain only — zero logic
- Middleware chain order: `requireAuth` → `validateBody(schema)` → `controller.method`
- All profile routes require authentication (`requireAuth` must appear first)
- Role restriction (`requireRole`) added when a route requires a specific tier (e.g., FOUNDING_MEMBER)

## Anti-patterns
- ❌ No inline business logic (belongs in `libs/profile`)
- ❌ No direct DB calls
- ❌ No conditional middleware (handle in controller or service)
