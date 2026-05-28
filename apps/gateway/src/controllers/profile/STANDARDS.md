# Profile Controller — Standards

## Purpose
HTTP handlers for all `/api/v1/profile` endpoints.

## Conventions
- Every handler is an `async` method on `profileController` object
- Validation is done upstream by `validateBody(schema)` middleware — never re-validate in the controller
- `req.user` is always set (requireAuth runs before all profile routes)
- Errors from `@abroad-matrimony/profile` services are caught here and mapped to HTTP status codes:
  - `ProfileAlreadyExistsError` → 409 CONFLICT
  - All others → `next(err)` (handled by global error middleware)
- Logging: `createChildLogger({ module: 'gateway:profile', requestId })`

## Anti-patterns
- ❌ No business logic in the controller (belongs in `libs/profile`)
- ❌ No direct Prisma/DB calls (only via `@abroad-matrimony/profile` service functions)
- ❌ No inline validation (use Zod schemas in `schemas/profile/`)
