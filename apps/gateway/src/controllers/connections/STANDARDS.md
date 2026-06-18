# STANDARDS — controllers/connections

## Purpose
HTTP layer for connection requests — parse validated request, call `@abroad-matrimony/connections`, return `ApiResponse<ConnectionDto>`.

## Conventions
- Private `mapConnectionError()` translates domain errors to `AppError` using `CONNECTION_ERRORS` constants
- All handlers log with `createChildLogger({ module: 'gateway:connections:<action>', requestId })`
- Never call Prisma or Redis directly; all data access is through `libs/connections`
- Return `HTTP_STATUS.CREATED` (201) for `send`; `HTTP_STATUS.OK` (200) for all others

## Example
```typescript
export const connectionsController = {
  async send(req, res, next) {
    try {
      const dto = await sendConnectionRequest(req.user!.id, req.body.receiverId, req.body.message);
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: dto, requestId: req.requestId });
    } catch (err) { mapConnectionError(err, next); }
  },
};
```

## Anti-patterns
- Do NOT duplicate the self-connect check here — the service throws `ConnectionAlreadyExistsError`
- Do NOT import `@abroad-matrimony/db` or `@abroad-matrimony/cache` directly
