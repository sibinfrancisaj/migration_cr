# Auth Routes Standards

## Purpose
Declare auth endpoint paths, HTTP methods, and middleware chains. Zero business logic.

## Conventions
- One file per auth sub-domain (otp, token, session, etc.)
- Pattern: `router.<method>('<path>', ...middlewares, controller.method)`
- Public routes (OTP request/verify): no `requireAuth` middleware
- Protected routes (token refresh, logout): add `requireAuth` before controller
- Zod validation always via `validateBody(schema)` — never inline

## Example
```typescript
router.post('/otp/request', validateBody(otpRequestSchema), otpController.requestOtp);
router.post('/otp/verify',  validateBody(otpVerifySchema),  otpController.verifyOtp);
```

## Anti-patterns
- Do NOT write any conditional logic in route files
- Do NOT import Prisma, Redis, or any lib service directly
- Do NOT call `res.json()` here — that is the controller's job
