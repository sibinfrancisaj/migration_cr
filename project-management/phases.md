# Abroad Matrimony — Project Phases

> **Legend:** ✅ Done · 🔄 In Progress · ⏳ Backlog · 🚫 Blocked

---

## API Documentation (Cross-Phase) ✅
**Status:** Complete — `docs/api/openapi.yaml` + `docs/api/postman-collection.json` updated 2026-05-29.

| Task           | Description                                                       | Status |
|----------------|-------------------------------------------------------------------|--------|
| API-SPEC-001   | All Phase 1–7 endpoints already in openapi.yaml (pre-existing)   | ✅     |
| API-SPEC-002   | Email magic link (Auth), voice intro, profile pause               | ✅     |
| API-SPEC-003   | Connections (CONN-001–004) — 4 endpoints                         | ✅     |
| API-SPEC-004   | Groups (GROUP-001–005) — 5 endpoints                             | ✅     |
| API-SPEC-005   | Verification (VER-001–003) — 3 endpoints                         | ✅     |
| API-SPEC-006   | Introductions/weekly drop (INTRO-001–005) — 5 endpoints          | ✅     |
| API-SPEC-007   | Gatherings/events (EVENT-001–005) — 5 endpoints                  | ✅     |
| API-SPEC-008   | Weekly Prompts (PROMPT-001–005) — 5 endpoints                    | ✅     |
| API-SPEC-009   | Saved Profiles (SAVE-001–005) — 5 endpoints                      | ✅     |
| API-SPEC-010   | Signals dashboard (SIGNAL-001) — 1 endpoint                      | ✅     |
| API-SPEC-011   | Trust Center (TRUST-001–006) — 6 endpoints                       | ✅     |
| API-SPEC-012   | Habits (HABIT-001–005) — 5 endpoints                             | ✅     |
| API-SPEC-013   | Match Tuning (ALG-001–002) — 2 endpoints                         | ✅     |
| API-SPEC-014   | Credit transaction history — 1 endpoint                          | ✅     |
| API-SPEC-015   | Admin: Users (ADMIN-001–004) — 4 endpoints                       | ✅     |
| API-SPEC-016   | Admin: Analytics (ADMIN-005–007) — 3 endpoints                   | ✅     |
| API-SPEC-017   | Admin: Verification (ADMIN-008–010) — 3 endpoints                | ✅     |
| API-SPEC-018   | ScoreBreakdown updated 9 → 18 dimensions (v1 + v2 behind flag)   | ✅     |
| API-SPEC-019   | 9 new enum schemas + 14 new DTO schemas added to components       | ✅     |
| API-SPEC-020   | Postman collection updated: 15 new folders, 52 new requests       | ✅     |
| API-SPEC-021   | `nullable: true` → OpenAPI 3.1 tech debt ignored via .redocly-ignore | ✅  |

**Phase 8a–8d counts (2026-05-30):** `openapi.yaml` 4,803 lines · `postman-collection.json` with all drop/group endpoints
**Phase 8e counts (2026-06-01):** `openapi.yaml` 5,869 lines · 52 admin paths · 42 new Postman requests added (10 new folders)
**Phase 9 counts (2026-06-01):** 5 new habit endpoints added to openapi.yaml + Postman (streaks, weekly-reflection, summary-visibility, history, reflection-note)

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

## Phase 2 — Auth ✅
**Goal:** Full phone OTP auth flow, JWT tokens, device tracking, RBAC.
**Sprint:** 2 | **Status:** Complete (commit pending)

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
| AUTH-007  | `requireRole()` user RBAC middleware             | ✅         |
| AUTH-008  | `requireAdminRole()` admin RBAC middleware       | ✅         |

---

## Phase 3 — Profile ✅
**Goal:** User profile creation, real-life answers, story prompts, photo upload.
**Sprint:** 3 | **Status:** Complete

| Task ID   | Description                                      | Status |
|-----------|--------------------------------------------------|--------|
| PROF-001  | `POST /api/v1/profile` — create profile          | ✅     |
| PROF-002  | `PUT /api/v1/profile/real-life/:questionKey`     | ✅     |
| PROF-003  | `PUT /api/v1/profile/story/:promptKey`           | ✅     |
| PROF-004  | `POST /api/v1/profile/media` — S3 photo upload   | ✅     |
| PROF-005  | Profile completion score calculation             | ✅     |
| PROF-006  | `GET /api/v1/profile/me` + `GET /profiles/:id`  | ✅     |

---

## Phase 4 — Matching ✅
**Goal:** Weighted compatibility scoring, BullMQ batch compute, discovery feed.
**Sprint:** 4 | **Status:** Complete — 497 tests, 35 suites all green

| Task ID    | Description                                     | Status |
|------------|-------------------------------------------------|--------|
| MATCH-001  | Scoring algorithm v1 — 9 dimensions             | ✅     |
| MATCH-002  | BullMQ worker — batch-compute all user pairs    | ✅     |
| MATCH-003  | Redis-cached score lookup                       | ✅     |
| MATCH-004  | `GET /api/v1/discover` — paginated feed         | ✅     |
| MATCH-005  | Feature-flag gate for algorithm v2              | ✅     |

---

## Phase 5 — Groups + Connections + Messaging 🔄
**Goal:** Regional groups, weekly intro drops, connection requests, real-time messaging.
**Sprint:** 5 | **Status:** Messaging complete — 664 tests, 47 suites all green
> **Service layers + lib tests added 2026-05-29**: connections, groups libs + jest configs — unit tests written and passing.

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
| MSG-000   | `libs/messaging` scaffold + Firebase Admin SDK   | ✅     |
| MSG-001   | Conversation REST endpoints (GET list + history) | ✅     |
| MSG-002   | Send message (text / image / voice)             | ✅     |
| MSG-003   | `GET /api/v1/auth/firebase-token` + Firestore rules doc | ✅ |
| MSG-004   | `POST /api/v1/conversations/:convId/read` — read receipts | ✅ |
| MSG-005   | `POST /api/v1/messages/:msgId/flag` + admin flag moderation | ✅ |

---

## Phase 6 — Notifications ✅
**Goal:** Multi-channel notification delivery via BullMQ processor.
**Sprint:** 6 | **Status:** Complete — 696 tests, 51 suites all green

| Task ID    | Description                                     | Status |
|------------|-------------------------------------------------|--------|
| NOTIF-001  | Brevo email adapter                             | ✅     |
| NOTIF-002  | Twilio SMS adapter                              | ✅     |
| NOTIF-003  | Firebase push adapter                           | ✅     |
| NOTIF-004  | BullMQ notification processor worker           | ✅     |

---

## Phase 6b — Trusted Device Bypass ✅
**Goal:** Skip OTP when device is trusted + within TTL window.
**Sprint:** 6b | **Status:** Complete — 716 tests, 53 suites all green

| Task ID  | Description                                              | Status |
|----------|----------------------------------------------------------|--------|
| AUTH-TD  | `POST /api/v1/auth/trusted-device` — bypass OTP if trusted | ✅   |

---

## Phase 7 — Payments ✅
**Goal:** Stripe + Razorpay, membership activation, diamond ledger.
**Sprint:** 7 | **Status:** Complete — 786 tests, 58 suites all green (950 tests, 70 suites after lib tests added 2026-05-29)

| Task ID  | Description                                       | Status |
|----------|---------------------------------------------------|--------|
| PAY-001  | Stripe checkout — Founding Member plan            | ✅     |
| PAY-002  | Stripe webhook handler                            | ✅     |
| PAY-003  | Razorpay order + payment capture                  | ✅     |
| PAY-004  | Razorpay webhook handler                          | ✅     |
| PAY-005  | Membership activation on payment success          | ✅     |
| PAY-006  | Diamond credit purchase + ledger INSERT           | ✅     |
| PAY-007  | Diamond spend + balance check                     | ✅     |
| PAY-008  | Refund handling + ledger reversal entry           | ✅     |

---

## Phase 7b — New Feature Libs + Gateway Tests ✅
**Goal:** Service layers for all new domain libs + complete gateway controller test coverage.
**Sprint:** 7b | **Status:** Complete — 950 tests, 70 suites all green (2026-05-29)

| Task ID     | Description                                                    | Status |
|-------------|----------------------------------------------------------------|--------|
| LIB-CONN    | `libs/connections` — service + 21 unit tests                  | ✅     |
| LIB-GRP     | `libs/groups` — service + 24 unit tests                       | ✅     |
| LIB-GATH    | `libs/gatherings` — events RSVP service + 18 unit tests       | ✅     |
| LIB-VER     | `libs/verification` — ID doc verification + 13 unit tests     | ✅     |
| LIB-HAB     | `libs/habits` — habit logging + streak + 18 unit tests        | ✅     |
| LIB-INTRO   | `libs/introductions` — weekly drops + 18 unit tests           | ✅     |
| LIB-PROMPT  | `libs/prompts` — weekly prompts + resonate + 18 unit tests    | ✅     |
| LIB-SAVE    | `libs/saved-profiles` — shortlist + 14 unit tests             | ✅     |
| LIB-TRUST   | `libs/trust` — block/unblock/report/signals + 15 unit tests   | ✅     |
| LIB-TUNE    | `libs/matching` — match tuning + weight clamping + 7 tests    | ✅     |
| LIB-MAGIC   | `libs/auth` — email magic link send/verify + 9 tests          | ✅     |
| LIB-EXT     | `libs/profile` — pause, voice intro upload/save + 10 tests    | ✅     |
| GW-TEST-001 | Gateway controller tests — connections (10 tests)             | ✅     |
| GW-TEST-002 | Gateway controller tests — habits (12 tests)                  | ✅     |
| GW-TEST-003 | Gateway controller tests — match tuning (7 tests)             | ✅     |
| GW-TEST-004 | Gateway controller tests — signals (3 tests)                  | ✅     |
| GW-TEST-005 | Gateway controller tests — profile extensions (11 tests)      | ✅     |
| GW-TEST-006 | Gateway controller tests — introductions (11 tests)           | ✅     |
| GW-TEST-007 | Gateway controller tests — trust (13 tests)                   | ✅     |
| GW-TEST-008 | Gateway controller tests — events (13 tests)                  | ✅     |
| GW-TEST-009 | Gateway controller tests — saved profiles (11 tests)          | ✅     |
| GW-TEST-010 | Gateway controller tests — prompts (15 tests)                 | ✅     |
| GW-TEST-011 | Gateway controller tests — email magic link (9 tests)         | ✅     |
| CR-FIX-001  | Code review fixes — constants files (5 new), STANDARDS.md (22 files), magic string elimination | ✅ |

---

## Phase 5b — Connections + Verification ⏳
**Goal:** Gateway endpoints for connection requests and identity verification.
**Sprint:** 5b | **Status:** Backlog
> ⚠️ **Group endpoints superseded by Phase 8c (Groups Revamp)** — the original simple group model is being replaced by the full REGIONAL/CULTURAL/PROFESSIONAL/INTEREST taxonomy with social feed, suggested groups, and group posts. Do NOT implement old GROUP-001–005.

| Task ID   | Description                                                       | Status |
|-----------|-------------------------------------------------------------------|--------|
| CONN-001  | `POST /api/v1/connections` — send request                        | ⏳     |
| CONN-002  | `POST /api/v1/connections/:id/reply` — accept with first message | ⏳     |
| CONN-003  | `POST /api/v1/connections/:id/pass` — silent decline             | ⏳     |
| CONN-004  | `GET /api/v1/connections?type=incoming\|outgoing\|accepted`      | ⏳     |
| VER-001   | `POST /api/v1/verification` — submit ID doc + selfie to S3       | ⏳     |
| VER-002   | Admin: `GET /admin/verification/queue` — pending reviews          | ⏳     |
| VER-003   | Admin: `PUT /admin/verification/:id` — approve/reject + notify   | ⏳     |

---

## ── NEW SCOPE: Phase 8 Series ──────────────────────────────────────────

> **Scoped:** 2026-05-29 · **Decision register:** `epics-stories.md` Phase 8 section
> All Phase 8 work depends on **DB-MIGRATION-001** completing first.

---

## DB-MIGRATION-001 — Foundation Schema Migration ✅
**Goal:** Single Prisma migration that adds all new models required by Phases 8a–8d.
**Status:** Complete — 2026-05-29. 1,146 tests all green.
**Note:** Run `npx prisma db push` locally (cloud runner cannot reach Supabase).

| Task ID          | Description                                                          | Status |
|------------------|----------------------------------------------------------------------|--------|
| DB-MIG-001       | `User.isSeeded`, `Profile.isSeeded`, `Profile.voiceIntroTranscript` | ✅     |
| DB-MIG-002       | `GroupType` + `GroupScope` enums; revamp `Group` model              | ✅     |
| DB-MIG-003       | `JoinedVia` enum; update `GroupMembership` model                    | ✅     |
| DB-MIG-004       | `GroupPost`, `GroupPostComment`, `GroupPostLike` models             | ✅     |
| DB-MIG-005       | `GroupProposal` model (member-propose INTEREST groups)              | ✅     |
| DB-MIG-006       | `IntroductionDrop` model + `Introduction` FK + early access fields  | ✅     |
| DB-MIG-007       | `ProfileEmbedding` model with pgvector `embedding vector(1536)`     | ✅     |
| DB-MIG-008       | `SystemConfig` key-value table (admin-configurable settings)        | ✅     |

---

## Phase 8a — `apps/seeder` (Automated Data Seeding) ✅
**Goal:** Standalone seeder service that continuously seeds realistic profile data for testing.
**Sprint:** 8a | **Status:** Complete — 2026-05-29. All seeder suites green.

| Task ID   | Description                                                                        | Status |
|-----------|------------------------------------------------------------------------------------|--------|
| SEED-001  | Seeder app scaffold — NX project, TS, BullMQ, Express control API, env guards     | ✅     |
| SEED-002  | Profile factory — 500 profiles across UK/Germany/Australia/Canada/India           | ✅     |
| SEED-003  | S3 photo assignment — reads `seeder/profile-photos/` prefix, assigns randomly     | ✅     |
| SEED-004  | SEEDER_SECRET gateway middleware — bypasses OTP, constructs req.user from token   | ✅     |
| SEED-005  | Group auto-join — seeder profiles join REGIONAL (auto) + suggested groups         | ✅     |
| SEED-006  | Activity simulator — connections, intro responses, RSVPs, prompts, habits, posts  | ✅     |
| SEED-007  | Drip scheduler — 3–5 new profiles at random offset within each 3–4 hour window   | ✅     |
| SEED-008  | Seeder control API — `POST /seed/run`, `POST /seed/flush`, `GET /seed/status`    | ✅     |
| SEED-009  | Matching re-run trigger — fires batch compute after each drip                     | ✅     |

---

## Phase 8b — `libs/ai` (AI Intelligence Layer) ✅
**Goal:** OpenAI-powered profile intelligence, semantic embeddings, and AI-driven intro group proposals.
**Sprint:** 8b | **Status:** Complete — 51 new tests (1,223 total, 89 suites, all green)

| Task ID  | Description                                                                            | Status |
|----------|----------------------------------------------------------------------------------------|--------|
| AI-001   | `libs/ai` scaffold — OpenAI singleton (gpt-4o-mini + text-embedding-3-small + Whisper)| ✅     |
| AI-002   | Profile intelligence service — `generateProfileIntelligence()` → ProfileEmbedding     | ✅     |
| AI-003   | Voice intro transcription — Whisper API on upload, stored in `voiceIntroTranscript`   | ✅     |
| AI-004   | Intro drop proposal — `proposeIntroductionDrops()` → DRAFT IntroductionDrop records   | ✅     |
| AI-005   | Event pre-connections — `generateEventPreConnections()` → auto-SCHEDULED drops         | ✅     |
| AI-006   | Quiet window generation — timezone-aware contact window stored in ProfileEmbedding     | ✅     |
| AI-007   | BullMQ job wiring — fires intelligence job on profile update, prompt, habit, voice    | ✅     |

---

## Phase 8c — Groups Revamp ✅
**Goal:** Full group taxonomy (REGIONAL/CULTURAL/PROFESSIONAL/INTEREST), social feed, suggested groups system.
**Sprint:** 8c | **Status:** Complete — 1,312 tests, 93 suites (all green)

| Task ID    | Description                                                                          | Status |
|------------|--------------------------------------------------------------------------------------|--------|
| GRP-R-001  | `libs/groups` refactor — type-based behaviour, auto-join REGIONAL country on register| ✅     |
| GRP-R-002  | Group suggestion engine — `listSuggestedGroups(userId, limit)` with profile matching | ✅     |
| GRP-R-003  | Group social feed service — posts, flat comments, likes, admin pin                   | ✅     |
| GRP-R-004  | Interest group proposal flow — propose → admin approves → group created              | ✅     |
| GRP-R-005  | Gateway endpoints — suggested, join/leave, members, posts CRUD                       | ✅     |
| GRP-R-006  | Admin endpoints — approve group proposals, pin posts, manage groups                  | ✅     |
| GRP-R-007  | Seeder group data — system groups for 5 countries + cities + professional umbrellas  | ✅     |

---

## Phase 8d — IntroductionDrop Feature ✅
**Goal:** Multi-drop intro system — AI-curated themed batches, personalised per-user pairings, early access via diamonds.
**Sprint:** 8d | **Status:** Complete — 2026-05-30. 1,407 tests, 97 suites all green.
> Supersedes old weekly-cap intro logic. No limit on intros per week. IntroductionDrop replaces weekKey gating.

| Task ID      | Description                                                                          | Status |
|--------------|--------------------------------------------------------------------------------------|--------|
| IDROP-001    | `libs/introductions` refactor — `listDropsForUser()`, remove weekKey cap             | ✅     |
| IDROP-002    | Drop pairing generation — AI picks 3–5 from pool per recipient on admin approval    | ✅     |
| IDROP-003    | Gateway endpoints — list drops, early-access, unlock, existing accept/decline        | ✅     |
| IDROP-004    | Admin endpoints — list/approve/adjust-members/manual-propose drops                   | ✅     |
| IDROP-005    | Diamond integration — `INTRO_EARLY_VIEW` + `INTRO_EARLY_UNLOCK` ledger reasons      | ✅     |
| IDROP-006    | Seeder exercises drops — activity simulator accepts/declines, spends diamonds        | ✅     |

---

## Phase 8e — Admin API + Analytics ✅
**Goal:** Admin panel API, user management, feature flag UI, audit logs, KPI dashboard — expanded to cover all Phase 8 models.
**Sprint:** 8e | **Status:** Complete 2026-06-01 — 1,492 tests, 99 suites
**Scoped update:** 2026-05-29 — expanded to cover GroupProposal, IntroductionDrop, SystemConfig, seeder monitoring, AI monitoring, and new analytics from Phase 8.

| Task ID    | Description                                                                    | Status |
|------------|--------------------------------------------------------------------------------|--------|
| ADMIN-001  | Admin login (bcrypt + TOTP) — AUTH-006 already done; wire admin-api app        | ✅     |
| ADMIN-002  | User management — list, suspend, unsuspend, ban, wipe seeded data               | ✅     |
| ADMIN-003  | Feature flag toggle API — list, create, get, update, delete                     | ✅     |
| ADMIN-004  | Verification review queue — approve/reject ID verification                       | ✅     |
| ADMIN-005  | Audit log viewer — paginated + filterable                                        | ✅     |
| ADMIN-006  | Flag/moderation queue + resolve + message hide/unhide                           | ✅     |
| ADMIN-007  | Core KPI dashboard (DAU/WAU/MAU, conversions, cohort retention)                 | ✅     |
| ADMIN-008  | Event management (create/update/cancel gatherings)                               | ✅     |
| ADMIN-009  | Weekly prompt management (create/get/update)                                     | ✅     |
| ADMIN-010  | Group management — full CRUD + pin posts + archive                               | ✅     |
| ADMIN-011  | IntroductionDrop management — approve/reject AI drops, schedule, monitor live    | ✅     |
| ADMIN-012  | AI proposal dashboard — propose drops, generate pre-connections via GPT          | ✅     |
| ADMIN-013  | GroupProposal management — list/approve/reject INTEREST group proposals          | ✅     |
| ADMIN-014  | SystemConfig management — CRUD for all admin-configurable key-value settings     | ✅     |
| ADMIN-015  | Seeder monitoring — view status, trigger flush, seeded record counts per entity  | ✅     |
| ADMIN-016  | AI/ProfileEmbedding monitoring — status, list, recompute one/all stale           | ✅     |
| ADMIN-017  | Extended analytics — group trends, drop engagement, diamonds, AI ratios          | ✅     |

**Key files:**
- `apps/gateway/src/controllers/admin/users-admin.controller.ts` — ADMIN-002 (16 tests)
- `apps/gateway/src/controllers/admin/feature-flags-admin.controller.ts` — ADMIN-003
- `apps/gateway/src/controllers/admin/verification-admin.controller.ts` — ADMIN-004
- `apps/gateway/src/controllers/admin/audit-log.controller.ts` — ADMIN-005
- `apps/gateway/src/controllers/admin/analytics-admin.controller.ts` — ADMIN-007 + ADMIN-017
- `apps/gateway/src/controllers/admin/events-admin.controller.ts` — ADMIN-008
- `apps/gateway/src/controllers/admin/prompts-admin.controller.ts` — ADMIN-009
- `apps/gateway/src/controllers/admin/groups-mgmt.controller.ts` — ADMIN-010
- `apps/gateway/src/controllers/admin/introductions-admin.controller.ts` — ADMIN-011 (25 tests)
- `apps/gateway/src/controllers/admin/ai-proposals.controller.ts` — ADMIN-012
- `apps/gateway/src/controllers/admin/groups-admin.controller.ts` — ADMIN-013 (17 tests)
- `apps/gateway/src/controllers/admin/system-config.controller.ts` — ADMIN-014
- `apps/gateway/src/controllers/admin/seeder-monitoring.controller.ts` — ADMIN-015
- `apps/gateway/src/controllers/admin/ai-monitoring.controller.ts` — ADMIN-016
- `apps/gateway/src/controllers/admin/payment-admin.controller.ts` — PAY-008 (refund)
- `apps/gateway/src/routes/admin/index.ts` — ALL routes wired up (55+ routes total)
- `apps/gateway/src/controllers/admin/__tests__/users-admin.controller.test.ts` — 16 tests
- `apps/gateway/src/controllers/admin/__tests__/phase8e-admin.controller.test.ts` — 69 tests
- `libs/auth/src/user-admin.service.ts` — listUsers, getUserAdminDetail, suspendUser, unsuspendUser, banUser, wipeSeededUser
- `libs/auth/src/audit-log-admin.service.ts` — listAuditLogs
- `libs/verification/src/verification-admin.service.ts` — listVerifications, getVerificationAdmin, approveVerification, rejectVerification
- `libs/gatherings/src/event-admin.service.ts` — listAdminEvents, getAdminEvent, createEvent, updateEvent, archiveEvent
- `libs/prompts/src/prompt-admin.service.ts` — listAdminPrompts, getAdminPrompt, createPrompt, updatePrompt
- `libs/groups/src/group-admin.service.ts` — listAdminGroups, getAdminGroup, createAdminGroup, updateAdminGroup, archiveAdminGroup
- `libs/analytics/src/kpi.service.ts` + `libs/analytics/src/extended.service.ts` — new analytics lib
- `apps/gateway/src/services/seeder-monitoring.service.ts` — gateway-side seeder status proxy

---

## Phase 9 — Habits / Consistency Hub ✅
**Goal:** Daily habit logging, streak tracking, weekly reflection, matching signal feed.
**Sprint:** 9 | **Status:** Complete — 2026-06-01

**Design decision:** Phase 9 uses the existing `HabitKey` enum model (10 preset habits).
No new `Habit` model with UUIDs — the preset catalog IS the habits list.
HABIT-001/002/003 were fully implemented in Phase 7b. HABIT-004→008 completed 2026-06-01.
One schema change: `habitSummaryVisible Boolean @default(false)` on `Profile` — run `prisma db push` locally.
**Test count after Phase 9: 1,546 tests, 101 suites — all green.**

| Task ID    | Description                                                                              | Status |
|------------|------------------------------------------------------------------------------------------|--------|
| HABIT-001  | `GET /api/v1/habits` — list all 10 preset habits with streaks *(done Phase 7b)*         | ✅     |
| HABIT-002  | `POST /api/v1/habits/:habitKey/log` + `DELETE /:habitKey/log/:date` *(done Phase 7b)*   | ✅     |
| HABIT-003  | `POST /api/v1/habits/reflection` + `GET /:habitKey/streak` *(done Phase 7b)*            | ✅     |
| HABIT-004  | `GET /api/v1/habits/streaks` — all habits' streak data + thisWeekDots (7-bool Mon–Sun)  | ✅     |
| HABIT-005  | `GET /api/v1/habits/reflection` — weekly rule-based insight, Redis cached 7 days        | ✅     |
| HABIT-006  | `PUT /api/v1/habits/summary-visibility` — toggle `Profile.habitSummaryVisible`          | ✅     |
| HABIT-007  | `GET /api/v1/habits/:habitKey/history?weeks=8` — per-habit chart data                  | ✅     |
| HABIT-008  | Habit consistency signal → optional matching dimensions 10+11 (backwards-compatible)    | ✅     |

---

## Phase 10 — Introductions (Weekly Drop) ✅
**Goal:** Curated 5-profile weekly drop, Sunday 9 AM GMT, group-specific, "Why this match?" explainer.
**Sprint:** 10 | **Status:** Complete — 2026-06-01

**Design decisions:**
- INTRO-002 already implemented (Phase 7b). Phase 10 adds detail, unlock, why-this-match text, weekly cron, match-context.
- "Why this match?" is pure rule-based (INTRO-005) with optional LLM enhancement (INTRO-006) when OPENAI_API_KEY set.
- LLM text cached in Redis 24h per pair (`am:why:{userAId}:{userBId}`). Falls back to rule-based on error/absence.
- Weekly drop cron: `0 9 * * 0` (Sunday 9 AM UTC) via BullMQ repeatable job. Auto-creates one drop per active group.
- Weekly drops are auto-approved (status SCHEDULED, no admin intervention needed for automation).
- Early unlock (INTRO-004) spends 300 diamonds, marks `viewedEarlyAt = now()` on all current-week introductions.
- `GET /profiles/:id/match-context` reads cached score or computes on demand; Redis-cached 1h.

| Task ID   | Description                                                          | Status |
|-----------|----------------------------------------------------------------------|--------|
| INTRO-001 | BullMQ job — compute weekly intro pool per group every Sunday 9 AM  | ✅     |
| INTRO-002 | `GET /api/v1/introductions` — this week's curated pool (max 5)      | ✅     |
| INTRO-003 | `GET /api/v1/introductions/:id` — detail with "why this match" text | ✅     |
| INTRO-004 | `POST /api/v1/introductions/unlock-early` — spend 300 diamonds      | ✅     |
| INTRO-005 | Rule-based "Why this match?" template generator (top 2-3 dimensions)| ✅     |
| INTRO-006 | LLM "Why this match?" cached generation (OpenAI, enhanced mode)     | ✅     |
| INTRO-007 | `GET /api/v1/profiles/:id/match-context` — score + dimension cards  | ✅     |

---

## Phase 11 — Gatherings / Events ✅
**Goal:** Community events, RSVP, smart "why invited" targeting, post-event group boost.
**Sprint:** 11 | **Status:** Complete — 2026-06-01

**Design decisions:**
- EVENT-001/003/004/005 already done (Phase 7b + 8e). Phase 11 adds EVENT-002 enhancements, EVENT-006, EVENT-007.
- EVENT-002: `whyInvited` rule-based text added to `EventDto`; `?limit` and `?upcoming` query params added.
- EVENT-006: `GET /api/v1/events/calendar` returns this week's milestones (intro drop, prompt window, events). Static route registered BEFORE `/:eventId`.
- EVENT-007: `getCoAttendancePairs(eventId)` returns all unique user pairs from GOING RSVPs. Gateway admin endpoint triggers score recompute for each pair via `@abroad-matrimony/matching`.

| Task ID   | Description                                                          | Status |
|-----------|----------------------------------------------------------------------|--------|
| EVENT-001 | Admin: `POST /admin/events` — create event *(done Phase 8e)*        | ✅     |
| EVENT-002 | `GET /api/v1/events` — events with personalized "why invited" text  | ✅     |
| EVENT-003 | `GET /api/v1/events/:id` — event detail *(done Phase 7b)*           | ✅     |
| EVENT-004 | `POST /api/v1/events/:id/rsvp` *(done Phase 7b)*                   | ✅     |
| EVENT-005 | `DELETE /api/v1/events/:id/rsvp` *(done Phase 7b)*                 | ✅     |
| EVENT-006 | `GET /api/v1/events/calendar` — this week's scheduled milestones    | ✅     |
| EVENT-007 | Post-event boost: co-attendance pairs → score recompute signal      | ✅     |

---

## Phase 12 — Weekly Prompts ✅
**Goal:** Weekly community question, voice/text answers, "Resonate" reaction, prompt spark → chat.
**Sprint:** 12 | **Status:** Complete (2026-06-02)

| Task ID    | Description                                                          | Status |
|------------|----------------------------------------------------------------------|--------|
| PROMPT-001 | Admin: `POST /admin/prompts` — create prompt (opens/closes schedule)| ✅     |
| PROMPT-002 | `GET /api/v1/prompts/current` — active prompt + 404 when none       | ✅     |
| PROMPT-003 | `POST /api/v1/prompts/current/response` — submit voice or text      | ✅     |
| PROMPT-004 | `GET /api/v1/prompts/current/responses` — community answers paged   | ✅     |
| PROMPT-005 | `POST /api/v1/prompts/responses/:id/resonate` — resonate reaction   | ✅     |
| PROMPT-006 | `DELETE /api/v1/prompts/responses/:id/resonate` — un-resonate       | ✅     |
| PROMPT-007 | Prompt resonance → matching algorithm dimension 12                  | ✅     |

---

## Phase 13 — Saved Profiles ✅
**Goal:** Private shortlist, compare mode, status labels, private notes.
**Sprint:** 13 | **Status:** Complete — 2026-06-02

**Design decisions:**
- Routes at `/api/v1/saved` (not `/api/v1/saved-profiles`). Body-based save (`POST /saved` with `savedUserId` in body, not path param).
- `PATCH /api/v1/saved/:savedUserId` handles both label and notes updates in one endpoint.
- `POST /api/v1/saved/:savedUserId/note` is a dedicated note-only endpoint (calls `updateSavedProfile` internally with just notes).
- `GET /api/v1/saved/compare?ids=uuid1,uuid2` — static route registered BEFORE `/:savedUserId` to prevent shadowing; validates all IDs are saved; returns enriched profile + realLifeAnswers data.
- `compareSavedProfiles` throws `ProfileNotSavedError` (404) if any ID is not in the requester's saved list.

| Task ID  | Description                                                          | Status |
|----------|----------------------------------------------------------------------|--------|
| SAVE-001 | `POST /api/v1/saved` — save with optional label (body: savedUserId) | ✅     |
| SAVE-002 | `GET /api/v1/saved` — list saved profiles (optional label filter)   | ✅     |
| SAVE-003 | `DELETE /api/v1/saved/:savedUserId` — remove from shortlist         | ✅     |
| SAVE-004 | `PATCH /api/v1/saved/:savedUserId` — update label and/or notes      | ✅     |
| SAVE-005 | `POST /api/v1/saved/:savedUserId/note` — private note endpoint      | ✅     |
| SAVE-006 | `GET /api/v1/saved/compare?ids=a,b` — compare 2–3 profiles         | ✅     |

**Key files:**
- `libs/saved-profiles/src/index.ts` — added `compareSavedProfiles()`, `ProfileNotSavedError`, `CompareProfileDto`, `RealLifeAnswerSummary`
- `apps/gateway/src/routes/saved/index.ts` — all 6 routes wired (compare static route first)
- `apps/gateway/src/controllers/saved/saved.controller.ts` — added `addNote` + `compare` handlers; `ProfileNotSavedError` in error mapper
- `apps/gateway/src/schemas/saved/saved.schema.ts` — added `addNoteSchema` + `compareQuerySchema` + types
- `apps/gateway/src/constants/saved.constants.ts` — added `PROFILE_NOT_SAVED` error + `NOTE_ADDED` message
- `apps/gateway/src/controllers/saved/__tests__/saved.controller.test.ts` — 27 tests (was 11, +16 new)
- `libs/saved-profiles/src/__tests__/saved-profiles.service.test.ts` — 16 tests (was 12, +4 for compareSavedProfiles)
- `docs/api/openapi.yaml` — saved profiles section replaced to match actual implementation; compare endpoint added
- `docs/api/postman-collection.json` — 6 requests updated/added in Saved Profiles folder

---

## Phase 14 — Signals Dashboard ✅
**Goal:** Weekly analytics (profile views, connections, resonates), action queue, momentum chart.
**Sprint:** 14 | **Status:** Complete — 2026-06-02

**Design decisions:**
- New `libs/signals` library (separate from `libs/trust`). `getSignals()` in trust stays for backward compat.
- `ProfileView` model added to Prisma schema — `viewerId`, `viewedId`, `viewedAt`, deduplication within 1-hour window.
- `logProfileView` lives in `libs/signals`; `POST /api/v1/profiles/:id/view` lives in the profiles router (calling signalsController.logView).
- Weekly metrics: views this week vs. prev week = delta. introPoolSize delta always 0 (no prev-week comparison defined).
- Action queue priority: 1=RESPOND_TO_INTRO, 2=ACCEPT_CONNECTION, 3=COMPLETE_PROFILE (score < 80).
- Momentum: 7 sequential `prisma.profileView.count` calls (one per day); ordered oldest→newest.
- ⚠️ Schema change: `ProfileView` model added — run `prisma db push` locally.

| Task ID     | Description                                                          | Status |
|-------------|----------------------------------------------------------------------|--------|
| SIGNAL-001  | `POST /api/v1/profiles/:id/view` — log profile view (deduped 1h)    | ✅     |
| SIGNAL-002  | `GET /api/v1/signals/week` — 4 weekly metrics with WoW delta        | ✅     |
| SIGNAL-003  | `GET /api/v1/signals/action-queue` — prioritized next-step list     | ✅     |
| SIGNAL-004  | `GET /api/v1/signals/momentum` — 7-day daily view bar chart data    | ✅     |

**Key files:**
- `libs/db/prisma/schema.prisma` — `ProfileView` model + relations on User ⚠️ run `prisma db push`
- `libs/signals/src/index.ts` — `logProfileView`, `getWeeklyMetrics`, `getActionQueue`, `getMomentumData`, `ViewSelfError`, DTOs
- `libs/signals/package.json` + `jest.config.ts`
- `libs/signals/src/__tests__/signals.service.test.ts` — 13 tests
- `apps/gateway/src/controllers/signals/signals.controller.ts` — added `logView`, `getWeek`, `getActionQueue`, `getMomentum` handlers
- `apps/gateway/src/routes/signals/index.ts` — 3 new sub-routes (`/week`, `/action-queue`, `/momentum`)
- `apps/gateway/src/routes/profiles/index.ts` — `POST /:id/view` added (static before `/:id`)
- `apps/gateway/src/constants/signals.constants.ts` — `VIEW_SELF` error + `VIEW_LOGGED` message
- `apps/gateway/src/controllers/signals/__tests__/signals.controller.test.ts` — 14 tests (was 3, +11 new)
- `jest.preset.js` + `tsconfig.base.json` + `apps/gateway/jest.config.ts` — `@abroad-matrimony/signals` alias added
- `docs/api/openapi.yaml` — 4 new paths added (view, week, action-queue, momentum)
- `docs/api/postman-collection.json` — 5 requests updated in Signals folder

---

## Phase 15 — Trust Center ✅
**Goal:** Trust score, multi-layer verification status, privacy controls, access levels, block/report/pause.
**Sprint:** 15 | **Status:** Complete — 2026-06-02

**Design decisions:**
- Block/unblock/report/list-blocks were already implemented in Phase 7b under `/api/v1/trust/*`. TRUST-006/007/008 counted as done at those paths.
- TRUST-001/002: Trust score = composite of 6 layers (PHONE:20, PROFILE_COMPLETE:20, PHOTO:15, ID_VERIFIED:25, EMAIL:10, VOICE:10). Max 100. Score persisted on Profile.trustScore on every GET.
- `GET /api/v1/trust` returns full dashboard: score, all 6 layers, isPaused, privacySettings.
- TRUST-003: `privacySettings Json?` field added to Profile Prisma model. Merged on update (partial updates supported). ⚠️ run `prisma db push` locally.
- TRUST-004/005: Explicit `POST /pause-visibility` (sets isPaused=true) and `DELETE /pause-visibility` (sets isPaused=false). Existing `PUT /profile/pause` toggle kept for backward compat.
- TRUST-009: `getAccessLevelDefinitions()` is a pure function (no DB). Returns PUBLIC, TRUSTED, FAMILY with visibleFields arrays.

| Task ID    | Description                                                               | Status |
|------------|---------------------------------------------------------------------------|--------|
| TRUST-001  | Trust score calculation — 6-layer composite (max 100), persisted on GET  | ✅     |
| TRUST-002  | `GET /api/v1/trust` — score + layers + isPaused + privacySettings         | ✅     |
| TRUST-003  | `PUT /api/v1/profile/privacy-controls` — partial-merge privacy settings   | ✅     |
| TRUST-004  | `POST /api/v1/profile/pause-visibility` — explicit pause                  | ✅     |
| TRUST-005  | `DELETE /api/v1/profile/pause-visibility` — explicit resume               | ✅     |
| TRUST-006  | `POST /api/v1/trust/block` — block user (done Phase 7b)                  | ✅     |
| TRUST-007  | `DELETE /api/v1/trust/block/:userId` — unblock (done Phase 7b)           | ✅     |
| TRUST-008  | `GET /api/v1/trust/blocks` — list blocked users (done Phase 7b)          | ✅     |
| TRUST-009  | `GET /api/v1/profile/access-levels` — PUBLIC/TRUSTED/FAMILY definitions   | ✅     |

**Key files:**
- `libs/db/prisma/schema.prisma` — Profile: `privacySettings Json?` added ⚠️ run `prisma db push`
- `libs/trust/src/index.ts` — added `getTrustCenter`, `setPrivacyControls`, `pauseVisibility`, `resumeVisibility`, `getAccessLevelDefinitions`; error classes: `TrustCenterNotFoundError`, `PrivacyProfileNotFoundError`, `PauseProfileNotFoundError`; DTOs: `TrustLayer`, `TrustCenterDto`, `PrivacySettingsDto`, `AccessLevelDto`
- `libs/trust/src/__tests__/trust.service.test.ts` — 26 tests (was 15, +11 new)
- `apps/gateway/src/controllers/trust/trust.controller.ts` — added `getTrustCenter`, `setPrivacyControls`, `pauseVisibility`, `resumeVisibility`, `getAccessLevels` handlers
- `apps/gateway/src/routes/trust/index.ts` — `GET /` added
- `apps/gateway/src/routes/profile/index.ts` — 4 new routes: `PUT /privacy-controls`, `POST /pause-visibility`, `DELETE /pause-visibility`, `GET /access-levels`
- `apps/gateway/src/schemas/trust/trust.schema.ts` — `privacyControlsSchema` added
- `apps/gateway/src/constants/trust.constants.ts` — `PROFILE_NOT_FOUND` error + 3 new messages
- `apps/gateway/src/controllers/trust/__tests__/trust.controller.test.ts` — 42 tests (was 13, +29 new)
- `docs/api/openapi.yaml` — Trust Center section replaced; 6 new paths added
- `docs/api/postman-collection.json` — Trust Center folder replaced with 9 requests

---

## Phase 16 — Algorithm v2 + Match Tuning ✅
**Goal:** 9 new matching dimensions, per-dimension UI output, Match Tuning endpoint, signals integration.
**Sprint:** 16 | **Status:** Complete — 2026-06-02

**Design decisions:**
- ALG-001/002/003 were already done in HABIT-008 + PROMPT-007 (habitConsistency, habitOverlap, promptResonance).
- 5 new optional dimensions follow the same opt-in pattern as habits/prompts: only computed when both users have the relevant data.
- Tuning weights were stored but never applied. Now wired into `getDiscoveryFeed` — `applyTuningToBreakdown()` computes a personalised score from the stored breakdown; items re-sorted by `personalizedScore` within each page.
- `DiscoveryItemDto` extended with `personalizedScore` field (equals `totalScore` when no tuning active).
- ALG-011: `/api/v1/profile/match-tuning` (GET+POST) provides simplified 2-question UI (1–5 ratings) that translates to dimension multipliers. Stored in existing `MatchTuning` model.
- ALG-012: `/api/v1/profile/match-tuning/impact` reads top 20 stored MatchScore breakdowns and applies proposed weights — returns profilesUp/Down/Unchanged + topGainers list.
- ALG-013: controller calls `enqueueScoreRecompute` fire-and-forget after both `PUT /matches/tuning` and `POST /profile/match-tuning`.
- Scoring v2 weight budget: each new opt-in dim has a small allocation; when all present coreScale can go as low as 0.80.

| Task ID    | Description                                                               | Status |
|------------|---------------------------------------------------------------------------|--------|
| ALG-001    | Dim 10: habitConsistency *(done HABIT-008)*                               | ✅     |
| ALG-002    | Dim 11: habitOverlap *(done HABIT-008)*                                   | ✅     |
| ALG-003    | Dim 12: promptResonance *(done PROMPT-007)*                               | ✅     |
| ALG-004    | Dim 13: `familyInvolvement` — Jaccard of PARENTS_INVOLVEMENT answers     | ✅     |
| ALG-005    | Dim 14: family tuning Q2 — `familyImportance` maps to `familyInvolvement` multiplier | ✅ |
| ALG-006    | Dim 15: `eventCoAttendance` — 1.0 if any shared GOING RSVP               | ✅     |
| ALG-007    | Dim 16: `communicationStyle` — both voice intros: 1.0; one: 0.5; neither: 0.0 | ✅ |
| ALG-008    | Dim 17: `profileViewMomentum` — avg normalised 7-day view count          | ✅     |
| ALG-009    | Dim 18: `trustLayerDepth` — avg trust score / 100                        | ✅     |
| ALG-010    | Per-dimension output in match context — `ScoreBreakdown` now has 18 fields | ✅   |
| ALG-011    | `GET/POST /api/v1/profile/match-tuning` — 2-question simplified UI       | ✅     |
| ALG-012    | `GET /api/v1/profile/match-tuning/impact` — preview rank changes         | ✅     |
| ALG-013    | BullMQ recompute triggered on every tuning save                          | ✅     |

**Key files:**
- `libs/shared/src/types/index.ts` — `ScoreBreakdown` extended with 5 new optional fields; `DiscoveryItemDto` extended with `personalizedScore`
- `libs/matching/src/scoring.service.ts` — `V2_DIM_WEIGHTS` constant; 5 new scorer functions; `applyTuningToBreakdown()` export; `UserScoringData` extended with 4 new v2 optional fields
- `libs/matching/src/match-score.service.ts` — 2 new parallel queries (eventRsvp, profileView.count); profile select extended (voiceIntroTranscript, trustScore)
- `libs/matching/src/match-tuning.service.ts` — `TuningQuestionsDto`, `TuningImpactDto`; `importanceToMultiplier()`, `multiplierToImportance()`; `setTuningFromQuestions()`, `getTuningAsQuestions()`, `computeTuningImpact()`
- `libs/matching/src/discover.service.ts` — imports `getMatchTuning` + `applyTuningToBreakdown`; fetches tuning, adds `personalizedScore`, re-sorts by personalizedScore when tuning active
- `libs/matching/src/index.ts` — added new exports
- `libs/matching/src/__tests__/scoring.service.test.ts` — 26 new ALG-004 through ALG-009 tests
- `libs/matching/src/__tests__/match-score.service.test.ts` — eventRsvp + profileView mocks added; 6 new v2 field tests; DB_PROFILE extended
- `libs/matching/src/__tests__/discover.service.test.ts` — matchTuning.findUnique mock added
- `apps/gateway/src/schemas/matches/matches.schema.ts` — `matchTuningQuestionsSchema` + `tuningImpactQuerySchema`
- `apps/gateway/src/controllers/matches/tuning.controller.ts` — added `getQuestions`, `setQuestions`, `getImpact` handlers; `set` now fires recompute (ALG-013)
- `apps/gateway/src/routes/profile/index.ts` — 3 new routes: `GET/POST /match-tuning`, `GET /match-tuning/impact`
- `apps/gateway/src/controllers/matches/__tests__/tuning.controller.test.ts` — 19 tests (was 7, +12 new)
- `docs/api/openapi.yaml` — Match Tuning section replaced; 3 new paths
- `docs/api/postman-collection.json` — Match Tuning folder updated with 5 requests
