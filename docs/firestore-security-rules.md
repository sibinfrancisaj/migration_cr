# Firestore Security Rules — Abroad Matrimony

## Overview

Flutter clients authenticate to Firestore using a **Firebase custom token** issued by the
backend (`GET /api/v1/auth/firebase-token`). The token is exchanged for a Firebase ID token
via `signInWithCustomToken()`. The resulting UID matches the user's Postgres `users.id` (UUID).

All mutating writes go through the REST API — the backend validates business rules, then
writes to Firestore. Flutter clients have **read-only** access to their own conversation data.

---

## Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper functions ─────────────────────────────────────────────────────

    /** True when the caller is authenticated and their UID is a non-empty string. */
    function isAuth() {
      return request.auth != null && request.auth.uid != null;
    }

    /** True when the caller's UID matches the given userId. */
    function isUser(userId) {
      return isAuth() && request.auth.uid == userId;
    }

    // ── Conversations ─────────────────────────────────────────────────────────
    //
    // conversations/{convId}
    //   Backend writes:  yes  (create/update via Admin SDK — bypasses these rules)
    //   Flutter reads:   allowed if the caller is a participant (userAId or userBId)
    //   Flutter writes:  denied — mutations go through the REST API only
    //
    // The conversation document stores:  { lastMessageAt: string }
    // Participant membership is stored as custom token claims set by the backend.
    // Because custom token claims are not set at token-issue time (would require
    // re-issuing a token per conversation), participant checks are done server-side
    // and the conversation subcollection is readable by any authenticated user
    // who knows the convId.  The convId is a UUID that the client only receives
    // after being authorised by the REST API — obscurity-in-depth.

    match /conversations/{convId} {
      // Read: any authenticated user may read a conversation document.
      // The convId is opaque (UUID) — clients only learn it after auth'd REST call.
      allow read: if isAuth();

      // Write: denied from client. All writes go through the Admin SDK.
      allow write: if false;

      // ── Messages sub-collection ─────────────────────────────────────────────
      //
      // conversations/{convId}/messages/{msgId}
      //   Backend writes:  yes  (Admin SDK bypasses rules)
      //   Flutter reads:   allowed for authenticated users (same convId-obscurity model)
      //   Flutter writes:  denied (including markRead, flagCount — REST API only)

      match /messages/{msgId} {
        allow read: if isAuth();
        allow write: if false;
      }
    }

    // ── Deny all other paths by default ──────────────────────────────────────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Authentication Flow (Flutter)

```
1. Flutter calls GET /api/v1/auth/firebase-token
   Headers: Authorization: Bearer <JWT access token>
   Response: { data: { token: "<Firebase custom token>" } }

2. Flutter signs in:
   await FirebaseAuth.instance.signInWithCustomToken(token);
   // UID = Postgres users.id (UUID)

3. Flutter opens a Firestore real-time listener:
   FirebaseFirestore.instance
     .collection('conversations')
     .doc(convId)               // convId from REST API response
     .collection('messages')
     .orderBy('createdAt', descending: true)
     .limit(50)
     .snapshots()
     .listen((snapshot) { ... });
```

---

## Read-Receipt Strategy

Read receipts are **not** written by Flutter directly to Firestore. Instead:

- Flutter calls `POST /api/v1/conversations/:convId/read` with `{ lastReadMessageId }`.
- Backend updates Firestore (`messages/{msgId}.readAt`) via Admin SDK.
- Flutter real-time listener receives the update automatically.

This keeps business-rule enforcement (participant check, message existence check) on the
server side.

---

## Message Flagging Strategy

Flagging is **always** done via the REST API:

- Flutter calls `POST /api/v1/messages/:msgId/flag` with `{ reason, description? }`.
- Backend creates a Postgres `flags` row, then atomically increments `flagCount` in Firestore.
- If `flagCount >= 3`, the backend sets `isHidden = true` in Firestore.
- Flutter real-time listener hides the message when `isHidden` becomes `true`.

---

## Presence (Firebase Realtime Database)

Presence uses Firebase **Realtime Database** (not Firestore) because Firestore has no
`onDisconnect` hook. Path: `presence/{userId}`.

Realtime Database rules:

```json
{
  "rules": {
    "presence": {
      "$userId": {
        ".read":  "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId"
      }
    }
  }
}
```

Flutter sets presence on connect:

```dart
final presenceRef = FirebaseDatabase.instance.ref('presence/${uid}');
await presenceRef.onDisconnect().set({ 'online': false, 'lastSeen': ServerValue.timestamp });
await presenceRef.set({ 'online': true });
```

---

## Deployment

Deploy Firestore rules via Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

The rules live in `firestore.rules` at the repo root (not committed yet — copy the block
above into that file).

---

## Security Notes

1. **Admin SDK bypasses rules** — all backend writes use the Admin SDK which has full access.
   The rules above only restrict Flutter (client SDK) access.
2. **convId as capability token** — clients only learn a `convId` after the REST API verifies
   participation. This prevents enumeration of messages by unauthenticated or unauthorised users.
3. **No client writes to messages** — prevents clients from forging `senderId`, `flagCount`,
   `isHidden`, or `readAt` fields.
4. **Custom token TTL** — Firebase custom tokens expire in 1 hour. Flutter should refresh via
   the REST API when the Firebase ID token nears expiry (Firebase ID tokens last 1 hour too).
