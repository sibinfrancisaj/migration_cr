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

**Final counts:** `openapi.yaml` 4,195 lines · 89 paths · `postman-collection.json` 1,955 lines

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

## Phase 8d — IntroductionDrop Feature ⏳
**Goal:** Multi-drop intro system — AI-curated themed batches, personalised per-user pairings, early access via diamonds.
**Sprint:** 8d | **Status:** Backlog (starts after Phase 8b + 8c)
> Supersedes old weekly-cap intro logic. No limit on intros per week. IntroductionDrop replaces weekKey gating.

| Task ID      | Description                                                                          | Status |
|--------------|--------------------------------------------------------------------------------------|--------|
| IDROP-001    | `libs/introductions` refactor — `listDropsForUser()`, remove weekKey cap             | ⏳     |
| IDROP-002    | Drop pairing generation — AI picks 3–5 from pool per recipient on admin approval    | ⏳     |
| IDROP-003    | Gateway endpoints — list drops, early-access, unlock, existing accept/decline        | ⏳     |
| IDROP-004    | Admin endpoints — list/approve/adjust-members/manual-propose drops                   | ⏳     |
| IDROP-005    | Diamond integration — `INTRO_EARLY_VIEW` + `INTRO_EARLY_UNLOCK` ledger reasons      | ⏳     |
| IDROP-006    | Seeder exercises drops — activity simulator accepts/declines, spends diamonds        | ⏳     |

---

## Phase 8e — Admin API + Analytics ⏳
**Goal:** Admin panel API, user management, feature flag UI, audit logs, KPI dashboard — expanded to cover all Phase 8 models.
**Sprint:** 8e | **Status:** Backlog (starts after Phase 8a data exists — meaningful dashboards need data)
**Scoped update:** 2026-05-29 — expanded to cover GroupProposal, IntroductionDrop, SystemConfig, seeder monitoring, AI monitoring, and new analytics from Phase 8.

| Task ID    | Description                                                                    | Status |
|------------|--------------------------------------------------------------------------------|--------|
| ADMIN-001  | Admin login (bcrypt + TOTP) — AUTH-006 already done; wire admin-api app        | ⏳     |
| ADMIN-002  | User management — list, suspend, ban, wipe seeded data                          | ⏳     |
| ADMIN-003  | Feature flag toggle API                                                          | ⏳     |
| ADMIN-004  | Verification review queue — approve/reject ID verification                       | ⏳     |
| ADMIN-005  | Audit log viewer                                                                 | ⏳     |
| ADMIN-006  | Flag/moderation queue + resolve + message hide/unhide                           | ⏳     |
| ADMIN-007  | Core KPI dashboard (DAU, conversions, match rates, connection funnel)           | ⏳     |
| ADMIN-008  | Event management (create/update/cancel gatherings)                               | ⏳     |
| ADMIN-009  | Weekly prompt management (create/schedule/close)                                 | ⏳     |
| ADMIN-010  | Group management — provision REGIONAL/CULTURAL/PROFESSIONAL, pin posts, archive | ⏳     |
| ADMIN-011  | IntroductionDrop management — approve/reject AI drops, schedule, monitor live    | ⏳     |
| ADMIN-012  | AI proposal dashboard — review DRAFT drops proposed by AI before approval        | ⏳     |
| ADMIN-013  | GroupProposal management — list/approve/reject INTEREST group proposals          | ⏳     |
| ADMIN-014  | SystemConfig management — CRUD for all admin-configurable key-value settings     | ⏳     |
| ADMIN-015  | Seeder monitoring — view status, trigger flush, seeded record counts per entity  | ⏳     |
| ADMIN-016  | AI/ProfileEmbedding monitoring — embedding status, trigger re-runs, queue depth  | ⏳     |
| ADMIN-017  | Extended analytics — group trends, drop engagement, diamond early access spend, AI vs admin approval ratios | ⏳ |

---

## Phase 9 — Habits / Consistency Hub ⏳
**Goal:** Daily habit logging, streak tracking, weekly reflection, matching signal feed.
**Sprint:** 9 | **Status:** Backlog

| Task ID    | Description                                                            | Status |
|------------|------------------------------------------------------------------------|--------|
| HABIT-001  | `POST /api/v1/habits` — create habit (name, icon)                     | ⏳     |
| HABIT-002  | `GET /api/v1/habits` + `PUT` + `DELETE` — manage habits               | ⏳     |
| HABIT-003  | `POST /api/v1/habits/:id/log` — log today's completion                | ⏳     |
| HABIT-004  | `GET /api/v1/habits/streaks` — all habits' streak data + weekly dots  | ⏳     |
| HABIT-005  | `GET /api/v1/habits/reflection` — weekly AI-generated insight text     | ⏳     |
| HABIT-006  | `PUT /api/v1/habits/summary-visibility` — toggle visible on profile    | ⏳     |
| HABIT-007  | `GET /api/v1/habits/:id/history` — streak history (chart data)        | ⏳     |
| HABIT-008  | Habit consistency signal → matching algorithm dimension 10 + 11       | ⏳     |

---

## Phase 10 — Introductions (Weekly Drop) ⏳
**Goal:** Curated 5-profile weekly drop, Sunday 9 AM GMT, group-specific, "Why this match?" explainer.
**Sprint:** 10 | **Status:** Backlog

| Task ID   | Description                                                          | Status |
|-----------|----------------------------------------------------------------------|--------|
| INTRO-001 | BullMQ job — compute weekly intro pool per group every Sunday 9 AM  | ⏳     |
| INTRO-002 | `GET /api/v1/introductions` — this week's curated pool (max 5)      | ⏳     |
| INTRO-003 | `GET /api/v1/introductions/:id` — detail with "why this match" text | ⏳     |
| INTRO-004 | `POST /api/v1/introductions/unlock-early` — spend 300 credits       | ⏳     |
| INTRO-005 | Rule-based "Why this match?" template generator (top 2-3 dimensions)| ⏳     |
| INTRO-006 | LLM "Why this match?" cached generation (Claude API, enhanced mode) | ⏳     |
| INTRO-007 | `GET /api/v1/profiles/:id/match-context` — score + dimension cards  | ⏳     |

---

## Phase 11 — Gatherings / Events ⏳
**Goal:** Community events, RSVP, smart "why invited" targeting, post-event group boost.
**Sprint:** 11 | **Status:** Backlog

| Task ID   | Description                                                          | Status |
|-----------|----------------------------------------------------------------------|--------|
| EVENT-001 | Admin: `POST /admin/events` — create event (tags, virtual, moderated)| ⏳    |
| EVENT-002 | `GET /api/v1/events` — events with personalized "why invited" text  | ⏳     |
| EVENT-003 | `GET /api/v1/events/:id` — event detail                             | ⏳     |
| EVENT-004 | `POST /api/v1/events/:id/rsvp` — RSVP (check group eligibility)    | ⏳     |
| EVENT-005 | `DELETE /api/v1/events/:id/rsvp` — cancel RSVP                     | ⏳     |
| EVENT-006 | `GET /api/v1/events/calendar` — this week's scheduled milestones    | ⏳     |
| EVENT-007 | Post-event boost: event attendance → next group relevance signal    | ⏳     |

---

## Phase 12 — Weekly Prompts ⏳
**Goal:** Weekly community question, voice/text answers, "Resonate" reaction, prompt spark → chat.
**Sprint:** 12 | **Status:** Backlog

| Task ID    | Description                                                          | Status |
|------------|----------------------------------------------------------------------|--------|
| PROMPT-001 | Admin: `POST /admin/prompts` — create prompt (opens/closes schedule)| ⏳     |
| PROMPT-002 | `GET /api/v1/prompts/current` — active prompt + 3-day countdown     | ⏳     |
| PROMPT-003 | `GET /api/v1/prompts/current/responses` — community answers paged   | ⏳     |
| PROMPT-004 | `POST /api/v1/prompts/current/response` — submit voice or text      | ⏳     |
| PROMPT-005 | `POST /api/v1/prompts/responses/:id/resonate` — resonate reaction   | ⏳     |
| PROMPT-006 | `DELETE /api/v1/prompts/responses/:id/resonate` — un-resonate       | ⏳     |
| PROMPT-007 | Prompt resonance → matching algorithm dimension 12                  | ⏳     |

---

## Phase 13 — Saved Profiles ⏳
**Goal:** Private shortlist, compare mode, status labels, private notes.
**Sprint:** 13 | **Status:** Backlog

| Task ID  | Description                                                          | Status |
|----------|----------------------------------------------------------------------|--------|
| SAVE-001 | `POST /api/v1/saved-profiles/:userId` — save with optional label    | ⏳     |
| SAVE-002 | `GET /api/v1/saved-profiles` — list saved profiles                  | ⏳     |
| SAVE-003 | `DELETE /api/v1/saved-profiles/:userId` — remove from shortlist     | ⏳     |
| SAVE-004 | `PUT /api/v1/saved-profiles/:userId/label` — High fit/Expiring/Maybe| ⏳    |
| SAVE-005 | `POST /api/v1/saved-profiles/:userId/note` — private note           | ⏳     |
| SAVE-006 | `GET /api/v1/saved-profiles/compare?ids=a,b` — compare 2 profiles  | ⏳     |

---

## Phase 14 — Signals Dashboard ⏳
**Goal:** Weekly analytics (profile views, connections, chats), action queue, momentum chart.
**Sprint:** 14 | **Status:** Backlog

| Task ID     | Description                                                       | Status |
|-------------|-------------------------------------------------------------------|--------|
| SIGNAL-001  | Profile view event logging (userId, viewedBy, viewedAt)          | ⏳     |
| SIGNAL-002  | `GET /api/v1/signals/week` — 4 weekly metrics with delta         | ⏳     |
| SIGNAL-003  | `GET /api/v1/signals/action-queue` — prioritized next-step list  | ⏳     |
| SIGNAL-004  | `GET /api/v1/signals/momentum` — 7-day profile view bar data     | ⏳     |

---

## Phase 15 — Trust Center ⏳
**Goal:** Trust score, multi-layer verification status, privacy controls, access levels, block/report/pause.
**Sprint:** 15 | **Status:** Backlog

| Task ID    | Description                                                            | Status |
|------------|------------------------------------------------------------------------|--------|
| TRUST-001  | Trust score calculation (composite of verified layers)                 | ⏳     |
| TRUST-002  | `GET /api/v1/trust-center` — score + all verification layer statuses  | ⏳     |
| TRUST-003  | `PUT /api/v1/profile/privacy-controls` — what's visible before mutual | ⏳     |
| TRUST-004  | `POST /api/v1/profile/pause-visibility` — pause appearing in discover | ⏳     |
| TRUST-005  | `DELETE /api/v1/profile/pause-visibility` — resume visibility         | ⏳     |
| TRUST-006  | `POST /api/v1/users/:id/block` — block a user                        | ⏳     |
| TRUST-007  | `DELETE /api/v1/users/:id/block` — unblock                           | ⏳     |
| TRUST-008  | `GET /api/v1/users/blocked` — list blocked users                      | ⏳     |
| TRUST-009  | `GET /api/v1/profile/access-levels` — Basic/Trusted/Family-aware defs| ⏳     |

---

## Phase 16 — Algorithm v2 + Match Tuning ⏳
**Goal:** 9 new matching dimensions, per-dimension UI output, Match Tuning endpoint, signals integration.
**Sprint:** 16 | **Status:** Backlog

| Task ID    | Description                                                            | Status |
|------------|------------------------------------------------------------------------|--------|
| ALG-001    | Dimension 10: Weekly rhythm similarity (from habit log patterns)       | ⏳     |
| ALG-002    | Dimension 11: Consistency score (habit streak + variance)              | ⏳     |
| ALG-003    | Dimension 12: Prompt resonance (shared resonate actions)               | ⏳     |
| ALG-004    | Dimension 13: Settlement intent alignment (Match Tuning Q1)            | ⏳     |
| ALG-005    | Dimension 14: Family involvement style (Match Tuning Q2)               | ⏳     |
| ALG-006    | Dimension 15: Event co-attendance boost                                | ⏳     |
| ALG-007    | Dimension 16: Communication style (voice intro present, prompt depth)  | ⏳     |
| ALG-008    | Dimension 17: Profile view momentum (recency of activity)              | ⏳     |
| ALG-009    | Dimension 18: Trust layer depth (verification completeness)            | ⏳     |
| ALG-010    | Per-dimension score output in match detail response                    | ⏳     |
| ALG-011    | `GET /api/v1/profile/match-tuning` + `POST` — 2 high-impact Q answers | ⏳     |
| ALG-012    | `GET /api/v1/profile/match-tuning/impact` — preview rank change        | ⏳     |
| ALG-013    | BullMQ re-score job triggered on match-tuning answer save              | ⏳     |
