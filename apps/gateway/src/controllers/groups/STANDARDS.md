# STANDARDS — controllers/groups

## Purpose
HTTP layer for group discovery and membership — parse validated request, call `@abroad-matrimony/groups`, return `ApiResponse`.

## Conventions
- Private `mapGroupError()` translates domain errors to `AppError` using `GROUP_ERRORS` constants
- All handlers log with `createChildLogger({ module: 'gateway:groups:<action>', requestId })`
- `join` and `leave` return `null` data with a message — no entity to return
- `members` and `events` include `meta.total` for list responses

## Example
```typescript
export const groupsController = {
  async join(req, res, next) {
    try {
      await joinGroup(req.params.groupId, req.user!.id);
      res.status(HTTP_STATUS.OK).json({ success: true, data: null, meta: { message: GROUP_MESSAGES.JOINED }, requestId: req.requestId });
    } catch (err) { mapGroupError(err, next); }
  },
};
```

## Anti-patterns
- Do NOT call `getGroupMembers` without passing `userId` — access control is enforced in the service
- Do NOT return group access type or invite codes in list responses
