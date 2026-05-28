# STANDARDS — libs/messaging

## Purpose
Cloud-agnostic messaging adapter for real-time conversation data (text, image, voice).
Production store: Firebase Firestore. Dev/CI: in-memory mock (no credentials required).

## Conventions
- Services depend only on `MessagingAdapter` interface — never on a concrete class
- Use `getMessagingAdapter()` factory (lazy singleton); inject `MockMessagingAdapter` in tests
- `FirestoreMessagingAdapter` uses Firestore transactions for all counter updates (`flagCount`)
- All timestamps are ISO 8601 strings (not Firestore Timestamps) for portable DTOs
- `flagCount >= threshold` → auto-set `isHidden: true` atomically in the same transaction
- Pagination uses ISO timestamp cursor (`beforeCursor`) — newest-first order

## Firestore data structure
```
conversations/{convId}
  lastMessageAt: string (ISO)

conversations/{convId}/messages/{msgId}
  id, conversationId, senderId, type, content
  mediaUrl?, durationSeconds?, flagCount, isHidden, readAt, createdAt

users/{userId}/inbox/{convId}              ← written by send-message service
  conversationId, otherUserId, otherUserName,
  lastMessage, lastMessageAt, lastMessageType, unreadCount, isArchived

conversations/{convId}/typing/{userId}     ← Flutter client only; never touched by backend
  isTyping: bool, updatedAt: string

presence/{userId} [Realtime DB]            ← Flutter client + onDisconnect hooks
  online: bool, lastSeen: string
```

## Anti-patterns
- Do NOT import `FirestoreMessagingAdapter` directly in services — use the factory
- Do NOT use `firebase-admin` outside `libs/firebase` and `libs/messaging`
- Do NOT store Firestore Timestamps in MessageDto — always convert to ISO string
- Do NOT call `initFirebase()` inside adapter constructor — it is called in `server.ts`
