# Abroad Matrimony — Project Phases

> **Legend:** ✅ Done · 🔄 In Progress · ⏳ Backlog · 🚫 Blocked

---

## Phase 1 — Foundation ✅
**Goal:** Monorepo scaffold, infra libs, full DB schema live in Supabase.
**Sprint:** 1 | **Status:** Complete (commit `c28a71f`)

| Task ID     | Description                                    | Status |
|-------------|------------------------------------------------|--------|
| INFRA-001   | NX monorepo, tsconfig path aliases, ESLint     | ✅     |
| INFRA-002   | Docker Compose — Redis 7 + Postgres 16         | ✅     |
| INFRA-003   | GitHub Actions CI (lint/typecheck/test/build)  | ✅     |
| INFRA-004   | CodeRabbit rules + PR template                 | ✅     |
| INFRA-005   | `libs/config` — Zod env schema + feature flags | ✅     |
| INFRA-006   | `libs/cache` — ioredis singleton + helpers     | ✅     |
| INFRA-007   | `libs/event-bus` — CloudEvents + BullMQ WAL    | ✅     |
| INFRA-008   | `apps/gateway` — Express, Helmet, health route | ✅     |
| DB-001      | Prisma schema — 25 tables, 19 enums            | ✅     |
| DB-002      | Schema pushed to Supabase, client generated    | ✅     |
| LOG-001     | `libs/logger` — Winston (dev/prod modes)       | ✅     |
| LOG-002     | OpenTelemetry OTLP tracer                      | ✅     |
| SHARED      | `libs/shared` — DTOs, enums, constants         | ✅     |

---

## Phase 2 — Auth 🔄
**Goal:** Full phone OTP auth flow, JWT tokens, device tracking, RBAC.
**Sprint:** 2 | **Status:** In Progress

| Task ID   | Description                                      | Status     |
|-----------|--------------------------------------------------|------------|
| AUTH-001  | `POST /api/v1/auth/otp/request`                  | ✅         |
| AUTH-002  | `POST /api/v1/auth/otp/verify`                   | ✅         |
| AUTH-003  | `POST /api/v1/auth/token/refresh`                | ✅         |
| AUTH-004  | `POST /api/v1/auth/logout` + logout/all          | ✅         |
| AUTH-005  | `requireAuth` middleware                         | ✅         |
| QUAL-001  | Jest coverage config (Istanbul lcov/html)        | ✅         |
| QUAL-002  | SonarCloud integration (CI scan + properties)    | ✅         |
| AUTH-006  | `POST /admin/auth/login` (bcrypt + TOTP)         | ✅         |
| AUTH-007  | `requireRole()` user RBAC middleware             | ⏳         |
| AUTH-008  | `requireAdminRole()` admin RBAC middleware       | ⏳         |

---

## Phase 3 — Profile ⏳
**Goal:** User profile creation, real-life answers, story prompts, photo upload.
**Sprint:** 3 | **Status:** Backlog

| Task ID   | Description                                      | Status |
|-----------|--------------------------------------------------|--------|
| PROF-001  | `POST /api/v1/profile` — create profile          | ⏳     |
| PROF-002  | `PUT /api/v1/profile/real-life/:questionKey`     | ⏳     |
| PROF-003  | `PUT /api/v1/profile/story/:promptKey`           | ⏳     |
| PROF-004  | `POST /api/v1/profile/media` — S3 photo upload   | ⏳     |
| PROF-005  | Profile completion score calculation             | ⏳     |
| PROF-006  | `GET /api/v1/profile/me` + `GET /profiles/:id`  | ⏳     |

---

## Phase 4 — Matching ⏳
**Goal:** Weighted compatibility scoring, BullMQ batch compute, discovery feed.
**Sprint:** 4 | **Status:** Backlog

| Task ID    | Description                                     | Status |
|------------|-------------------------------------------------|--------|
| MATCH-001  | Scoring algorithm v1 — 9 dimensions             | ⏳     |
| MATCH-002  | BullMQ worker — batch-compute all user pairs    | ⏳     |
| MATCH-003  | Redis-cached score lookup                       | ⏳     |
| MATCH-004  | `GET /api/v1/discover` — paginated feed         | ⏳     |
| MATCH-005  | Feature-flag gate for algorithm v2              | ⏳     |

---

## Phase 5 — Groups + Connections + Messaging ⏳
**Goal:** Regional groups, weekly intro drops, connection requests, real-time messaging.
**Sprint:** 5 | **Status:** Backlog

| Task ID   | Description                                      | Status |
|-----------|--------------------------------------------------|--------|
| GROUP-001 | Create / list groups (admin)                    | ⏳     |
| GROUP-002 | Weekly intro drop BullMQ job                    | ⏳     |
| GROUP-003 | Member list + join/leave                        | ⏳     |
| CONN-001  | `POST /api/v1/connections` — send request        | ⏳     |
| CONN-002  | Accept / decline connection                     | ⏳     |
| CONN-003  | Match creation on accept                        | ⏳     |
| VER-001   | Submit verification (ID doc + selfie)           | ⏳     |
| VER-002   | Admin review queue                              | ⏳     |
| VER-003   | Approve / reject + status update                | ⏳     |
| MSG-001   | Conversation model + REST endpoints             | ⏳     |
| MSG-002   | Send / fetch messages                           | ⏳     |
| MSG-003   | WebSocket real-time delivery                    | ⏳     |
| MSG-004   | Read receipts                                   | ⏳     |

---

## Phase 6 — Notifications ⏳
**Goal:** Multi-channel notification delivery via BullMQ processor.
**Sprint:** 6 | **Status:** Backlog

| Task ID    | Description                                     | Status |
|------------|-------------------------------------------------|--------|
| NOTIF-001  | Brevo email adapter                             | ⏳     |
| NOTIF-002  | Twilio SMS adapter                              | ⏳     |
| NOTIF-003  | Firebase push adapter                           | ⏳     |
| NOTIF-004  | BullMQ notification processor worker           | ⏳     |

---

## Phase 7 — Payments ⏳
**Goal:** Stripe + Razorpay, membership activation, diamond ledger.
**Sprint:** 7 | **Status:** Backlog

| Task ID  | Description                                       | Status |
|----------|---------------------------------------------------|--------|
| PAY-001  | Stripe checkout — Founding Member plan            | ⏳     |
| PAY-002  | Stripe webhook handler                            | ⏳     |
| PAY-003  | Razorpay order + payment capture                  | ⏳     |
| PAY-004  | Razorpay webhook handler                          | ⏳     |
| PAY-005  | Membership activation on payment success          | ⏳     |
| PAY-006  | Diamond credit purchase + ledger INSERT           | ⏳     |
| PAY-007  | Diamond spend + balance check                     | ⏳     |
| PAY-008  | Refund handling + ledger reversal entry           | ⏳     |

---

## Phase 8 — Admin API + Analytics ⏳
**Goal:** Admin panel API, user management, feature flag UI, audit logs, KPI dashboard.
**Sprint:** 8 | **Status:** Backlog

| Task ID    | Description                                     | Status |
|------------|-------------------------------------------------|--------|
| ADMIN-001  | Admin login (bcrypt + TOTP) — AUTH-006          | ⏳     |
| ADMIN-002  | User management endpoints (list, suspend, etc.) | ⏳     |
| ADMIN-003  | Feature flag toggle API                         | ⏳     |
| ADMIN-004  | Verification review queue API                   | ⏳     |
| ADMIN-005  | Audit log viewer                                | ⏳     |
| ADMIN-006  | Flag/moderation queue                           | ⏳     |
| ADMIN-007  | KPI dashboard endpoints (DAU, conversions, etc.)| ⏳     |
