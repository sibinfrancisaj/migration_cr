# Admin Controllers — Standards

## Purpose
Handle HTTP concerns for admin-facing endpoints: parse request body,
call a service from `libs/auth` or other libs, return `ApiResponse<T>`.

## Conventions
- Each controller is a plain object with async methods (`adminAuthController`, etc.)
- Zero business logic — delegate entirely to service layer
- Map domain errors (e.g. `AdminCredentialsError`) to `AppError` via `next(err)`
- Return `204 No Content` for mutations with no response body; `200` with `ApiResponse<T>` otherwise
- Use `createChildLogger({ module: 'gateway:admin-<action>', requestId })` per handler

## Example
```typescript
export const adminAuthController = {
  async login(req, res, next) {
    try {
      const result = await adminLoginService(req.body);
      res.status(200).json({ success: true, data: result, requestId: req.requestId });
    } catch (err) {
      if (err instanceof AdminCredentialsError) {
        next(new AppError(401, ERROR_CODES.UNAUTHORIZED, ADMIN_ERRORS.INVALID_CREDENTIALS));
        return;
      }
      next(err);
    }
  },
};
```

## Anti-patterns
- ❌ DB calls inside controllers — use the service layer
- ❌ Business logic (rate limiting counts, hash comparisons) inside controllers
- ❌ Returning different errors for wrong email vs wrong password (enables enumeration)
