# Middleware Standards

## Purpose
Express middleware factories and handlers used across the gateway.

## Conventions
- Every middleware function has signature `(req, res, next): void`
- Error-throwing middleware calls `next(new AppError(...))` — never throws directly
- `validateBody(schema)` is the only place Zod validation happens — never inline in controllers
- `requestIdMiddleware` must be the first middleware registered in `app.ts`
- Middleware files are named `<purpose>.middleware.ts`

## Example
```typescript
// validate.middleware.ts
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', ...));
      return;
    }
    req.body = result.data;
    next();
  };
}
```

## Anti-patterns
- Do NOT validate request body inside a controller
- Do NOT import Zod schemas in controllers — use middleware
- Do NOT call `res.json()` inside middleware (except error/not-found handlers)
- Do NOT skip `next()` without calling `res.send()` — requests will hang
