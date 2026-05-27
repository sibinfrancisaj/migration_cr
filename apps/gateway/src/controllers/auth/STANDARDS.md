# Auth Controllers Standards

## Purpose
HTTP layer for auth domain — parse validated request, call auth service/adapter, return ApiResponse.

## Conventions
- Controllers are plain objects with async methods: `export const otpController = { async requestOtp(...) {} }`
- Always wrap in `try/catch` and call `next(err)` on failure
- Log with `createChildLogger({ module: 'gateway:<action>', requestId: req.requestId })`
- Mask PII in logs: `phone.slice(0, 5) + '***'`
- Return `ApiResponse<T>` shape with `requestId: req.requestId` always
- Import `AppError` from `../../middleware/error.middleware.js`
- Import constants from `../../constants/index.js` and `../../constants/auth.constants.js`

## Example
```typescript
export const otpController = {
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body as OtpRequestBody;
      // ... call service
      res.status(HTTP_STATUS.OK).json({ success: true, data: { message: AUTH_MESSAGES.OTP_SENT }, requestId: req.requestId });
    } catch (err) {
      next(err);
    }
  },
};
```

## Anti-patterns
- Do NOT write `if/else` business logic here — it belongs in libs/auth service
- Do NOT call Prisma or Redis directly from a controller
- Do NOT import twilio or any external SDK here
- Do NOT validate request body here — use `validateBody` middleware
