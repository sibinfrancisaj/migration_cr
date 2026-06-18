# Abroad Matrimony — System Architecture

> **Maintained by:** Claude (acting as Senior Cloud Architect)
> **Last updated:** 2026-05-27
> **Update this file** whenever: a new lib is added, an ADR is made, a data flow changes, a security pattern is introduced.

---

## 1. System Context (C4 Level 1)

```
                        ┌─────────────────────────────────────────────┐
                        │            ABROAD MATRIMONY                  │
                        │                                              │
  Mobile / Web  ──────► │  apps/gateway        (port 3000)            │
  Client App            │  Public REST API                            │
                        │                                              │
  Admin Browser ──────► │  apps/admin-api      (port 3001)            │
                        │  Admin REST API  [PHASE 8e — 17 tasks]      │
                        │                                              │
  Dev/Staging   ──────► │  apps/seeder         (port 3100)            │
  Only                  │  Automated Data Seeder [PHASE 8a]           │
                        │  ⚠️  Never runs in production               │
                        └──────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────────────┐
              │                │                        │
              ▼                ▼                        ▼
        ┌──────────┐    ┌──────────┐           ┌──────────────┐
        │ Supabase │    │  Redis   │           │ BullMQ       │
        │ Postgres │    │  Cache + │           │ Workers      │
        │ +pgvector│    │  Queue   │           │ (matching,   │
        │   (DB)   │    │          │           │  notif, AI,  │
        └──────────┘    └──────────┘           │  seeder)     │
              │                                └──────────────┘
   ┌──────────┼───────────────────────────────────────────────┐
   │          │               External Services               │
   ▼          ▼          ▼          ▼          ▼       ▼      │
Twilio    Brevo     Firebase    AWS S3    Stripe/  OpenAI    │
Verify    Email      Push       Media    Razorpay  (gpt-4o-  │
  OTP    300/day   Notif.      Store    Payments   mini +    │
                                                  Whisper)   │
```

---

## 2. Container Architecture (C4 Level 2)

### apps/gateway — Public API

> Follows mikesparr/enterprise-api-starter-nodejs layered architecture.
> Route → Controller → Service → Data. Each layer has exactly one responsibility.

```
apps/gateway/src/
├── server.ts               Entry point. Bootstraps app, Redis, event-bus, OTel, SIGTERM handler.
├── app.ts                  Express setup: request-id → helmet → cors → compression →
│                           body parser → global rate-limit → routes → 404 → error handler.
├── routes/
│   ├── index.ts            Mounts all routers. Path definitions + middleware chains only.
│   ├── health.route.ts     GET /api/v1/health
│   ├── auth/
│   │   ├── index.ts        POST /api/v1/auth/* (Phase 2)
│   │   └── STANDARDS.md
│   └── profile/            (Phase 3)
│       └── STANDARDS.md
│
├── controllers/            HTTP handlers. Parse req → call service → send ApiResponse.
│   ├── auth/
│   │   ├── otp.controller.ts
│   │   └── STANDARDS.md
│   └── profile/
│       └── STANDARDS.md
│
├── schemas/                Zod validation schemas. Used by validateBody() middleware.
│   └── auth/
│       └── otp-request.schema.ts
│
├── middleware/
│   ├── request-id.middleware.ts   X-Request-ID — runs first, before everything
│   ├── auth.middleware.ts         requireAuth — verify JWT, attach req.user
│   ├── rbac.middleware.ts         requireRole / requireAdminRole
│   ├── validate.middleware.ts     validateBody(schema) factory
│   ├── error.middleware.ts        AppError → ApiResponse, catch-all 500
│   ├── not-found.middleware.ts
│   └── STANDARDS.md
│
├── api-docs/               OpenAPI 3.0 specs (built out end of Phase 2)
│   ├── index.yaml
│   ├── paths/
│   └── schemas/
│
└── constants/
    ├── index.ts            HTTP_STATUS, ERROR_CODES
    ├── auth.constants.ts   AUTH_ERRORS, AUTH_MESSAGES  (Phase 2)
    └── profile.constants.ts (Phase 3)
```

### libs/ — Internal Libraries

| Library | Role | Key exports |
|---------|------|-------------|
| `shared` | Zero-dep types, enums, constants | `ApiResponse`, `JwtPayload`, `CLOUD_EVENT_TYPES`, `CACHE_KEYS` |
| `config` | Env validation + feature flags | `getEnv()`, `FeatureFlagService` |
| `logger` | Structured logging + tracing | `createChildLogger()`, `initTracer()` |
| `db` | Prisma client singleton | `getPrismaClient()` |
| `cache` | Redis helpers | `cacheGet/Set/Del/IncrBy/Expire/Exists`, `getRedisClient()` |
| `event-bus` | CloudEvents + WAL publish | `publish()`, `initEventBus()`, `shutdownEventBus()` |
| `auth` | OTP, JWT, RBAC, magic link, trusted device *(Phase 2+6b)* | `sendOtp()`, `issueTokenPair()`, `requireAuth`, `requireRole()`, `sendMagicLink()`, `trustedDeviceLoginService()` |
| `matching` | Scoring algorithm + discovery + tuning *(Phase 4)* | `computeScore()`, `getDiscoveryFeed()`, `getMatchTuning()`, `setMatchTuning()` |
| `notification` | Multi-channel dispatch *(Phase 6)* | `enqueueNotification()`, `createNotificationWorker()` |
| `payment` | Stripe + Razorpay + diamond ledger *(Phase 7)* | `createMembershipCheckout()`, `spendDiamonds()`, `getDiamondBalance()` |
| `storage` | S3 upload + CloudFront *(Phase 3)* | `uploadFile()`, `getSignedUrl()`, `getPublicUrl()` |
| `messaging` | Firestore messaging + FCM *(Phase 5)* | `listConversations()`, `sendMessage()`, `createFirebaseToken()`, `flagMessage()` |
| `firebase` | Firebase Admin SDK singleton *(Phase 5)* | `initFirebase()`, `getFirestoreDb()`, `getFirebaseAuth()`, `isFirebaseConfigured()` |
| `connections` | Connection request flow *(Phase 7b stub)* | `sendConnectionRequest()`, `acceptConnection()`, `declineConnection()` |
| `groups` | Group membership + social feed *(Phase 7b stub → Phase 8c full revamp)* | `joinGroup()`, `leaveGroup()`, `listSuggestedGroups()`, `createPost()` |
| `gatherings` | Events + RSVP *(Phase 7b)* | `listEvents()`, `rsvpToEvent()`, `cancelRsvp()`, `getEventAttendees()` |
| `verification` | ID doc verification + trust score *(Phase 7b)* | `submitVerification()`, `getTrustScore()`, `getVerificationUploadUrl()` |
| `habits` | Habit logging + streak computation *(Phase 7b)* | `logHabit()`, `getHabitStreak()`, `computeStreaks()` |
| `introductions` | Weekly intro drops → IntroductionDrop *(Phase 7b stub → Phase 8d revamp)* | `listDropsForUser()`, `acceptIntroduction()`, `earlyAccessDrop()` |
| `prompts` | Weekly prompts + resonate *(Phase 7b)* | `getCurrentPrompt()`, `respondToPrompt()`, `resonateResponse()` |
| `saved-profiles` | Profile shortlist *(Phase 7b)* | `listSavedProfiles()`, `saveProfile()`, `updateSavedProfile()` |
| `trust` | Block/unblock/report/signals *(Phase 7b)* | `blockUser()`, `reportUser()`, `getSignals()` |
| `profile` | Profile + extensions + voice intro *(Phase 3+7b)* | `createProfile()`, `toggleProfilePause()`, `saveVoiceIntro()` |
| `ai` | OpenAI intelligence layer *(Phase 8b — NEW)* | `generateProfileIntelligence()`, `proposeIntroductionDrops()`, `transcribeVoiceIntro()`, `generateEventPreConnections()` |

---

## 3. Key Data Flows

### 3.1 Phone OTP Auth Flow (AUTH-001 + AUTH-002)

```
Client                Gateway              libs/auth          Redis          DB (users)
  │                      │                     │                │                │
  │ POST /otp/request     │                     │                │                │
  │ { phone }            │                     │                │                │
  ├─────────────────────►│                     │                │                │
  │                      │ 1. Zod E.164 validate                │                │
  │                      │ 2. checkAndIncrOtpRateLimit(phone)   │                │
  │                      │────────────────────►│ INCR am:otp:attempts:+phone     │
  │                      │                     │───────────────►│                │
  │                      │                     │ if count==1: EXPIRE 3600s       │
  │                      │                     │───────────────►│                │
  │                      │    {allowed, ttl}   │                │                │
  │                      │◄────────────────────│                │                │
  │                      │ if !allowed → 429   │                │                │
  │                      │ 3. sendOtp(phone)   │                │                │
  │                      │────────────────────►│ Twilio Verify API (or mock log) │
  │                      │                     │                │                │
  │ 200 { message, expiresInSeconds: 600 }     │                │                │
  │◄─────────────────────│                     │                │                │
  │                      │                     │                │                │
  │ POST /otp/verify     │                     │                │                │
  │ { phone, code, fingerprint }               │                │                │
  ├─────────────────────►│                     │                │                │
  │                      │ 1. Zod validate     │                │                │
  │                      │ 2. verifyOtp(phone, code)            │                │
  │                      │────────────────────►│ Twilio check / mock             │
  │                      │ 3. prisma.user.upsert(phone)         │               │
  │                      │──────────────────────────────────────────────────────►│
  │                      │                     │                │   {user, wasCreated} │
  │                      │◄──────────────────────────────────────────────────────│
  │                      │ 4. if wasCreated → publish USER_REGISTERED event     │
  │                      │ 5. issueTokenPair(user)              │                │
  │                      │────────────────────►│ store hash in Redis + DB        │
  │ 200 { accessToken, refreshToken, user }    │                │                │
  │◄─────────────────────│                     │                │                │
```

### 3.2 JWT Refresh Token Rotation (AUTH-003)

```
Client          Gateway         Redis (am:rt:<id>)    DB (refresh_tokens)
  │                │                    │                       │
  │ POST /token/refresh                 │                       │
  │ { refreshToken }                   │                       │
  ├───────────────►│                   │                       │
  │                │ 1. JWT verify (sig + expiry)              │
  │                │ 2. Check Redis: does hash exist?          │
  │                │────────────────►  │                       │
  │                │ hash NOT found → revoke all (reuse attack)│
  │                │ hash found → delete (revoke used token)   │
  │                │────────────────►  │                       │
  │                │ 3. Issue new pair                         │
  │                │ 4. Store new hash in Redis + DB           │
  │                │────────────────►  │──────────────────────►│
  │ 200 { accessToken, refreshToken }  │                       │
  │◄───────────────│                   │                       │
```

### 3.3 CloudEvent Publish Flow

```
Route handler
     │
     │  await publish('com.abroadmatrimony.user.registered', { phone, userId })
     ▼
libs/event-bus/publisher.ts
     │  Push to walBuffer (in-memory array)
     │
     ├── if walBuffer.length >= 50  ─────► flushWal()
     │                                           │
     └── setInterval(500ms)  ─────────────────► flushWal()
                                                 │
                                    BullMQ.addBulk(events)
                                                 │
                                           Redis queue
                                                 │
                                    [future BullMQ worker processes]
```

### 3.4 Feature Flag Evaluation

```
Request handler
     │  featureFlagService.isEnabled('new-algo', { userId })
     ▼
libs/config/feature-flags.ts
     │  1. Check Redis cache (am:ff:<key>) — TTL 5 min
     │     HIT  → return cached flag
     │     MISS → query DB (feature_flags table)
     │             → cache result
     │             → evaluate: enabled? rollout%? userId allowlist? env allowlist?
     └─► boolean result
```

---

## 4. Database Design

### Schema principles
- All PKs are UUID (`@default(uuid())`)
- Soft deletes via `deletedAt DateTime?` on `users` — never hard-delete users
- `diamond_ledger` is append-only (no UPDATEs) — `balanceAfter` is the running total
- All monetary values in integer paise/cents — no floats ever
- `event_logs` stores a record of every published CloudEvent (idempotency key = `cloudEventId`)

### Table groups

```
Identity          users (+ isSeeded), devices, refresh_tokens, admin_users
Profile           profiles (+ isSeeded, voiceIntroTranscript), real_life_answers,
                  story_prompt_answers, media
AI Intelligence   profile_embeddings (pgvector — userId, summary, traitTags,
                  vibeScores, embedding vector(1536), recommendedContactWindow)
Groups            groups (+ type, scope, parentGroupId, memberCount, isSeeded),
                  group_memberships (+ joinedVia),
                  group_posts (+ isSeeded), group_post_comments, group_post_likes,
                  group_proposals
Matching          match_scores, connections, matches
Introductions     introduction_drops (NEW — themed batches with AI metadata),
                  introductions (+ dropId, viewedEarlyAt, unlockedEarlyAt)
Messaging         conversations, messages, flags
Engagement        habits, habit_logs, check_ins, events, event_rsvps,
                  weekly_prompts, prompt_responses, prompt_resonates,
                  saved_profiles, blocks, reports
Verification      verification_requests
Payments          memberships, payment_intents, diamond_ledger
Platform          feature_flags, system_config (NEW — key-value admin settings),
                  notifications, audit_logs, event_logs
```

### New models added in DB-MIGRATION-001 (Phase 8 prerequisite)

| Model | Purpose | Key fields |
|-------|---------|------------|
| `ProfileEmbedding` | AI personality analysis + vector | `userId PK`, `summary`, `traitTags String[]`, `vibeScores Json`, `embedding vector(1536)`, `recommendedContactWindow Json?` |
| `IntroductionDrop` | Themed intro batch | `name`, `criteria Json`, `memberPool String[]`, `releaseAt`, `status`, `proposedByAI`, `earlyAccessCost`, `unlockCost` |
| `GroupPost` | Group social feed post | `groupId`, `authorId`, `text?`, `imageUrl?`, `linkUrl?`, `isPinned`, `likesCount`, `isSeeded` |
| `GroupPostComment` | Flat comment on post | `postId`, `authorId`, `text` |
| `GroupPostLike` | Like reaction | composite PK `[postId, userId]` |
| `GroupProposal` | Member-proposed interest group | `proposedByUserId`, `name`, `status (PENDING\|APPROVED\|REJECTED)` |
| `SystemConfig` | Admin-configurable platform settings | `key String PK`, `value String`, e.g. `SUGGESTED_GROUPS_MAX: "20"` |

### New columns added in DB-MIGRATION-001

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `users` | `isSeeded` | `Boolean @default(false)` | Marks synthetic seeder users |
| `profiles` | `isSeeded` | `Boolean @default(false)` | Marks synthetic seeder profiles |
| `profiles` | `voiceIntroTranscript` | `String?` | Whisper-transcribed voice intro text |
| `groups` | `type` | `GroupType` enum | REGIONAL/CULTURAL/PROFESSIONAL/INTEREST |
| `groups` | `scope` | `GroupScope` enum | COUNTRY/GLOBAL |
| `groups` | `parentGroupId` | `String?` | Hierarchy (city → country) |
| `groups` | `country` | `String?` | For REGIONAL groups |
| `groups` | `city` | `String?` | For city-level REGIONAL groups |
| `groups` | `professionTag` | `String?` | For PROFESSIONAL groups |
| `groups` | `culturalTag` | `String?` | For CULTURAL groups |
| `groups` | `memberCount` | `Int @default(0)` | Denormalized for performance |
| `groups` | `isSeeded` | `Boolean @default(false)` | Marks system/seeder-created groups |
| `group_memberships` | `joinedVia` | `JoinedVia` enum | AUTO/ONBOARDING/HOME_FEED/SEARCH/MANUAL |
| `introductions` | `dropId` | `String?` | FK to `IntroductionDrop` |
| `introductions` | `viewedEarlyAt` | `DateTime?` | Stamped on diamond VIEW spend |
| `introductions` | `unlockedEarlyAt` | `DateTime?` | Stamped on diamond UNLOCK spend |

### Index strategy
Every FK has an index. Additional indexes:
- `users`: phone (unique), email (unique), role, createdAt
- `match_scores`: userAId, userBId, totalScore
- `notifications`: userId, status, createdAt
- `audit_logs`: adminUserId, entity+entityId, createdAt

---

## 5. Architecture Decision Records

### ADR-001 · NX Monorepo
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** Multiple services (gateway, admin-api, workers) + shared libs.
**Decision:** NX workspace, all code in one repo, libs as internal packages via TS path aliases.
**Consequences:** NX `affected` in CI keeps build times fast. Single `package.json` for all deps.

---

### ADR-002 · CloudEvents + BullMQ WAL
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** Need decoupled event delivery without external message broker cost at this stage.
**Decision:** In-memory WAL buffer, flushed every 500ms or 50 events to BullMQ (Redis-backed). Workers process asynchronously.
**Consequences:** Sub-second latency for event processing. No Kafka/SQS cost. Risk: events lost if Redis crashes without AOF — mitigated by enabling Redis AOF in production.

---

### ADR-003 · Two Supabase Connection URLs
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** PgBouncer transaction mode (port 6543) breaks Prisma prepared statements.
**Decision:** `DATABASE_URL` = transaction pooler + `?pgbouncer=true` (disables prepared statements for runtime). `DIRECT_URL` = session pooler (port 5432, used by Prisma Migrate only).
**Consequences:** Migrations are slightly slower (session mode) but correct. Runtime queries are fast via connection pool.

---

### ADR-004 · Feature Flags — No 3rd Party
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** LaunchDarkly costs $$$; needs are modest at MVP stage.
**Decision:** Custom `FeatureFlagService` reading from `feature_flags` table, Redis-cached 5 min.
**Consequences:** No SDK cost. Admin panel Phase 8 will add toggle UI. Rollout % is hash-bucketed by userId for deterministic assignment.

---

### ADR-005 · JWT Refresh Token Rotation + Reuse Detection
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** Standard JWT refresh has no protection against token theft.
**Decision:** Every refresh token is one-time-use. On use: revoke old before issuing new. On presented-already-revoked: nuclear option — revoke ALL devices for that user.
**Consequences:** Slightly more Redis round-trips on refresh. Provides strong token theft detection. User experience: if token is stolen and used by attacker first, victim gets logged out everywhere — this is intentional (security over convenience).

---

### ADR-006 · Diamond Ledger Append-Only
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** Credits/virtual currency require an immutable audit trail.
**Decision:** `diamond_ledger` table has INSERT only. Each row: `delta` (±), `balanceAfter`, `reason`. Current balance = MAX(createdAt).balanceAfter.
**Consequences:** No balance corruption from concurrent UPDATEs. Full history for support. Slightly more complex balance queries (mitigated by caching).

---

### ADR-007 · Integer Money (Paise/Cents)
**Date:** 2026-05-01 | **Status:** Accepted

**Context:** Floating-point arithmetic is wrong for money.
**Decision:** All monetary amounts stored as integers. INR in paise (1 ₹ = 100p), USD in cents. Display layer divides by 100.
**Consequences:** No floating-point rounding bugs. Consistent with Stripe/Razorpay API which also use integer smallest-unit amounts.

---

### ADR-008 · USER_REGISTERED Event Deferred to OTP Verification
**Date:** 2026-05-27 | **Status:** Accepted

**Context:** Original plan was to fire `USER_REGISTERED` in AUTH-001 (OTP request) for first-time phones.
**Problem:** User row doesn't exist yet at that point. If AUTH-002 verify fails, the event is false. Downstream consumers (analytics, welcome email) would act on a non-existent user.
**Decision:** Fire `USER_REGISTERED` in AUTH-002 immediately after `prisma.user.upsert()` confirms `wasCreated === true`.
**Consequences:** Cleaner event semantics. No false events. Slightly later analytics signal (at verify, not at request) — acceptable trade-off.

---

### ADR-013 · Automated Data Seeding Service (`apps/seeder`)
**Date:** 2026-05-29 | **Status:** Accepted

**Context:** The platform has complex matching logic, weekly intro drops, group membership, and AI-driven features. Testing all of these requires a large, realistic, continuously-updated user base — not a one-time DB seed.

**Decision:** Create `apps/seeder` as an independent NX application (alongside `apps/gateway`) with:
- Its own Express HTTP server (port 3100) for the control API
- BullMQ workers for scheduled drip + activity simulation
- Hard environment guard: refuses to start if `NODE_ENV === production`
- `isSeeded: Boolean` flag on `User`, `Profile`, `Group`, `GroupPost` — enables clean flush at any time
- `SEEDER_SECRET` token for gateway auth bypass (never enabled in production)

**Consequences:** Dev/staging always has 500+ realistic profiles with match scores, group memberships, and activity history. Manual and automated testing is meaningful from day one. The `SEEDER_SECRET` middleware must be strictly guarded from production deployment — enforced by env check.

---

### ADR-014 · SEEDER_SECRET Gateway Auth Bypass
**Date:** 2026-05-29 | **Status:** Accepted

**Context:** The seeder needs to perform actions as synthetic users (create profiles, join groups, send connections). Going through the full OTP + device auth flow for 500+ synthetic users would require real phone numbers and complicate test infrastructure.

**Decision:** A new gateway middleware checks `Authorization: Bearer <token>` before `requireAuth`. If the token equals the `SEEDER_SECRET` env var, it decodes a simple `{ userId, role }` payload from the token and sets `req.user` directly, bypassing JWT verification entirely. If `NODE_ENV === production`, this middleware is a no-op.

**Consequences:** Clean test infrastructure with no fake phone numbers. Security risk is mitigated by: (1) production no-op, (2) `SEEDER_SECRET` never in production `.env`, (3) token is a shared secret (not a signed JWT). Seeder can impersonate any synthetic user.

---

### ADR-015 · Four-Type Group Taxonomy
**Date:** 2026-05-29 | **Status:** Accepted

**Context:** The original `Group` model was a simple stub. As the platform grows, groups serve four distinct purposes with different join rules, visibility, and capabilities. A single undifferentiated model creates confusion and wrong defaults.

**Decision:** Single `Group` model with `type: GroupType` enum (`REGIONAL | CULTURAL | PROFESSIONAL | INTEREST`) and `scope: GroupScope` enum (`COUNTRY | GLOBAL`):

| Type | Auto-join | Member visible | Social feed | Events | Intro pool |
|------|-----------|----------------|-------------|--------|------------|
| REGIONAL (country) | ✅ on register | ✅ | ✅ Full | ✅ | ✅ Fallback |
| REGIONAL (city) | ❌ suggested | ✅ | ✅ Full | ✅ | ✅ Primary |
| CULTURAL | ❌ suggested | ✅ | ✅ Posts | ❌ | ✅ High-signal |
| PROFESSIONAL | ❌ suggested | ✅ | ✅ Posts | ✅ | ✅ Primary |
| INTEREST | ❌ manual | ✅ | ✅ Full | ✅ | ✅ Event connect |

All group types: member list visible to all members; initiating a direct conversation from a group costs diamonds.

**Consequences:** Type-driven behaviour reduces conditional logic throughout the codebase. `scope: GLOBAL` is DB-provisioned but not surfaced in UI yet — enables future global professional channels. Group hierarchy uses `parentGroupId` (flat with self-reference — Option A).

---

### ADR-016 · IntroductionDrop Model — Replacing WeekKey Cap
**Date:** 2026-05-29 | **Status:** Accepted

**Context:** The original introduction system was capped at ~1 introduction per user per week via `weekKey`. This prevents multi-themed drops (IT professionals + new joiners + event-based) from coexisting and limits the platform's ability to serve diverse matching contexts.

**Decision:** Introduce `IntroductionDrop` model as the "themed category" layer above individual `Introduction` pairings:
- `IntroductionDrop`: name, criteria (JSON), memberPool (String[] of candidate userIds), releaseAt, status, AI-proposal metadata, early-access cost in diamonds
- `Introduction`: gains `dropId FK`, `viewedEarlyAt`, `unlockedEarlyAt`
- No weekly cap — a user can be in multiple drops simultaneously
- AI picks 3–5 best matches from the drop's pool for each individual recipient (personalised, not same for everyone)
- Early access tiered: spend diamonds to VIEW intro cards early (still locked) → spend more to UNLOCK full profile early

**Consequences:** Intro count per user is bounded by AI curation quality, not a hard DB cap. Admin workflow: AI proposes DRAFT drops → admin approves → pairing generation runs. Monetisation: two diamond spend touchpoints per drop (view + unlock). Event-based pre-connection drops are auto-approved (no admin bottleneck for time-sensitive events).

---

### ADR-017 · AI Integration — OpenAI + pgvector for Profile Intelligence
**Date:** 2026-05-29 | **Status:** Accepted

**Context:** Demographic-only matching (age, profession, caste) is necessary but insufficient. Indian diaspora matrimony requires understanding cultural values, communication style, life pace, and personality vibe — dimensions that don't fit in structured DB fields.

**Decision:** `libs/ai` wraps three OpenAI APIs:
1. **gpt-4o-mini (completions)** — generates semantic profile summary, trait tags, vibe scores (warmth/ambition/tradition/socialEnergy/openness 1–10), and AI intro drop group proposals
2. **text-embedding-3-small (embeddings)** — generates 1536-dim vector for each profile summary; stored in `ProfileEmbedding.embedding` via Supabase pgvector
3. **Whisper (transcription)** — transcribes voice introductions; text feeds back into profile intelligence

pgvector cosine similarity is used to: (1) refine AI-proposed intro groups (flag outliers), (2) rank candidates within a drop's pool for each recipient.

AI is always optional: `isAiConfigured()` returns false when `OPENAI_API_KEY` is absent → all AI paths become no-ops; system falls back to match score ranking.

**Consequences:** Profile intelligence runs asynchronously via BullMQ (never on the request path). 60-second debounce prevents redundant recomputes on rapid updates. Cost: gpt-4o-mini is ~15× cheaper than gpt-4o; text-embedding-3-small is ~5× cheaper than ada-002. Expected cost per profile update: < $0.001.

---

### ADR-018 · ProfileView Model for Explicit View Logging
**Date:** 2026-06-02 | **Status:** Accepted

**Context:** The Signals Dashboard (Phase 14) requires per-user daily and weekly profile view counts for momentum charts, weekly metrics, and action-queue "complete your profile" nudges. The existing `Profile` model has no view tracking.

**Decision:** New `ProfileView` model: `{ id, viewerId, viewedId, viewedAt }`. Composite indexes on `[viewedId, viewedAt]` and `[viewerId, viewedAt]` for efficient time-range counts.

View logging is **explicit**: Flutter client calls `POST /api/v1/profiles/:id/view` when a user genuinely views a profile card. This avoids counting admin fetches, bot traffic, or repeat refreshes. Service-layer deduplication: same viewer/viewed pair within 1 hour → no new row (prevents spam).

**Consequences:** Slightly more client complexity (client must fire the POST), but better signal quality. The 1-hour deduplication window is configurable as a constant. `ProfileView` table grows at O(DAU × avg_views_per_session) — at 10k DAU with 5 views/session: ~50k rows/day, manageable. Old rows can be pruned after 90 days.

---

### ADR-019 · Trust Score — 6-Layer Composite (Phase 15)
**Date:** 2026-06-02 | **Status:** Accepted

**Context:** The original trust spec referenced third-party work/education verification services. These are out of scope for MVP. A trust score is still needed to signal profile credibility to other users.

**Decision:** 6 layers, all achievable without third-party services:

| Layer | Points | Data source |
|-------|--------|-------------|
| PHONE_VERIFIED | 20 | `User.isPhoneVerified` |
| PROFILE_COMPLETE | 20 | `Profile.completionScore >= 80` |
| PHOTO_UPLOADED | 15 | `Media.count(userId) > 0` |
| ID_VERIFIED | 25 | `Profile.verificationStatus == APPROVED` (admin-reviewed) |
| EMAIL_VERIFIED | 10 | `User.isEmailVerified` |
| VOICE_INTRO | 10 | `Profile.voiceIntroTranscript != null` |

Score is computed and persisted to `Profile.trustScore` on every `GET /api/v1/trust` call (not on a background job) — keeps the displayed score always fresh.

Privacy settings stored as `Profile.privacySettings Json?` (partial-merge semantics) rather than individual columns — avoids repeated schema migrations as visibility controls evolve.

**Consequences:** Work/education verification can be added as future layers (25 pts each) without changing the score structure. The `Profile.trustScore` column serves as a denormalized cache used in ALG-009 (trust layer depth matching dimension).

---

### ADR-020 · Algorithm v2 — Optional Dimensions + Tuning Application (Phase 16)
**Date:** 2026-06-02 | **Status:** Accepted

**Context:** The Phase 4 scoring engine has 9 core dimensions. Phases 9, 12, and 16 add habits, prompt resonance, and 5 new v2 dimensions. The `MatchTuning` model (Phase 7b) stored per-user dimension weight multipliers but they were never applied to the discover feed.

**Decision:**

**Dimension architecture:** All new dimensions are **opt-in** — they only contribute to the score when *both* users have the relevant data. When a new dimension is present, a corresponding fraction of the total weight allocation is reserved and the core 9 dimensions scale down proportionally. This keeps `totalScore ∈ [0, 1]` and maintains full backward compatibility.

Weight budget by phase:
```
Core (9 dims):     1.00  (baseline)
HABIT-008:        -0.05  → coreScale 0.95
PROMPT-007:       -0.02  → coreScale 0.93
v2 dims (max 5):  -0.10  → coreScale min 0.83
```

**Tuning application:** `MatchTuning` weights are now applied at **query time** (in `getDiscoveryFeed`), not at score-compute time. `applyTuningToBreakdown(breakdown, weights)` takes a stored `ScoreBreakdown` and computes a personalised total by applying dimension multipliers and renormalising to sum-to-1. The canonical `totalScore` in the DB is unchanged — only the `personalizedScore` field in `DiscoveryItemDto` reflects tuning.

**Simplified tuning UI (ALG-011):** `POST /api/v1/profile/match-tuning` accepts `{ settlementImportance, familyImportance }` (1–5 ratings). Importance ratings map to multipliers: 1→0.5, 2→0.75, 3→1.0, 4→1.75, 5→2.5. Stored in the existing `MatchTuning` model under `settlementIntent` and `familyInvolvement` keys.

**Consequences:** Personalized re-ranking is within-page only (the DB cursor pagination is still ordered by `totalScore`). Full global re-ranking would require applying tuning at the DB query layer (e.g. stored function) — deferred to a future phase. Tuning changes trigger a background BullMQ full rescore job (ALG-013) to update the stored `totalScore` with new dimension data over time.

---

## 6. Security Architecture

### Middleware order of operations (fixed — do not reorder)

```
1.  X-Request-ID middleware    ← attach tracing ID before anything else
2.  Helmet                     ← security headers
3.  CORS                       ← allowlist check
4.  compression                ← gzip/brotli (60-80% payload reduction at scale)
5.  express.json()             ← parse body
6.  global rate-limit          ← coarse IP/global throttle (100 req/min)
    --- route-level middleware below ---
7.  authenticate               ← verify JWT, attach req.user / req.admin
8.  validateParams             ← path + query params (fast fail before DB hit)
9.  authorize                  ← RBAC: requireRole / requireAdminRole
10. validateBody(schema)       ← Zod schema on request body
11. controller                 ← execute handler
12. error middleware           ← catch-all → AppError → ApiResponse
13. not-found middleware       ← 404 fallback
```

### Defence layers

```
Internet → Cloudflare/CDN (DDoS, WAF) [future]
         → X-Request-ID (traceability)
         → Helmet (security headers)
         → CORS allowlist
         → express-rate-limit (global: 100 req/min/IP)
         → Route-level Redis rate-limit (e.g. OTP: 3/hr/phone)
         → Zod validation (all request bodies)
         → requireAuth JWT middleware (protected routes)
         → requireRole / requireAdminRole RBAC
         → 404 before 403 (resource existence checked before permission)
         → Prisma parameterised queries (no SQL injection)
         → Supabase Row Level Security [future — currently using service role]
```

### Secrets management
- All secrets in `.env` (gitignored)
- Never log tokens, passwords, or full phone numbers
- bcrypt cost factor ≥ 12 for admin passwords
- JWT secrets: minimum 32 chars, generated as 64-char hex

### OTP security
- 6-digit code via Twilio Verify (Twilio manages generation, storage, expiry)
- Rate-limited: 3 requests per phone per hour (Redis)
- Future: add per-IP rate limit as secondary guard (see F-008 in future-plans.md)

### Admin security
- Separate `ADMIN_JWT_SECRET` from user JWT
- TOTP (speakeasy) required when `isTotpEnabled = true`
- All admin mutations write to `audit_logs` table

---

## 7. Caching Strategy

| Key pattern | Content | TTL | Invalidation |
|-------------|---------|-----|--------------|
| `am:ff:<key>` | Feature flag value | 5 min | On admin toggle |
| `am:otp:attempts:<phone>` | OTP request count | 1 hour (sliding per first request) | Natural expiry |
| `am:rt:<tokenId>` | Refresh token hash | 30 days | On use or logout |
| `am:profile:<userId>` | Profile DTO | 10 min | On profile update |
| `am:scores:<userId>` | Match scores | 24 hours | On score recompute |
| `am:rl:<key>` | General rate-limit counter | Window-based | Natural expiry |

---

## 8. Observability

### Logging
- **Library:** Winston via `libs/logger`
- **Dev:** colorised simple format (human-readable)
- **Prod:** structured JSON (ingested by log aggregator)
- **Module label:** every logger uses `createChildLogger({ module: 'gateway:auth' })`
- **Sensitive data:** phone numbers masked as `+9198****`, never log tokens/passwords

### Tracing
- **Library:** OpenTelemetry OTLP via `libs/logger/src/otel.ts`
- **Exporter:** OTLP HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (Jaeger, Grafana Tempo, etc.)
- **Instrumentation:** auto-instrumentation for HTTP, Prisma, Redis
- **Dev:** endpoint not set → no-op (zero overhead)

### Error tracking
- **Library:** Sentry DSN (optional — set `SENTRY_DSN` in env)
- Captures unhandled errors before the `errorMiddleware` generic 500 response

### Health check
- `GET /api/v1/health` → `{ status: 'ok', uptime, timestamp }`
- Future: deep health check pinging Redis + DB (see F-005 in future-plans.md)

---

## 9. Testing Strategy

### Pyramid

```
         ▲  E2E (Phase 8+)
        ███  Integration — supertest against Express app
       █████  Unit — Jest + ts-jest, all mocks
```

### Mocking rules
- **Redis:** mock `@abroad-matrimony/cache` at module level — never hit real Redis in tests
- **DB:** mock `@abroad-matrimony/db` — never hit Supabase in tests
- **Twilio:** mock `twilio` module — never make real API calls in tests
- **Event bus:** mock `@abroad-matrimony/event-bus` — just assert `publish` was called with correct args

### Coverage expectations (non-negotiable)

| Module | Must cover |
|--------|-----------|
| Rate limiter | allow on 1st/2nd/3rd call; block on 4th; TTL returned; first call sets expiry |
| OTP service | Twilio called when SID set; mock path when SID not set; error from Twilio propagates |
| Auth route | 400 invalid phone; 429 rate-limited; 200 success |
| JWT service | valid token issues; expired token rejected; wrong secret rejected |
| Refresh rotation | revoke-on-use; reuse detection triggers nuclear logout |

---

## 10. Scalability Model

### Current architecture (MVP / pre-launch)
- Single Express process (Gateway)
- Single Redis instance (Docker → Redis Cloud for prod)
- Supabase manages Postgres scaling
- BullMQ workers: same process as gateway (acceptable for MVP)

### Phase 2 scale targets (post-launch)
- Separate BullMQ worker processes (NX apps: `apps/worker-scoring`, `apps/worker-notification`)
- Redis Cloud with AOF persistence enabled
- Gateway: horizontal scaling behind load balancer (stateless — JWT auth, no sticky sessions)
- Supabase: connection pooler handles burst (already configured)

### Bottlenecks to watch
1. **Match score computation** — O(n²) user pairs; must be async/batched (MATCH-002)
2. **OTP rate limiter** — atomic INCR + EXPIRE; fine at single Redis node; needs Lua script for multi-node Redis (see F-003 in future-plans.md)
3. **Feature flag cache** — per-request DB hit if Redis cold; 5-min TTL limits blast radius

---

## 11. Deployment Topology (Target)

```
                    ┌─────────────────────────────┐
                    │   GitHub Actions CI          │
                    │   lint → typecheck → test    │
                    │   → build (NX affected)      │
                    └──────────────┬──────────────┘
                                   │ push to main
                    ┌──────────────▼──────────────┐
                    │   Deploy target (TBD)        │
                    │   Railway / Render / ECS     │
                    │                              │
                    │  ┌──────────┐ ┌───────────┐ │
                    │  │ gateway  │ │ admin-api │ │
                    │  │ :3000    │ │ :3001     │ │
                    │  └────┬─────┘ └─────┬─────┘ │
                    │       └──────┬───────┘       │
                    │        ┌─────▼──────┐        │
                    │        │  Redis     │        │
                    │        │  Cloud     │        │
                    │        └────────────┘        │
                    │                              │
                    │  Supabase (managed Postgres) │
                    └─────────────────────────────┘
```

---

## 12. Lib Dependency Graph

```
shared          (no deps)
  ▲
  ├── config    (zod)
  ├── logger    (winston, otel)
  ├── db        (prisma)
  ├── cache     (ioredis)
  └── event-bus (bullmq, shared)
        ▲
        └── auth (twilio, jsonwebtoken, cache, db, event-bus, config, logger, shared)
              ▲
              └── gateway (auth, cache, db, event-bus, config, logger, shared)
```

Rules:
- `shared` must have zero runtime dependencies
- Libs must not create circular dependencies
- `gateway` is the only consumer of all libs — no lib should import from `gateway`
