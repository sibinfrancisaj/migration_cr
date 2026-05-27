# CLAUDE.md — Abroad Matrimony Backend

This file is the authoritative session handoff document.
Read it fully at the start of every new session before writing any code.

---

## 1. Project overview

**Abroad Matrimony** is a matchmaking platform for Indians living abroad.
This repo is the backend (API + admin API + workers) built as an NX monorepo.

**Key product ideas:**
- Users answer 12 "Real Life" questions (parenting, faith, diet, money, etc.) and 3 story prompts
- A weighted scoring algorithm computes compatibility across all user pairs
- Weekly "Intro Drop" — curated intro exchanges inside regional groups
- Sunday check-ins keep the activity signal fresh for the scoring algorithm
- Founding Member tier (paid) unlocks full connection flow + diamond credits
- Identity verified via ID document + selfie (admin-reviewed)

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22, TypeScript 5.5 |
| Framework | Express 4 |
| Monorepo | NX 22 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Cache / Queue broker | Redis 7 (Docker local, add Redis Cloud for prod) |
| Job queue | BullMQ 5 |
| Events | CloudEvents 1.0.2 spec + BullMQ WAL |
| Auth | JWT (jsonwebtoken) — access 15m, refresh 30d |
| OTP | Twilio Verify |
| Email | Brevo (300/day free) |
| Push | Firebase Admin SDK |
| Storage | AWS S3 + CloudFront |
| Payments | Stripe (international) + Razorpay (India) |
| Observability | Winston + OpenTelemetry OTLP + Sentry |
| Package manager | npm (converted from yarn) |
| CI | GitHub Actions (NX affected) |
| Code review | CodeRabbit |

---

## 3. Repository layout

```
migration_cr/
├── apps/
│   ├── gateway/          ← Public-facing REST API (port 3000)
│   └── admin-api/        ← Admin REST API (port 3001) — NOT YET BUILT
│
├── libs/
│   ├── shared/           ← Enums, TypeScript types, constants (no runtime deps)
│   ├── config/           ← Zod env validation, feature flag service
│   ├── logger/           ← Winston + OpenTelemetry
│   ├── db/               ← Prisma client singleton, schema at prisma/schema.prisma
│   ├── cache/            ← ioredis client + helpers
│   ├── event-bus/        ← CloudEvents publisher + in-memory WAL + BullMQ
│   ├── auth/             ← NOT YET BUILT (JWT issue/verify, OTP, RBAC)
│   ├── matching/         ← NOT YET BUILT (scoring algorithm)
│   ├── notification/     ← NOT YET BUILT (Twilio, Brevo, Firebase adapters)
│   ├── payment/          ← NOT YET BUILT (Stripe, Razorpay, diamond ledger)
│   └── storage/          ← NOT YET BUILT (S3 upload adapter)
│
├── docker/
│   ├── docker-compose.yml   ← Redis 7 + Postgres 16 + Redis Commander (:8081)
│   └── redis.conf
│
├── docs/
│   └── notion-template.md   ← Full task breakdown (all 5 phases)
│
├── .github/
│   ├── workflows/ci.yml     ← lint + typecheck + test + build (NX affected)
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .coderabbit.yaml         ← Per-path review rules
├── .env.example             ← All env vars documented (no secrets)
├── .env                     ← Real secrets — NEVER COMMIT (gitignored)
├── tsconfig.base.json       ← Path aliases for all libs
└── package.json             ← Root NX workspace
```

---

## 4. Infrastructure & credentials

### Supabase (production DB — also used for local dev)
- **Project ref:** `uefpsuhvtnvjoxsprzjk`
- **Region:** ap-south-1
- **Dashboard:** https://supabase.com/dashboard/project/uefpsuhvtnvjoxsprzjk
- **DATABASE_URL** (runtime, transaction pooler): `postgresql://postgres.uefpsuhvtnvjoxsprzjk:<pw>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- **DIRECT_URL** (migrations, session pooler): `postgresql://postgres.uefpsuhvtnvjoxsprzjk:<pw>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`
- Passwords live in `.env` only — never in code or CLAUDE.md

> **IMPORTANT:** The cloud runner (claude.ai/code web sessions) cannot reach Supabase —
> all `prisma db push` / `prisma migrate` commands must run on the **local machine**.

### Redis (local dev)
- `docker compose -f docker/docker-compose.yml up -d`
- URL: `redis://localhost:6379`
- Redis Commander UI: `http://localhost:8081`

### Notion workspace
- **Hub page:** https://www.notion.so/36dc69a75ee28173b08fee546d995f09
- **AM Tasks DB:** https://www.notion.so/31367c24c4ac485288ea858ff96c6289
- Task IDs follow format `DOMAIN-NNN` (e.g. `AUTH-001`)

### GitHub
- **Repo:** `sibinfrancisaj/migration_cr`
- **Main development branch:** `claude/modest-albattani-BJ7yn`
- **Workflow:** build locally on feature branch → push → open PR against main → merge

---

## 5. Completed work (Phase 1 — Foundation)

All items below are committed on branch `claude/modest-albattani-BJ7yn` (commit `c28a71f`).

| Task ID | What was built | Key files |
|---------|---------------|-----------|
| INFRA-001 | NX monorepo, root tsconfig with path aliases for all 12 libs, ESLint, Prettier | `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc` |
| INFRA-002 | Docker Compose — Redis 7 + Postgres 16 + Redis Commander | `docker/docker-compose.yml`, `docker/redis.conf` |
| INFRA-003 | GitHub Actions CI — lint / typecheck / test / build, NX affected | `.github/workflows/ci.yml` |
| INFRA-004 | CodeRabbit per-path review rules + PR template | `.coderabbit.yaml`, `.github/PULL_REQUEST_TEMPLATE.md` |
| INFRA-005 | `libs/config` — Zod env schema (throws on startup if env invalid), feature flag service with rollout % | `libs/config/src/env.ts`, `libs/config/src/feature-flags.ts` |
| INFRA-006 | `libs/cache` — ioredis singleton, cacheGet/Set/Del/Expire/Exists | `libs/cache/src/` |
| INFRA-007 | `libs/event-bus` — CloudEvents 1.0.2 publisher, in-memory WAL buffer (flush every 500ms or 50 events), BullMQ backed | `libs/event-bus/src/` |
| INFRA-008 | `apps/gateway` — Express 4, Helmet + CORS + rate-limit, graceful SIGTERM/SIGINT shutdown, `/api/v1/health` | `apps/gateway/src/` |
| DB-001 | Full Prisma schema — 25 tables, 19 enums, all FK indexes | `libs/db/prisma/schema.prisma` |
| DB-002 | Schema pushed to Supabase ✓ (done locally), Prisma client generated | `libs/db/src/client.ts` |
| LOG-001 | `libs/logger` — Winston, dev=colorized simple / prod=JSON, `createChildLogger()` | `libs/logger/src/logger.ts` |
| LOG-002 | OpenTelemetry OTLP tracer — auto-instrumentations, graceful shutdown, no-op if endpoint not set | `libs/logger/src/otel.ts` |
| SHARED | `libs/shared` — all TypeScript types (DTOs), enums, constants, CloudEvent type names | `libs/shared/src/` |

### Prisma schema tables (all exist in Supabase)
`users` · `devices` · `refresh_tokens` · `admin_users` · `profiles` · `real_life_answers` · `story_prompt_answers` · `media` · `groups` · `group_members` · `intro_drop_logs` · `match_scores` · `connections` · `matches` · `conversations` · `messages` · `check_ins` · `events` · `event_rsvps` · `verification_requests` · `memberships` · `payment_intents` · `diamond_ledger` · `feature_flags` · `notifications` · `flags` · `audit_logs` · `event_logs`

---

## 6. What to build next — ordered backlog

### Sprint 2 (current): AUTH flow

| Task ID | Endpoint | Notes |
|---------|----------|-------|
| **AUTH-001** | `POST /api/v1/auth/otp/request` | Validate E.164 phone, rate-limit 3/hr/phone (Redis), send via Twilio Verify. Create `libs/auth` lib. |
| **AUTH-002** | `POST /api/v1/auth/otp/verify` | 6-digit code, on success upsert `users` row, issue JWT access (15m) + refresh (30d stored in Redis + `refresh_tokens` table). Require device fingerprint in body. |
| **AUTH-003** | `POST /api/v1/auth/token/refresh` | One-time-use rotation — revoke old token immediately, issue new pair. On reuse detection → revoke all devices for that user. |
| **AUTH-004** | `POST /api/v1/auth/logout` | Revoke current device refresh token. `POST /api/v1/auth/logout/all` revokes all. |
| **AUTH-005** | Express middleware `requireAuth` | Verify access JWT, attach `req.user = { id, role, deviceId }`. 401 on invalid/expired, 403 on suspended. |
| **AUTH-006** | `POST /admin/auth/login` | bcrypt password + TOTP (speakeasy). Separate `ADMIN_JWT_SECRET`. 8h expiry. |
| **AUTH-007** | `requireRole(...roles)` middleware | User-facing RBAC — checks `UserRole` in JWT. |
| **AUTH-008** | `requireAdminRole(...roles)` middleware | Admin RBAC — checks `AdminRole`. All admin mutations must write to `audit_logs`. |

### Sprint 3: Profile

| Task ID | What |
|---------|------|
| PROF-001 | `POST /api/v1/profile` — create profile (name, dob, gender, city, country, settlementIntent) |
| PROF-002 | `PUT /api/v1/profile/real-life/:questionKey` — upsert one of 12 RL answers |
| PROF-003 | `PUT /api/v1/profile/story/:promptKey` — upsert one of 3 story prompts |
| PROF-004 | `POST /api/v1/profile/media` — multipart upload, S3, max 6 photos, jpg/png/webp, 5MB |
| PROF-005 | Profile completion score — basics 20% + RL 40% + story 20% + photos 10% + verification 10% |
| PROF-006 | `GET /api/v1/profile/me` + `GET /api/v1/profiles/:id` |

### Sprint 4: Matching

| Task ID | What |
|---------|------|
| MATCH-001 | Weighted scoring algorithm v1 — 9 dimensions, weights sum to 1.0 |
| MATCH-002 | BullMQ worker to batch-compute scores for all user pairs |
| MATCH-003 | Redis-cached score lookup |
| MATCH-004 | `GET /api/v1/discover` — paginated feed sorted by score |
| MATCH-005 | Feature-flag gate for algorithm v2 |

### Sprint 5: Groups + Connections + Messaging

| Task ID | What |
|---------|------|
| GROUP-001/002/003 | Create groups, weekly intro drop job, member list |
| CONN-001/002/003 | Send connection, accept/decline, match creation |
| MSG-001/002/003/004 | Conversation, messages (REST + WebSocket), read receipts |
| VER-001/002/003 | Verification submit + admin review queue |

### Sprint 6: Notifications + Verification

NOTIF-001 to NOTIF-004: Brevo email + Twilio SMS + Firebase push adapters + BullMQ processor

### Sprint 7: Payments

PAY-001 to PAY-008: Stripe + Razorpay + webhook handlers + membership activation + diamond ledger

### Sprint 8: Admin API + Analytics

ADMIN-001 to ADMIN-007: React admin panel, user management, feature flags, audit logs, KPI dashboard

---

## 7. Architecture decisions (ADRs)

### ADR-001: Monorepo with NX
All services share one repo. Libs (`shared`, `auth`, `matching`, etc.) are internal packages
imported via TypeScript path aliases. NX `affected` ensures CI only runs what changed.

### ADR-002: Event-driven via CloudEvents + BullMQ WAL
Events are not emitted directly to an external broker. They're buffered in-memory,
flushed to a BullMQ Redis queue every 500ms or 50 events, and a separate worker
processes them. This means the caller never blocks on event delivery, and events
survive server restarts (Redis persistence).

Event type names follow `com.abroadmatrimony.<domain>.<action>` pattern.
All event types are declared in `libs/shared/src/constants/index.ts` (`CLOUD_EVENT_TYPES`).

### ADR-003: Two database URLs
- `DATABASE_URL`: transaction pooler (port 6543) + `?pgbouncer=true` → runtime queries (Prisma Client)
- `DIRECT_URL`: session pooler (port 5432) → schema migrations (Prisma Migrate / db push)
Prisma uses `directUrl` from `schema.prisma` automatically for DDL operations.

### ADR-004: Feature flags without 3rd party
`FeatureFlagService` in `libs/config` reads from DB, cached in Redis for 5 min.
Supports: enabled/disabled, rollout % (hash-bucketed by userId), per-user allowlist, per-environment allowlist.
Admin panel will have toggle UI. No LaunchDarkly needed.

### ADR-005: JWT refresh token rotation with reuse detection
Refresh tokens are one-time-use. On use, the old token is revoked before the new pair is issued.
If a token is presented that was already revoked (reuse = token theft), ALL devices for that
user are immediately logged out. Token hashes are stored in Redis (fast revocation check) AND
in the `refresh_tokens` DB table (audit trail).

### ADR-006: Diamond ledger is append-only
`diamond_ledger` has no UPDATE operations — only INSERTs with delta + balanceAfter.
Current balance = latest `balanceAfter` for a user. This gives a full audit trail and
prevents balance manipulation bugs.

### ADR-007: Payments in integer paise/cents
All monetary amounts are stored and processed as integers (paise for INR, cents for USD).
Never use floats for money. Display layer divides by 100.

---

## 8. Code conventions

### Imports
Always use `@abroad-matrimony/<lib>` path aliases. Never use relative paths across lib boundaries.

### Error handling
All Express route errors must be `AppError` instances thrown or passed to `next()`.
`AppError` is in `apps/gateway/src/middleware/error.middleware.ts`.
Response format is always `ApiResponse<T>` from `libs/shared/src/types/index.ts`.

### Logging
Always use `createChildLogger({ module: 'service:submodule' })` — never `console.log`.

### Validation
All incoming request bodies must be validated with a Zod schema before use.
Put schemas in a `schemas/` folder next to the route file.

### Env vars
Add new env vars to:
1. `libs/config/src/env.ts` (Zod schema)
2. `.env.example` (with description comment)
3. `.github/workflows/ci.yml` (if needed in CI)

### Git commits
```
feat(AUTH-001): short description

- bullet points
- of what changed

TICKET: AUTH-001
```

### Branch naming
```
feat/AUTH-001-phone-otp-request
fix/MATCH-042-null-score-crash
chore/INFRA-003-ci-pipeline
```

---

## 9. Workflow for local development

```
local machine:
  git checkout -b feat/AUTH-001-phone-otp-request
  # build the feature
  npx nx test gateway          # verify tests pass
  git push origin feat/AUTH-001-phone-otp-request
  # open PR on GitHub against main

cloud session (claude.ai/code):
  # AI picks up PR, reviews CodeRabbit comments, fixes, pushes
  # OR: AI builds feature here, pushes branch, you pull and test
```

---

## 10. Starter prompt for a new session

Copy-paste this into the chat at the start of a new Claude Code session:

```
Read CLAUDE.md fully before doing anything else.

Project: Abroad Matrimony backend (NX monorepo, Express, TypeScript, Supabase, Redis).
Repo: sibinfrancisaj/migration_cr
Branch: claude/modest-albattani-BJ7yn (or a feature branch if one is open)

Phase 1 foundation is complete (see CLAUDE.md section 5 for what's built).
All 25 Prisma tables are live in Supabase.

The next task is AUTH-001 (see CLAUDE.md section 6 for full spec):
  POST /api/v1/auth/otp/request
  - Create libs/auth lib
  - Validate E.164 phone with Zod
  - Rate-limit: 3 OTP requests per phone per hour (Redis)
  - Send via Twilio Verify (mock/skip if TWILIO_ACCOUNT_SID not set in .env)
  - Publish USER_REGISTERED CloudEvent on first-time phone
  - Tests required

We are working locally. Do NOT push to Supabase or run prisma db push from here.
Ask me before opening a PR — I will test locally first.

Start by reading CLAUDE.md, then list what you plan to build for AUTH-001 before writing code.
```
