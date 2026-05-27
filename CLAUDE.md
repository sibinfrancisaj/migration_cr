# CLAUDE.md — Abroad Matrimony Backend

This is the authoritative session handoff document.
**Read this file fully at the start of every new session before writing any code.**

---

## 0. Claude's Role in This Project

You are acting simultaneously as:

| Role | Responsibilities |
|------|-----------------|
| **Senior Cloud Architect** | Enforce architectural boundaries, review every decision against the ADRs, flag scalability / security risks before they land in code, keep `architecture.md` current |
| **Senior Developer** | Write production-quality TypeScript, enforce code conventions, handle error cases thoroughly, never cut corners on validation or security |
| **Engineering Manager** | Keep `phases.md`, `epics-stories.md`, and `bugs.md` updated in real time, surface blockers early, break large stories into safe increments |
| **Senior QA / Tester** | Define acceptance criteria before coding, write tests first or alongside code, cover happy path + all edge cases + security cases, never mark a task done without passing tests |

**You never wait to be asked to document.** Any decision, bug found, pattern established, or plan change is documented immediately as part of the same work session.

---

## 0.1 Living Documentation Rules

These rules are non-negotiable. Follow them during every implementation session.

### Before writing any code
- Re-read the relevant story in `project-management/epics-stories.md`
- Check `project-management/bugs.md` for any open issues affecting this story
- If the story's acceptance criteria are incomplete, finish them before coding

### While implementing
- The moment a design decision changes → add/update a **Decision Log** entry in `epics-stories.md` under that story
- The moment a bug, config issue, test failure, or application crash is found → add it to `project-management/bugs.md` as 🔴 Open immediately (do not wait until fixed)
- Check off subtasks in `epics-stories.md` as each one is completed
- If a new code pattern or convention is established → update **Section 8** of this file

### After completing a task
- Mark the task ✅ in `project-management/phases.md`
- Ensure all subtasks are checked in `epics-stories.md`
- Mark any related bugs 🟢 Fixed in `project-management/bugs.md`
- Update `project-management/architecture.md` if the system design changed

### When an ADR is needed
An Architectural Decision Record is needed whenever:
- A new library is added
- A data storage pattern changes
- An API contract is established that other services will depend on
- A security pattern is introduced (auth, encryption, rate limiting)

Add it to **Section 7** of this file AND to `project-management/architecture.md` Section 5.

### Starter prompt maintenance
Keep Section 11's starter prompt updated to always reflect the *next* task and *current* branch state.

---

## 1. Project Overview

**Abroad Matrimony** is a matchmaking platform for Indians living abroad.
Backend: NX monorepo, Express API + admin API + BullMQ workers.

**Key product ideas:**
- Users answer 12 "Real Life" questions (parenting, faith, diet, money, etc.) and 3 story prompts
- Weighted scoring algorithm computes compatibility across all user pairs
- Weekly "Intro Drop" — curated intro exchanges inside regional groups
- Sunday check-ins keep the activity signal fresh for the scoring algorithm
- Founding Member tier (paid) unlocks full connection flow + diamond credits
- Identity verified via ID document + selfie (admin-reviewed)

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22, TypeScript 5.5 |
| Framework | Express 4 |
| Monorepo | NX 22 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Cache / Queue broker | Redis 7 (Docker local, Redis Cloud for prod) |
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

## 3. Repository Layout

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
│   ├── auth/             ← JWT issue/verify, OTP, RBAC (Phase 2 — complete)
│   ├── matching/         ← NOT YET BUILT (scoring algorithm)
│   ├── notification/     ← NOT YET BUILT (Twilio, Brevo, Firebase adapters)
│   ├── payment/          ← NOT YET BUILT (Stripe, Razorpay, diamond ledger)
│   └── storage/          ← NOT YET BUILT (S3 upload adapter)
│
├── docker/
│   ├── docker-compose.yml   ← Redis 7 + Postgres 16 + Redis Commander (:8081)
│   └── redis.conf
│
├── project-management/
│   ├── phases.md            ← Phase overview + per-task status  ← UPDATE AS YOU GO
│   ├── epics-stories.md     ← Stories with ACs, subtasks, decision logs  ← UPDATE AS YOU GO
│   ├── bugs.md              ← Bug / issue / design-change tracker  ← UPDATE AS YOU GO
│   ├── future-plans.md      ← Backlog ideas, tech debt
│   └── architecture.md      ← Comprehensive system architecture reference
│
├── docs/
│   └── notion-template.md
│
├── .github/
│   ├── workflows/ci.yml     ← lint + typecheck + test + build (NX affected)
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .coderabbit.yaml
├── .env.example             ← All env vars documented (no secrets)
├── .env                     ← Real secrets — NEVER COMMIT (gitignored)
├── tsconfig.base.json       ← Path aliases for all libs
└── package.json             ← Root NX workspace
```

---

## 4. Infrastructure & Credentials

### Supabase (production DB — also used for local dev)
- **Project ref:** `uefpsuhvtnvjoxsprzjk`
- **Region:** ap-south-1
- **Dashboard:** https://supabase.com/dashboard/project/uefpsuhvtnvjoxsprzjk
- **DATABASE_URL** (runtime, transaction pooler port 6543 + `?pgbouncer=true`)
- **DIRECT_URL** (migrations, session pooler port 5432)
- Passwords live in `.env` only — never in code or this file

> **IMPORTANT:** Cloud runner (claude.ai/code) cannot reach Supabase.
> All `prisma db push` / `prisma migrate` must run on the **local machine**.

### Redis (local dev)
- `npm run docker:up`
- URL: `redis://localhost:6379` · Redis Commander: `http://localhost:8081`

### GitHub
- **Repo:** `sibinfrancisaj/migration_cr`
- **Main branch:** `claude/modest-albattani-BJ7yn`
- **Workflow:** feature branch → push → PR → user tests locally → merge

---

## 5. Completed Work (Phase 1 — Foundation)

All items committed on `claude/modest-albattani-BJ7yn` (commit `c28a71f`).

| Task ID | What was built | Key files |
|---------|---------------|-----------|
| INFRA-001 | NX monorepo, tsconfig path aliases, ESLint, Prettier | `tsconfig.base.json` |
| INFRA-002 | Docker Compose — Redis 7 + Postgres 16 + Redis Commander | `docker/` |
| INFRA-003 | GitHub Actions CI | `.github/workflows/ci.yml` |
| INFRA-004 | CodeRabbit rules + PR template | `.coderabbit.yaml` |
| INFRA-005 | `libs/config` — Zod env schema + feature flag service | `libs/config/src/` |
| INFRA-006 | `libs/cache` — ioredis singleton + helpers | `libs/cache/src/` |
| INFRA-007 | `libs/event-bus` — CloudEvents + BullMQ WAL (500ms/50-event flush) | `libs/event-bus/src/` |
| INFRA-008 | `apps/gateway` — Express, Helmet, CORS, `/health`, graceful shutdown | `apps/gateway/src/` |
| DB-001 | Prisma schema — 25 tables, 19 enums, all FK indexes | `libs/db/prisma/schema.prisma` |
| DB-002 | Schema live in Supabase, Prisma client generated | `libs/db/src/client.ts` |
| LOG-001 | `libs/logger` — Winston dev=colour / prod=JSON | `libs/logger/src/logger.ts` |
| LOG-002 | OpenTelemetry OTLP tracer | `libs/logger/src/otel.ts` |
| SHARED | `libs/shared` — DTOs, enums, constants, event type names | `libs/shared/src/` |

---

## 6. Active Sprint — Phase 3: Profile

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **PROF-001** | `POST /api/v1/profile` — create profile (name, DOB, gender, city, country, settlementIntent, bio?) | ✅ Done |
| **PROF-002** | `PUT /api/v1/profile/real-life/:questionKey` — upsert real-life answer | ⏳ |
| **PROF-003** | `PUT /api/v1/profile/story/:promptKey` — upsert story prompt | ⏳ |
| **PROF-004** | `POST /api/v1/profile/media` — S3 photo upload (requires libs/storage) | ⏳ |
| **PROF-005** | Profile completion score calculation | ⏳ |
| **PROF-006** | `GET /api/v1/profile/me` + `GET /api/v1/profiles/:id` | ⏳ |

**Key decisions already made (Phase 2 Auth — complete):**
- `USER_REGISTERED` CloudEvent fires in AUTH-002 (not AUTH-001) — after the user row is confirmed written to DB. See BUG-001 in `project-management/bugs.md`. ✅ Implemented.
- `DeviceLimitError` → HTTP 409 Conflict; existing fingerprint bypasses device count check.

---

## 7. Architecture Decisions (ADRs)

> Full context and diagrams → `project-management/architecture.md`

### ADR-001: NX Monorepo
All services share one repo. Libs are internal packages via TypeScript path aliases.
NX `affected` ensures CI only runs what changed.

### ADR-002: Event-driven via CloudEvents + BullMQ WAL
Events are buffered in-memory, flushed to BullMQ (Redis) every 500ms or 50 events.
Caller never blocks on event delivery. Events survive restart via Redis persistence.
Event names: `com.abroadmatrimony.<domain>.<action>`.
All types declared in `libs/shared/src/constants/index.ts`.

### ADR-003: Two Database URLs
- `DATABASE_URL`: transaction pooler (port 6543) + `?pgbouncer=true` → Prisma runtime
- `DIRECT_URL`: session pooler (port 5432) → Prisma Migrate / db push

### ADR-004: Feature Flags — No 3rd Party
`FeatureFlagService` in `libs/config`. Reads from DB, cached Redis 5 min.
Supports: on/off, rollout %, per-user allowlist, per-environment allowlist.

### ADR-005: JWT Refresh Token Rotation + Reuse Detection
Tokens are one-time-use. Old token revoked before new pair issued.
Reuse detected → revoke ALL devices for that user immediately.
Hashes stored in Redis (fast revocation) AND `refresh_tokens` table (audit).

### ADR-006: Diamond Ledger Is Append-Only
No UPDATEs — only INSERTs with `delta` + `balanceAfter`.
Current balance = latest `balanceAfter` row. Prevents balance manipulation bugs.

### ADR-007: All Money in Integer Paise/Cents
Never floats. Display layer divides by 100.

### ADR-008: OTP CloudEvent Deferred to Verification Step
`USER_REGISTERED` event fires in AUTH-002 after DB upsert confirms a new user row,
not in AUTH-001. Rationale: avoid false events for phones that never complete verification.

---

## 8. Code Conventions

> Full enterprise patterns guide → `project-management/enterprise-patterns.md`
> Reference: github.com/mikesparr/enterprise-api-starter-nodejs

### Layered Architecture (strictly enforced)

Every request flows through exactly: **Route → Controller → Service → Data layer**

- **Route** — only path definition + middleware chain. Zero logic.
- **Controller** — parse req, call service, send `ApiResponse<T>`. Zero business logic. Zero DB calls.
- **Service (libs/)** — all business logic, external calls. No Express types (`req`/`res`/`next`).
- **Data layer (Prisma)** — all DB access. Never imported in controllers or routes.

### Directory layout for new features
```
apps/gateway/src/
├── routes/<domain>/index.ts               ← router only
├── controllers/<domain>/<name>.controller.ts
├── schemas/<domain>/<name>.schema.ts      ← Zod validation schemas
└── middleware/                            ← shared middleware
```

### STANDARDS.md — required in every component directory
`routes/<domain>/`, `controllers/<domain>/`, `middleware/` must each have a `STANDARDS.md`.
Max 50 lines: purpose · conventions · example · anti-patterns.

### Cloud-Agnostic Adapter Pattern
All external services (Twilio, Brevo, Firebase, S3, Stripe, Razorpay) use:
`base.<service>.adapter.ts` (interface) + provider implementations + factory function.
See `enterprise-patterns.md` Section 4 for full pattern and examples.

### No Magic Strings
Never compare against inline strings. All error messages and enum comparisons use constants.
```typescript
// ❌  if (user.role === 'SUSPENDED')
// ✅  if (user.role === UserRole.SUSPENDED)
// ❌  throw new Error('User not found')
// ✅  throw new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, AUTH_ERRORS.USER_NOT_FOUND)
```
Domain constants: `apps/gateway/src/constants/<domain>.constants.ts`

### Request Tracing
`X-Request-ID` middleware runs first. Every log entry and every error response includes `requestId`.
`createChildLogger({ module: 'auth:otp', requestId: req.requestId })`

### Imports
Always `@abroad-matrimony/<lib>` path aliases. Never relative paths across lib boundaries.

### New Library Scaffold
`package.json` (name, version, main, types, deps) + `src/index.ts` (barrel). No `project.json` needed.

### Error Handling
All Express route errors → `AppError` thrown or `next(err)`.
`AppError` is in `apps/gateway/src/middleware/error.middleware.ts`.
Response shape is always `ApiResponse<T>` from `libs/shared/src/types/index.ts`.

### Logging
Always `createChildLogger({ module: 'domain:submodule', requestId })`. Never `console.log`.
PII: `phone.slice(0, 6) + '****'`. Never log tokens, passwords, or full phone numbers.

### Validation
All request bodies validated via `validateBody(schema)` middleware — never inside the controller.
Schemas in `apps/gateway/src/schemas/<domain>/`.

### File Size
Target < 300 lines. Hard limit 500 lines — split if exceeded.

### Security Invariants
- Never log full phone numbers, tokens, or secrets
- bcrypt cost factor ≥ 12 for all passwords
- Rate-limit all public endpoints (Redis INCR + EXPIRE)
- Check resource exists (404) before checking permission (403)
- Validate all enum inputs before DB writes
- Run security checklist (`enterprise-patterns.md` Section 11) before marking task Done

### Env Vars — when adding new
1. `libs/config/src/env.ts` — Zod schema
2. `.env.example` — with description comment
3. `.github/workflows/ci.yml` — if needed in CI

### Git Commits
```
feat(AUTH-001): short description

- bullet point of what changed
- another bullet

TICKET: AUTH-001
```

### Branch Naming
```
feat/AUTH-001-phone-otp-request
fix/BUG-003-rate-limit-window
chore/INFRA-009-jest-config
```

---

## 9. Testing Standards

> As Senior QA: tests are not optional. A task is not Done until tests pass.

### Testing Pyramid

| Layer | Tool | Location | Coverage target |
|-------|------|----------|-----------------|
| Unit | Jest + ts-jest | `src/__tests__/` next to source | All pure functions, services, helpers |
| Integration | Jest + supertest | `apps/*/src/routes/**/__tests__/` | All HTTP routes |
| E2E | (Phase 8+) | TBD | Critical user journeys |

### Unit Test Rules
- Mock all external dependencies (Redis, DB, Twilio, S3, etc.) at the module level
- Each test file: one `describe` per function/class; one `it` per behaviour
- Cover: happy path, each validation error, each external failure (e.g. Redis down), boundary values

### Integration Test Rules
- Use `supertest` against the Express app instance (not a running server)
- Mock `@abroad-matrimony/db`, `@abroad-matrimony/cache`, `@abroad-matrimony/event-bus` at module level
- Do NOT hit real Supabase or Redis in CI tests

### Test File Naming
```
libs/auth/src/__tests__/otp.rate-limit.test.ts
libs/auth/src/__tests__/otp.service.test.ts
apps/gateway/src/routes/auth/__tests__/otp-request.test.ts
```

### Running Tests
```bash
npx jest                          # all tests
npx jest --testPathPattern=auth   # auth tests only
npx jest --coverage               # with coverage report
```

### What Must Be Tested for Every Route
1. 200/201 happy path
2. 400 on each validation error (missing field, wrong format, invalid enum)
3. 401/403 on auth failures (where applicable)
4. 429 on rate limit exceeded
5. 500 simulated when a downstream dependency throws

---

## 10. Project Management Files

| File | Purpose | When to update |
|------|---------|---------------|
| `project-management/phases.md` | Phase + task status overview | Flip to ✅ when task merged |
| `project-management/epics-stories.md` | Full story specs, ACs, subtasks, decision logs | Check off subtasks live; add Decision Log when plan changes |
| `project-management/bugs.md` | All bugs, config issues, design changes, crashes | Add 🔴 immediately when found; update to 🟢 when fixed |
| `project-management/future-plans.md` | Ideas and tech debt not in active sprint | Add items instead of scope-creeping the current task |
| `project-management/architecture.md` | System design, flows, ADR details, diagrams | Update when architecture or a key pattern changes |

---

## 11. Starter Prompt for a New Session

Copy-paste at the start of every new Claude Code session:

```
Read CLAUDE.md fully before doing anything else. Then read:
  - project-management/phases.md  (to know current state)
  - project-management/bugs.md    (to know open issues)

Project: Abroad Matrimony backend (NX monorepo, Express, TypeScript, Supabase, Redis).
Repo: sibinfrancisaj/migration_cr
Active branch: claude/modest-albattani-BJ7yn (or check git status)

Phase 1 complete. Phase 2 Auth ALL DONE (171 tests, 21 suites).
AUTH-001 ✅ — POST /api/v1/auth/otp/request
AUTH-002 ✅ — POST /api/v1/auth/otp/verify
AUTH-003 ✅ — POST /api/v1/auth/token/refresh
AUTH-004 ✅ — POST /logout + POST /logout/all
AUTH-005 ✅ — requireAuth middleware
QUAL-001 ✅ — Jest coverage (Istanbul lcov/html, thresholds)
QUAL-002 ✅ — SonarCloud integration (sonar-project.properties + CI scan step)
AUTH-006 ✅ — POST /admin/auth/login (bcrypt + TOTP)
AUTH-007 ✅ — requireRole() user RBAC middleware
AUTH-008 ✅ — requireAdminRole() admin RBAC middleware + auditLog() helper

Phase 3 in progress.
PROF-001 ✅ — POST /api/v1/profile (create profile), 199 tests, 23 suites.
Next task: PROF-002 — PUT /api/v1/profile/real-life/:questionKey

KEY DECISION: USER_REGISTERED CloudEvent fires in AUTH-002 (not AUTH-001). See BUG-001 in bugs.md.

Key files from Phase 3 (PROF-001):
- libs/profile/src/profile.service.ts — createProfileService() + ProfileAlreadyExistsError
- libs/profile/src/index.ts — barrel exports
- apps/gateway/src/schemas/profile/create-profile.schema.ts — z.coerce.date() + age guard
- apps/gateway/src/constants/profile.constants.ts
- apps/gateway/src/controllers/profile/profile.controller.ts
- apps/gateway/src/routes/profile/index.ts

Key files from Phase 2 (new additions in AUTH-007/008):
- libs/auth/src/middleware/require-role.middleware.ts — requireRole(...roles) factory
- libs/auth/src/middleware/require-admin-role.middleware.ts — requireAdminRole(...roles) factory; verifies admin JWT
- libs/auth/src/audit.service.ts — auditLog(input) writes to audit_logs table
- libs/auth/src/types/express.d.ts — Express Request augmentation for auth lib context (req.user, req.admin, req.requestId)
- libs/auth/src/middleware/require-auth.middleware.ts — Bearer token → req.user
- libs/auth/src/admin-auth.service.ts — bcrypt + TOTP admin login
- libs/auth/src/jwt.service.ts — issueAdminToken / verifyAdminToken (ADMIN_JWT_SECRET, 8h)
- apps/gateway/src/controllers/admin/admin-auth.controller.ts
- apps/gateway/src/types/express.d.ts — req.user, req.admin, req.requestId augmented
- sonar-project.properties + .github/workflows/ci.yml — SonarCloud

SonarCloud setup (already done):
- SONAR_TOKEN added to GitHub Secrets
- Repo is public (required for free SonarCloud)

We are working locally. Do NOT push to Supabase or run prisma db push.
Ask before opening a PR — user tests locally first.

Act as senior cloud architect + senior developer + engineering manager + senior QA.
Follow all living documentation rules in CLAUDE.md section 0.1 throughout the session.
```

---

## 12. Local Dev Quickstart

```bash
# 1. Start Redis + Postgres
npm run docker:up
# Containers: migration_cr_redis (6382), migration_cr_postgres (5433), migration_cr_redis_ui (8082)

# 2. Install deps
npm install --legacy-peer-deps   # --legacy-peer-deps required (OTel peer conflict — see BUG-003)

# 3. Copy and fill env
cp .env.example .env   # set REDIS_URL=redis://localhost:6382, Supabase URLs, JWT secrets

# 4. Generate Prisma client (schema already pushed to Supabase)
npm run db:generate

# 5. Run gateway
cd apps/gateway && npm run dev

# 6. Run tests
npx jest --projects libs/auth apps/gateway --no-coverage
```

### Infrastructure ports (migration_cr)
| Service | Container | Host port | Notes |
|---------|-----------|-----------|-------|
| Redis 7 | `migration_cr_redis` | `6382` | BullMQ + session cache |
| Postgres 16 | `migration_cr_postgres` | `5433` | Local dev only (Supabase for primary) |
| Redis UI | `migration_cr_redis_ui` | `8082` | http://localhost:8082 |
