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
  Client App           │  Public REST API                             │
                        │                                              │
  Admin Browser ──────► │  apps/admin-api      (port 3001)            │
                        │  Admin REST API  [NOT YET BUILT]            │
                        └──────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────────────┐
              │                │                        │
              ▼                ▼                        ▼
        ┌──────────┐    ┌──────────┐           ┌──────────────┐
        │ Supabase │    │  Redis   │           │ BullMQ       │
        │ Postgres │    │  Cache + │           │ Workers      │
        │   (DB)   │    │  Queue   │           │ [future]     │
        └──────────┘    └──────────┘           └──────────────┘
              │
   ┌──────────┼──────────────────────────────────────┐
   │          │          External Services            │
   ▼          ▼          ▼          ▼          ▼      │
Twilio    Brevo     Firebase    AWS S3    Stripe/    │
Verify    Email      Push       Media    Razorpay    │
  OTP    300/day   Notif.      Store    Payments    │
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
| `auth` | OTP, JWT, RBAC *(Phase 2)* | `sendOtp()`, `verifyOtp()`, `issueTokenPair()`, `requireAuth`, `requireRole()` |
| `matching` | Scoring algorithm *(Phase 4)* | `computeScore()` |
| `notification` | Multi-channel dispatch *(Phase 6)* | `sendEmail()`, `sendSms()`, `sendPush()` |
| `payment` | Stripe + Razorpay *(Phase 7)* | `createCheckout()`, `handleWebhook()` |
| `storage` | S3 upload *(Phase 3)* | `uploadFile()`, `getSignedUrl()` |

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
Identity          users, devices, refresh_tokens, admin_users
Profile           profiles, real_life_answers, story_prompt_answers, media
Groups            groups, group_members, intro_drop_logs
Matching          match_scores, connections, matches
Messaging         conversations, messages
Engagement        check_ins, events, event_rsvps
Verification      verification_requests
Payments          memberships, payment_intents, diamond_ledger
Platform          feature_flags, notifications, flags, audit_logs, event_logs
```

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
