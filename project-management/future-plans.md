# Abroad Matrimony — Future Plans & Additions

> Ideas, improvements, and work not yet scoped into the main phases.
> Each item has a rough priority and the phase it would slot into.

---

## Architecture & Infrastructure

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-001 | Redis Cluster / Redis Cloud for production         | High     | Currently using single local Redis; needs HA setup before prod |
| F-002 | Migrate from session pooler to Supabase direct URL | Medium   | DIRECT_URL currently on pooler (IPv4 constraint); upgrade when IPv6 available |
| F-003 | Rate limiter using Lua script (atomic INCR+EXPIRE) | Medium   | Current Redis rate limiter has minor TOCTOU window; Lua script closes it |
| F-004 | Distributed tracing across workers                | Low      | OTel spans currently gateway-only; extend to BullMQ workers |
| F-005 | Health check endpoint v2 (deep health)            | Low      | Current `/health` is shallow; add Redis, DB, and queue ping |
| F-006 | Kubernetes / Helm charts                          | Low      | Post-MVP; Docker Compose sufficient for now |

---

## Auth & Security

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-007 | Email OTP / magic link as fallback                | Medium   | Some users may not have a working phone for SMS |
| F-008 | IP-based rate limiting on OTP endpoint             | High     | Current limit is per-phone; add per-IP limit to prevent SIM enumeration |
| F-009 | Refresh token family invalidation (full tree)     | Medium   | ADR-005 covers reuse detection; full family tree is an enhancement |
| F-010 | TOTP setup flow for regular users (2FA)           | Low      | Currently only admin TOTP; could extend to power users |
| F-011 | Device trust elevation (trusted device flow)      | Low      | `devices.isTrusted` field exists; trust grant flow not yet designed |

---

## Profile & Matching

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-012 | Scoring algorithm v2 (ML-based or feedback-tuned) | Medium   | Feature-flagged in MATCH-005; design to follow after v1 data |
| F-013 | Profile "boost" feature (temporary visibility bump)| Low     | Requires diamond spend; design with PAY team |
| F-014 | Partner preference filters (age range, city, etc.)| High     | Discovery feed currently score-only; filters needed for UX |
| F-015 | Profile photo ordering / reordering               | Medium   | `media.order` field exists; drag-and-drop reorder API needed |
| F-016 | Voice intro / video intro playback                | Low      | `MediaType.VOICE_INTRO` and `VIDEO_INTRO` exist in schema |
| F-049 | pgvector ANN discovery feed (replace pre-computed MatchScore) | High | `ProfileEmbedding` + pgvector already live. For new users with no stored scores, fall back to live cosine similarity ANN query against `profile_embeddings`. Fastest wins: no cold-start problem for new joiners. See RAG note below. |
| F-050 | Semantic group suggestions via embedding similarity | Medium | `listSuggestedGroups()` currently ranks by country + memberCount. Query group description embeddings against user profile embedding for topic-aware suggestions (e.g. finance professional → Professional/Finance group). |
| F-051 | Richer "Why this match" using RAG context        | Medium   | `generateWhyThisMatchLLM()` currently uses score breakdown only. Pull top-3 semantically similar ProfileEmbedding dimensions as grounding context into the GPT prompt → more natural, less formulaic explanations. |
| F-052 | Profile similarity search admin tool             | Low      | Admin endpoint: given a userId, return top-N most embedding-similar users. Useful for QA, moderation (find fake-profile clusters), and debugging match quality. |

---

## Groups & Engagement

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-017 | Check-in streak tracking + rewards                | Medium   | Sunday check-ins exist; streak bonus on scoring is a future hook |
| F-018 | Group chat (broadcast from admin)                 | Low      | Not the same as 1-1 messaging; admin → group member notifications |
| F-019 | Event RSVP reminders (push + email)               | Medium   | `EventRsvp` model exists; reminder job not yet designed |

---

## Notifications

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-020 | Notification preferences per user                 | Medium   | Currently no user-level channel opt-out; needs preferences table |
| F-021 | Email unsubscribe link + one-click opt-out         | High     | Legal / CAN-SPAM requirement before sending marketing emails |
| F-022 | In-app notification bell / badge count             | Medium   | `NotificationChannel.IN_APP` exists; read/unread API needed |

---

## Payments

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-023 | Subscription renewal reminders (3d / 1d before)  | High     | BullMQ job triggered on `expiresAt` |
| F-024 | Promo codes / discount system                     | Low      | Stripe coupons or custom code table |
| F-025 | Revenue analytics (MRR, churn, LTV)               | Medium   | Admin dashboard ADMIN-007 will include; needs aggregation queries |

---

## Admin & Ops

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-026 | Admin panel frontend (React)                      | Medium   | Backend API (Phase 8) must be done first |
| F-027 | Automated DB backups + point-in-time restore      | High     | Supabase has this; verify it's enabled on project |
| F-028 | Canary deployments via feature flags              | Low      | `allowedEnvironments` in FeatureFlag already supports this pattern |
| F-029 | GDPR data export + account deletion flow          | High     | Legal requirement; `deletedAt` soft-delete field exists in `users` |

---

## Messaging (future enhancements beyond MVP)

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-033 | Message "delivered to device" status              | Medium   | MVP has sent + read only. Delivered = FCM delivery receipt. Add `deliveredAt` to Firestore message doc + Prisma `messages` table. |
| F-034 | Message reactions (emoji)                         | Low      | Add `reactions: Map<emoji, userId[]>` to Firestore message doc. |
| F-035 | Message editing + edit history                    | Low      | `editedAt`, `editHistory[]` on Firestore doc. Show "edited" label. |
| F-036 | Message deletion (unsend)                         | Medium   | Soft-delete: `deletedAt` + `isDeleted: true` in Firestore. Show "[Message removed]". |
| F-037 | Video message type                                | Low      | S3 upload → Firestore URL + thumbnail + duration. `MessageType.VIDEO` already in schema. |
| F-038 | Message search within conversation                | Low      | Firestore has no full-text search. Use Algolia or Typesense fed by Cloud Function trigger. |
| F-039 | Bulk message export (GDPR / DPDPA)               | High     | Admin triggers export → Firestore query + S3 ZIP → email user. Legal requirement. |
| F-040 | End-to-end encryption                             | Low      | Signal Protocol or Virgil Security. Large scope. Key exchange at match creation. |

---

## Calls (future module — libs/calling)

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-041 | Voice call — Twilio Programmable Voice            | Medium   | `libs/calling` with `CallingAdapter` interface. Token minted server-side. |
| F-042 | Video call — Daily.co or Agora                    | Medium   | Daily.co simplest API; Agora lower latency for South/Southeast Asia. |
| F-043 | Call duration logging + diamond charge            | Low      | Log start/end in Postgres. Charge diamonds per minute via DiamondLedger. |
| F-044 | Call recording (both-party consent required)      | Low      | Both users must opt in. S3 storage. Admin-access only. |

---

## Moderation (future enhancements beyond MVP flag system)

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-045 | Automated image moderation                        | High     | Google Vision API SafeSearch before S3 store. Reject LIKELY/VERY_LIKELY explicit. |
| F-046 | Automated text/voice moderation                   | Medium   | Google Perspective API for toxic text. Voice → Whisper transcription → Perspective. |
| F-047 | User safety score dashboard (admin)               | High     | Per-user: total flags received, unique reporters, open/resolved breakdown. |
| F-048 | Repeat-offender auto-escalation                   | Medium   | X flags in Y days → auto-`SUSPENDED_REVIEW` status. Currently manual only. |

---

## pgvector / RAG Architecture Note (added 2026-07-27)

> Reference: Using PostgreSQL as a Vector Database for RAG (Nitin Prodduturi, Medium)
> Verdict: **The infrastructure is already in place. RAG-style features are low-effort additions.**

### What we already have
- `pgvector 0.8.5` extension live in local Docker Postgres (and Supabase)
- `ProfileEmbedding` model — 1536-dim `text-embedding-3-small` vector per user
- `libs/ai` — `generateProfileIntelligence()` writes embeddings; BullMQ 60s-debounce job keeps them fresh
- `pairing.service.ts` — already does pgvector cosine similarity ANN queries for intro drop matching

### What the article describes that we don't have yet
The article describes **RAG for Q&A** — retrieving semantically similar document chunks to ground an LLM answer. We don't need Q&A, but the same vector retrieval pattern applies to our use cases.

### Recommended additions (in priority order)

#### 1. Cold-start discovery via ANN (F-049) — HIGH priority
**Problem:** New users have no `MatchScore` rows → discovery feed is empty for days until BullMQ batch-computes pairs.
**Fix:** In `getDiscoveryFeed()`, when stored scores < 10 for a user, fall back to a live pgvector query:
```sql
SELECT user_id, 1 - (embedding <=> $1::vector) AS similarity
FROM profile_embeddings
WHERE user_id != $2
ORDER BY embedding <=> $1::vector
LIMIT 20;
```
This is one SQL query. No new infrastructure. Eliminates cold-start entirely.

#### 2. Semantic group suggestions (F-050) — MEDIUM priority
**Problem:** `listSuggestedGroups()` uses country + memberCount only — no semantic relevance.
**Fix:** Store a 1536-dim embedding for each Group (from its name + description). ANN query at suggestion time. Groups whose description embedding is closest to the user's profile embedding rank first.

#### 3. Richer "Why this match" (F-051) — MEDIUM priority
**Problem:** `generateWhyThisMatchLLM()` only sends the numeric score breakdown as context. GPT has to invent the narrative.
**Fix:** Fetch both users' `ProfileEmbedding.summary` (150-word AI summary already generated). Pass as grounding context in the system prompt. Result is grounded in actual profile content, not just numbers.

#### 4. Admin similarity search (F-052) — LOW priority
One-liner admin endpoint using the same ANN pattern. Useful for spotting fake-profile clusters (similar embeddings + no organic activity = bot signals).

### Implementation effort estimate
| Feature | New code | Complexity |
|---------|----------|------------|
| F-049 Cold-start ANN | ~30 lines in `discover.service.ts` | Low |
| F-050 Group suggestions | ~40 lines + one Prisma migration for Group embedding | Medium |
| F-051 Why-this-match context | ~10 lines in `generateWhyThisMatchLLM()` | Very low |
| F-052 Admin similarity search | ~20 lines + 1 route | Low |

---

## Technical Debt

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-030 | Add `project.json` NX configs per lib/app         | Low      | Currently NX infers from package.json; explicit configs give more control |
| F-031 | Replace `yarn.lock` leftover with npm-only setup  | Low      | `yarn.lock` still in repo alongside `package-lock.json` after conversion |
| F-032 | Per-package jest configs (vs single root config)  | Low      | Root jest.config works; per-package configs enable `nx affected` for tests |
