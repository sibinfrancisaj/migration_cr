# STANDARDS — controllers/conversations

## Purpose
HTTP handlers for conversation list, single conversation, and paginated message history.
All three endpoints require authentication — `requireAuth` runs before every handler.

## Conventions
- Read `req.user!.id` — guaranteed present by `requireAuth`
- `ConversationNotFoundError` → 404; `ConversationForbiddenError` → 403
- Error mapping is centralised in `mapMessagingError()` — keep catch blocks to a single call
- Pagination meta (`cursor`, `hasMore`) lives in `ApiResponse.meta`
- `cursor` is an opaque ISO timestamp string — never parse or generate it here

## Example response (list)
```json
{
  "success": true,
  "data": [{ "conversationId": "...", "otherUser": { "userId": "...", "name": "Alice", "photoUrl": null }, "lastMessageAt": null, "unreadCount": 0, "isArchived": false, "createdAt": "..." }],
  "meta": { "hasMore": false, "total": 1 },
  "requestId": "abc-123"
}
```

## Anti-patterns
- Do NOT call Prisma or `@abroad-matrimony/db` directly — all data access via service layer
- Do NOT compute unreadCount here — it comes from the service (MSG-004 will fill it)
- Do NOT parse the `cursor` string — pass it through opaquely to the service
