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

### API documentation maintenance
These rules apply every time an endpoint is added, changed, or removed.

**Files to keep in sync:**
- `docs/api/openapi.yaml` — OpenAPI 3.1.0 spec (source of truth for the API contract)
- `docs/api/postman-collection.json` — Postman Collection v2.1

**Triggers — update BOTH files when:**
- A new route is added to any `apps/gateway/src/routes/` file
- An existing route path, method, or auth requirement changes
- A request body field is added, renamed, or removed
- A response body field is added, renamed, or removed
- A new enum value is added to `libs/shared/src/enums/index.ts` or any domain type
- A new error code or HTTP status is introduced for an existing endpoint
- A webhook signature header requirement changes

**How:**
1. Add the new `path` block to `openapi.yaml` under the correct tag
2. Add the new request item to the matching folder in `postman-collection.json`
3. Validate: `npx @redocly/cli lint docs/api/openapi.yaml`
4. Commit both files in the same commit as the implementation

**Rule:** A task is not Done until `openapi.yaml` and `postman-collection.json` are updated and valid.
Full maintenance guide: `docs/api/STANDARDS.md`.

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
│   ├── matching/         ← Scoring algorithm, BullMQ worker, cache (Phase 4 — complete)
│   ├── firebase/         ← Firebase Admin SDK singleton (Firestore, FCM, Realtime DB)
│   ├── messaging/        ← MessagingAdapter pattern (Firestore prod, Mock dev/test)
│   ├── connections/      ← Phase 5 stub (error classes, service stubs)
│   ├── groups/           ← Phase 5+ stub
│   ├── notification/     ← NOT YET BUILT (Twilio, Brevo, Firebase adapters)
│   ├── payment/          ← NOT YET BUILT (Stripe, Razorpay, diamond ledger)
│   └── storage/          ← S3 upload adapter (Phase 3 — complete)
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

## 6. Completed — Phase 3: Profile ✅

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **PROF-001** | `POST /api/v1/profile` — create profile (name, DOB, gender, city, country, settlementIntent, bio?) | ✅ Done |
| **PROF-002** | `PUT /api/v1/profile/real-life/:questionKey` — upsert real-life answer | ✅ Done |
| **PROF-003** | `PUT /api/v1/profile/story/:promptKey` — upsert story prompt | ✅ Done |
| **PROF-004** | `POST /api/v1/profile/media` — S3 photo upload (multer + `libs/storage`) | ✅ Done |
| **PROF-005** | Profile completion score calculation | ✅ Done |
| **PROF-006** | `GET /api/v1/profile/me` + `GET /api/v1/profiles/:id` | ✅ Done |

**Phase 3 complete: 344 tests, 29 suites all green.**

**Key decisions already made (Phase 2 Auth — complete):**
- `USER_REGISTERED` CloudEvent fires in AUTH-002 (not AUTH-001) — after the user row is confirmed written to DB. See BUG-001 in `project-management/bugs.md`. ✅ Implemented.
- `DeviceLimitError` → HTTP 409 Conflict; existing fingerprint bypasses device count check.

---

## 6b. Complete — Phase 4: Matching ✅

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **MATCH-001** | `libs/matching` — scoring algorithm v1 (9 dimensions) + DB persistence | ✅ Done |
| **MATCH-002** | BullMQ worker — batch-compute all user pairs | ✅ Done |
| **MATCH-003** | Redis-cached score lookup | ✅ Done |
| **MATCH-004** | `GET /api/v1/discover` — paginated discovery feed | ✅ Done |
| **MATCH-005** | Feature-flag gate for algorithm v2 | ✅ Done |

**Phase 4 complete: 497 tests, 35 suites all green (+36 tests from MATCH-004/005).**

**Key files from MATCH-004/005:**
- `libs/matching/src/discover.service.ts` — `getDiscoveryFeed()`, `encodeCursor()`, `decodeCursor()`, `computeAge()`
- `apps/gateway/src/controllers/discover/discover.controller.ts` — lazy `FeatureFlagService` singleton + `discoverController.getFeed`
- `apps/gateway/src/routes/discover/index.ts` — GET / with `requireAuth` + `validateQuery(discoverQuerySchema)`
- `apps/gateway/src/schemas/discover/discover.schema.ts` — `discoverQuerySchema` (cursor + limit 1–100)
- `apps/gateway/src/lib/feature-flag-store.ts` — `PrismaFeatureFlagStore`
- `libs/connections/src/index.ts` + `libs/groups/src/index.ts` — Phase 5 stub packages (created to unblock tests)
- `apps/gateway/src/routes/connections/index.ts` — empty router stub (Phase 5 placeholder)

---

## 6c. Complete — Phase 5: Messaging ✅

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **MSG-000** | `libs/messaging` scaffold + `libs/firebase` singleton + Prisma schema updates | ✅ Done |
| **MSG-001** | `GET /api/v1/conversations` + `GET /:convId/messages` — REST endpoints | ✅ Done |
| **MSG-002** | `POST /api/v1/conversations/:convId/messages` + `GET /:convId/upload-url` | ✅ Done |
| **MSG-003** | `GET /api/v1/auth/firebase-token` + Firestore security rules documentation | ✅ Done |
| **MSG-004** | `POST /api/v1/conversations/:convId/read` — read receipts REST fallback | ✅ Done |
| **MSG-005** | `POST /api/v1/messages/:msgId/flag` + admin flag moderation | ✅ Done |

**Phase 5 complete: 664 tests, 47 suites all green.**

**Key files from MSG-003/004/005:**
- `libs/firebase/src/firebase.ts` — added `getFirebaseAuth()`
- `libs/messaging/src/firebase-token.service.ts` — `createFirebaseToken()`, `FirebaseNotConfiguredError`
- `libs/messaging/src/read-receipt.service.ts` — `markConversationRead()`, `MessageNotFoundForReadError`
- `libs/messaging/src/flag-message.service.ts` — `flagMessage()`, `getAdminFlagSummary()`, `resolveFlag()`, `FlagDto`, error classes
- `libs/messaging/src/adapters/base.messaging.adapter.ts` — `MessagingAdapter` interface (added `hideMessage`, `unhideMessage`)
- `apps/gateway/src/controllers/auth/firebase-token.controller.ts`
- `apps/gateway/src/controllers/conversations/conversations.controller.ts` — added `markRead` handler
- `apps/gateway/src/controllers/messages/messages.controller.ts`
- `apps/gateway/src/controllers/admin/flags.controller.ts`
- `apps/gateway/src/routes/messages/index.ts` — new `POST /:msgId/flag` router
- `apps/gateway/src/routes/admin/index.ts` — flag moderation routes added
- `apps/gateway/src/constants/flag.constants.ts`
- `docs/firestore-security-rules.md` — complete Flutter auth flow + Firestore security rules

**Key files from MSG-002:**
- `libs/messaging/src/send-message.service.ts` — `sendMessage()`, `getUploadUrl()`, `ConversationArchivedError`, `trySendFcmPush()`
- `apps/gateway/src/schemas/conversations/send-message.schema.ts`
- `apps/gateway/src/routes/conversations/index.ts` — 6 routes total (added `POST /:convId/read`)

**Key files from MSG-001:**
- `libs/messaging/src/conversation.service.ts` — `listConversations()`, `getConversation()`, `getConversationMessages()`

**Key files from MSG-000:**
- `libs/firebase/src/firebase.ts` — `initFirebase()`, `getFirestoreDb()`, `getRealtimeDb()`, `getFirebaseMessaging()`, `shutdownFirebase()`, `isFirebaseConfigured()`
- `libs/messaging/src/adapters/base.messaging.adapter.ts` — `MessagingAdapter` interface
- `libs/messaging/src/adapters/firestore.messaging.adapter.ts` — Firestore production adapter
- `libs/messaging/src/adapters/mock.messaging.adapter.ts` — in-memory mock; `_reset()` for test isolation
- `libs/messaging/src/types/messaging.types.ts` — `MessageDto`, `ConversationSummaryDto`, `OtherUserSummary`, `FlagMessageParams`, etc.
- `apps/gateway/src/server.ts` — Firebase init/shutdown wired into lifecycle

**Prisma schema changes (MSG-000 — already applied, must run prisma db push locally):**
- `MessageType` enum: added `IMAGE`
- `Message` model: added `mediaUrl String?`, `durationSeconds Int?`, `flagCount Int @default(0)`, `isHidden Boolean @default(false)`, `content` default `""`
- New enums: `FlagReason` (6 values), `FlagAction` (5 values)
- `Flag` model: `reason String` → `reason FlagReason`, added `actionTaken FlagAction?`, `firestoreMsgId String?`

> **IMPORTANT:** `prisma db push` must be run locally — cloud runner cannot reach Supabase.

---

## 6d. Complete — Phase 6: Notifications ✅

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **NOTIF-001** | `libs/notification` Brevo email adapter | ✅ Done |
| **NOTIF-002** | Twilio Programmable SMS adapter | ✅ Done |
| **NOTIF-003** | Firebase FCM push adapter | ✅ Done |
| **NOTIF-004** | BullMQ notification processor worker | ✅ Done |

**Phase 6 complete: 696 tests, 51 suites all green (+32 tests from Phase 6).**

**Key files from Phase 6:**
- `libs/notification/src/types/notification.types.ts` — `NotificationType`, `EmailPayload`, `SmsPayload`, `PushPayload`, `NotificationJobData`
- `libs/notification/src/adapters/email/` — `BrevoEmailAdapter` (Node 22 `fetch`), `MockEmailAdapter`, `getEmailAdapter()`
- `libs/notification/src/adapters/sms/` — `TwilioSmsAdapter` (Programmable Messaging), `MockSmsAdapter`, `getSmsAdapter()`
- `libs/notification/src/adapters/push/` — `FirebasePushAdapter` (FCM via `libs/firebase`), `MockPushAdapter`, `getPushAdapter()`
- `libs/notification/src/notification.worker.ts` — `processNotification()`, `createNotificationWorker()`, `enqueueNotification()`
- `apps/gateway/src/server.ts` — notification worker started/closed in lifecycle
- `libs/config/src/env.ts` — `TWILIO_PHONE_NUMBER` added

**ADR: No extra HTTP package for Brevo** — Node 22 has `fetch` built-in; Brevo's REST API is simple enough that the native client covers it completely.

---

## 6e. Complete — Phase 6b: Trusted Device Bypass ✅

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **AUTH-TD** | `POST /api/v1/auth/trusted-device` — skip OTP for trusted devices | ✅ Done |

**Phase 6b complete: 716 tests, 53 suites all green (+20 tests from AUTH-TD).**

**Key files:**
- `libs/auth/src/trusted-device.service.ts` — `trustedDeviceLoginService()`, `checkTrustedDeviceRateLimit()`, `DeviceNotTrustedError`
- `libs/auth/src/otp-verify.service.ts` — stamps `isTrusted`/`trustedAt`/`trustedExpiresAt` on every successful OTP verify
- `apps/gateway/src/schemas/auth/trusted-device.schema.ts` — E.164 phone + UUID fingerprint
- `apps/gateway/src/controllers/auth/trusted-device.controller.ts`
- `libs/config/src/env.ts` — `TRUSTED_DEVICE_TTL_DAYS` (default 90)
- `libs/shared/src/constants/index.ts` — `CACHE_KEYS.TRUSTED_DEVICE_ATTEMPTS`

---

## 6f. Complete — Phase 7: Payments ✅

> Full story specs → `project-management/epics-stories.md`

| Task ID | Endpoint / Feature | Status |
|---------|-------------------|--------|
| **PAY-001** | `POST /api/v1/payment/stripe/checkout` — Founding Member Stripe Checkout | ✅ Done |
| **PAY-002** | `POST /api/v1/payment/stripe/webhook` — Stripe event dispatcher | ✅ Done |
| **PAY-003** | `POST /api/v1/payment/razorpay/order` + `POST /razorpay/capture` | ✅ Done |
| **PAY-004** | `POST /api/v1/payment/razorpay/webhook` — Razorpay event dispatcher | ✅ Done |
| **PAY-005** | `GET /api/v1/payment/membership` — active membership lookup | ✅ Done |
| **PAY-006** | `POST /api/v1/payment/diamonds/purchase` — Stripe diamond checkout | ✅ Done |
| **PAY-007** | `GET /api/v1/payment/diamonds/balance` + `POST /diamonds/spend` | ✅ Done |
| **PAY-008** | `POST /admin/payment/refund` — refund + ledger reversal | ✅ Done |

**Phase 7 complete: ~786 tests, 58 suites all green.**

**Key files from Phase 7:**
- `libs/payment/src/types/payment.types.ts` — `CheckoutSessionParams`, `WebhookEvent`, `WebhookEventType`, `MembershipDto`, `DiamondPackage`, `CreditDiamondsParams`, `ActivateMembershipParams`
- `libs/payment/src/adapters/base.payment.adapter.ts` — `PaymentAdapter` interface, `UnsupportedOperationError`, `PaymentSignatureError`
- `libs/payment/src/adapters/stripe/stripe.payment.adapter.ts` — Stripe SDK, API v2024-06-20, subscription + payment modes
- `libs/payment/src/adapters/razorpay/razorpay.payment.adapter.ts` — Razorpay SDK, HMAC-SHA256 order + webhook verification
- `libs/payment/src/adapters/mock/mock.payment.adapter.ts` — deterministic test data
- `libs/payment/src/adapters/index.ts` — lazy singletons `getStripeAdapter()`, `getRazorpayAdapter()`, `_resetPaymentAdapters()`
- `libs/payment/src/membership.service.ts` — `activateMembership()`, `getActiveMembership()`, `cancelMembership()`, `markMembershipPastDue()`, `MembershipAlreadyActiveError`
- `libs/payment/src/diamond.service.ts` — `DIAMOND_PACKAGES`, `getDiamondBalance()`, `creditDiamonds()`, `spendDiamonds()`, `refundDiamonds()`, `InsufficientDiamondsError`
- `libs/payment/src/checkout.service.ts` — `createMembershipCheckout()`, `createDiamondCheckout()`, `createRazorpayMembershipOrder()`, `captureRazorpayPayment()`, `markPaymentRefunded()`, `PaymentNotFoundError`, `InvalidDiamondPackageError`
- `libs/payment/src/webhook.service.ts` — `processStripeWebhook()`, `processRazorpayWebhook()`
- `libs/payment/src/index.ts` — barrel export
- `libs/payment/package.json` — `@abroad-matrimony/payment` lib
- `apps/gateway/src/app.ts` — `express.raw()` before `express.json()` for both webhook paths
- `apps/gateway/src/routes/payment/index.ts` — all 9 payment routes
- `apps/gateway/src/routes/admin/index.ts` — `POST /admin/payment/refund` added
- `apps/gateway/src/controllers/payment/stripe.controller.ts`
- `apps/gateway/src/controllers/payment/razorpay.controller.ts`
- `apps/gateway/src/controllers/payment/membership.controller.ts`
- `apps/gateway/src/controllers/payment/diamond.controller.ts`
- `apps/gateway/src/controllers/admin/payment-admin.controller.ts`
- `apps/gateway/src/constants/payment.constants.ts` — `PAYMENT_ERRORS`, `PAYMENT_MESSAGES`
- `libs/config/src/env.ts` — `STRIPE_WEBHOOK_SECRET`, `STRIPE_FOUNDING_MEMBER_PRICE_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`

**Test files:**
- `libs/payment/src/__tests__/diamond.service.test.ts` — 10 tests
- `libs/payment/src/__tests__/membership.service.test.ts` — 8 tests
- `libs/payment/src/__tests__/checkout.service.test.ts` — 10 tests
- `libs/payment/src/__tests__/webhook.service.test.ts` — 8 tests
- `apps/gateway/src/controllers/payment/__tests__/payment.controller.test.ts` — full HTTP integration tests for all payment endpoints

**Note:** `stripe` and `razorpay` added to root `package.json`. Run `npm install --legacy-peer-deps` to install.

---

## 6g. Complete — Phase 7b: New Feature Libs + Tests ✅

> Service layers were pre-implemented; this phase added jest configs + unit tests.

| Task ID | Lib / Feature | Tests |
|---------|--------------|-------|
| **LIB-CONN** | `libs/connections` — connection requests service | ✅ 21 tests |
| **LIB-GRP** | `libs/groups` — groups + events service | ✅ 24 tests |
| **LIB-GATH** | `libs/gatherings` — events RSVP service | ✅ 18 tests |
| **LIB-VER** | `libs/verification` — ID doc verification + trust score | ✅ 13 tests |
| **LIB-HAB** | `libs/habits` — habit logging + streak computation | ✅ 18 tests |
| **LIB-INTRO** | `libs/introductions` — weekly intro drops + getWeekKey | ✅ 18 tests |
| **LIB-PROMPT** | `libs/prompts` — weekly prompts + resonate | ✅ 18 tests |
| **LIB-SAVE** | `libs/saved-profiles` — saved profile shortlist | ✅ 14 tests |
| **LIB-TRUST** | `libs/trust` — block/unblock/report/signals | ✅ 15 tests |
| **LIB-TUNE** | `libs/matching` — match-tuning.service + weight clamping | ✅ 7 tests |
| **LIB-MAGIC** | `libs/auth` — email magic link send + verify | ✅ 9 tests |
| **LIB-EXT** | `libs/profile` — profile pause, voice intro upload/save | ✅ 10 tests |

**Total after Phase 7b lib work: 950 tests, 70 suites all green.**

**TypeScript fixes applied:**
- `PaginationMeta` interface: `hasMore` made optional, added `page?`, `limit?`, `message?`, `total?`
- `StorageAdapter` interface: added `getPublicUrl(key: string): string` method (S3 + Mock implementations)
- `libs/profile/src/extensions.service.ts`: fixed `getPresignedUploadUrl` destructuring
- `libs/verification/src/index.ts`: removed `as string[]` Prisma enum casts, fixed upload URL destructuring
- `libs/gatherings/src/index.ts`: removed Prisma enum casts + `.includes()` replaced with equality checks
- `libs/groups/src/index.ts`: same Prisma enum cast fixes, renamed unused `userId` → `_userId`
- `libs/saved-profiles/src/index.ts`: removed `label as string` cast from Prisma where clause
- `libs/payment/src/membership.service.ts`: `toMembershipDto` helper accepts `string` types to avoid Prisma/shared enum mismatch
- `libs/auth/src/email-magic-link.service.ts`: corrected `issueTokenPair(id, role, deviceId)` and `storeRefreshToken(tokenId, userId, deviceId, token, expiresAt)` call signatures

**New jest.config.ts files added:** connections, groups, gatherings, verification, habits, introductions, prompts, saved-profiles, trust

**Phase 7b gateway test + code review work (2026-05-29):**
- 10 gateway controller test files written (connections, habits, tuning, signals, profile-extensions, introductions, trust, events, saved, prompts)
- 5 new constants files created: `introductions.constants.ts`, `events.constants.ts`, `prompts.constants.ts`, `saved.constants.ts`, `trust.constants.ts`
- 22 STANDARDS.md files created: all 11 new route dirs + 11 controller dirs
- Code review violations fixed: magic strings eliminated from 5 controllers; `HTTP_STATUS` import added to signals controller; dead `CONNECTION_ERRORS.SELF_CONNECT` constant removed

---

## 6h. Scoped — Phase 8 New Features (Next Implementation Block)

**Scoped:** 2026-05-29 | **Status:** Ready to implement — all design decisions locked

### Scope Summary

| Phase | What | Key dependency |
|-------|------|----------------|
| **DB-MIGRATION-001** | Schema migration — all new models | Must run first |
| **Phase 8a** | `apps/seeder` — automated data seeding ✅ 2026-05-29 | DB-MIGRATION-001 |
| **Phase 8b** | `libs/ai` — OpenAI intelligence layer ✅ 2026-05-29 | DB-MIGRATION-001 |
| **Phase 8c** | Groups revamp — 4-type taxonomy + social feed ✅ 2026-05-30 | DB-MIGRATION-001 |
| **Phase 8d** | IntroductionDrop — multi-drop, AI-curated | Phase 8b + 8c |
| **Phase 8e** | Admin API + Analytics (17 tasks, expanded 2026-05-29) | Phase 8a data exists |

### Key Design Decisions (all locked — see epics-stories.md Phase 8 Design Decisions Log)

**Seeder:**
- `apps/seeder` — independent NX app, port 3100, never runs in production (hard env guard)
- `SEEDER_SECRET` — gateway middleware bypass; `isSeeded` flag on User/Profile/Group/GroupPost
- 500 profiles: UK 35%, Germany 20%, Australia 20%, Canada 15%, India 10%
- Drip: 3–5 new profiles at random offset within 3–4 hour window (organic feel)
- S3 photos from `seeder/profile-photos/male|female/` prefix (operator uploads once)
- Control API: `POST /seed/run`, `POST /seed/flush`, `GET /seed/status`

**Groups:**
- Single `Group` model with `type: GroupType` enum: `REGIONAL | CULTURAL | PROFESSIONAL | INTEREST`
- `scope: GroupScope` enum: `COUNTRY | GLOBAL` (global DB-provisioned, country-specific for now)
- REGIONAL country-level: auto-join on registration. Everything else: suggested → manual join
- Suggested at onboarding (max 20, configurable via `SystemConfig`), also shown in home feed
- All members visible in all group types; initiating conversation from group costs diamonds
- Social feed: posts + flat comments + likes. No video, no nested threads
- INTEREST group creation: member proposes → admin approves (hybrid)
- Hierarchy: flat with `parentGroupId` (city → country)

**IntroductionDrop:**
- `IntroductionDrop` (themed category/pool) + `Introduction` (curated 1:1 per recipient from pool)
- No weekly cap — multiple drops live simultaneously across different themes
- AI picks 3–5 best matches from pool per recipient (personalized, not same for everyone)
- Early access: spend `earlyAccessCost` diamonds to VIEW (locked); spend `unlockCost` to UNLOCK
- Flow: AI proposes DRAFT → admin approves → pairing generation → SCHEDULED → LIVE at `releaseAt`
- Event pre-connections: auto-SCHEDULED, 72h before event, no admin approval

**AI (`libs/ai`):**
- `gpt-4o-mini` + `text-embedding-3-small` + `Whisper` via OpenAI
- `ProfileEmbedding`: summary (150w), traitTags (8–12), vibeScores (5 dimensions 1–10), pgvector embedding
- Supabase pgvector (native support) — no extra infrastructure
- All AI paths are no-ops when `OPENAI_API_KEY` absent (`isAiConfigured()` guard)
- BullMQ job fired (60s debounce) on any profile signal update

**New env vars required:**
- `SEEDER_SECRET` (gateway + seeder)
- `GATEWAY_URL` (seeder)
- `SEEDER_PORT` (seeder, default 3100)
- `SEEDER_PHOTO_S3_PREFIX` (seeder)
- `SEEDER_INITIAL_COUNT` (seeder, default 500)
- `OPENAI_API_KEY` (libs/ai)
- `AI_MODEL` (libs/ai, default `gpt-4o-mini`)
- `EMBEDDING_MODEL` (libs/ai, default `text-embedding-3-small`)

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

### ADR-009: S3 Media Storage — Private Bucket + CloudFront
Profile photos uploaded to a **private** S3 bucket via `@aws-sdk/client-s3`.
Public delivery is via CloudFront CDN (URL prefix: `AWS_CLOUDFRONT_DOMAIN`).
When CloudFront is not configured (dev / test), falls back to S3 path-style URL.
`getStorageAdapter()` factory returns `MockStorageAdapter` when AWS creds are absent — zero
config required for local dev or CI.
Key pattern: `photos/<userId>/<randomUUID>.<ext>` — UUIDs prevent collisions and enumeration.
Max 6 photos per user enforced at service layer (not database constraint).
File validation: JPEG / PNG / WebP only, 5 MB max — enforced by multer fileFilter + size limit.

### ADR-010: Firebase Firestore as Real-Time Message Store
**Decision:** Messages are stored in Firebase Firestore (NOT Postgres/Prisma) for real-time delivery.
**Rationale:**
- Flutter clients subscribe to Firestore real-time listeners — zero polling, offline support built-in
- Postgres is append-only structured; Firestore handles sub-collections, partial reads, and live sync natively
- Same Firebase project serves both Firestore (messages) and FCM (push notifications) — one SDK init

**Architecture:**
- **Writes:** Flutter → REST API → backend validates → writes to Firestore → triggers FCM if recipient offline
- **Reads:** Flutter reads direct from Firestore (real-time listener); REST API provides fallback + admin access
- **Presence:** Firebase Realtime DB only (Firestore has no onDisconnect); `presence/{userId}: { online, lastSeen }`
- **Media:** S3 presigned upload URL from backend → Flutter uploads direct → URL stored in Firestore message doc
- **Moderation records:** Postgres `flags` table (audit trail, admin queries, `FlagReason`/`FlagAction` enums)
- **Auto-hide:** Firestore `flagCount` incremented atomically via transaction; `isHidden = true` at `>= 3` flags

**Adapter pattern:** `MessagingAdapter` interface → `FirestoreMessagingAdapter` (prod) / `MockMessagingAdapter` (dev/test).
`getMessagingAdapter()` factory checks `isFirebaseConfigured()` — falls back to mock if credentials absent.
`libs/firebase` singleton lib (like `libs/cache`) initialised once in `server.ts`.

### ADR-011: Stripe/Razorpay Webhook Raw Body — mount before express.json()
**Decision:** `express.raw({ type: 'application/json' })` is mounted for `/api/v1/payment/stripe/webhook` and `/api/v1/payment/razorpay/webhook` BEFORE the global `express.json()` middleware in `apps/gateway/src/app.ts`.

**Rationale:** Both Stripe and Razorpay webhook signature verification requires the original raw request body as a `Buffer`. Once `express.json()` parses the body, the raw bytes are discarded and signature verification fails. `express.raw()` sets `req.body` as a `Buffer`; body-parser skips any path where `req.body` is already populated.

**Pattern:**
```typescript
// app.ts — BEFORE express.json()
app.use('/api/v1/payment/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/payment/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
```

### ADR-012: Payment Adapter Dynamic require() to avoid module-load-time errors
**Decision:** `getStripeAdapter()` and `getRazorpayAdapter()` in `libs/payment/src/adapters/index.ts` use `require()` inside the factory function body (not top-level `import`) to instantiate Stripe/Razorpay SDK objects.

**Rationale:** Top-level `import Stripe from 'stripe'` causes Jest to load the Stripe module during test module resolution, even when `stripe` is not installed (CI without credentials). Dynamic `require()` defers loading to call time, by which point the module is either mocked or not needed. Combined with `MockPaymentAdapter` used in all tests, the real SDKs never load during test runs.

### ADR-013: Automated Data Seeding Service (`apps/seeder`)
**Decision:** `apps/seeder` — standalone NX app, independent Express server (port 3100), BullMQ scheduler, hard `NODE_ENV === production` exit guard. Uses `SEEDER_SECRET` token to call gateway endpoints as synthetic users. `isSeeded` flag on seeded DB records enables clean flush.
**Rationale:** Complex matching, AI grouping, and weekly intro drops all require 500+ realistic, continuously-updated profiles. One-time seed scripts don't capture ongoing activity signals. An independent service keeps seeding concerns out of gateway code entirely.

### ADR-014: SEEDER_SECRET Gateway Auth Bypass
**Decision:** New gateway middleware checks `Authorization: Bearer <token>` before `requireAuth`. If token === `SEEDER_SECRET` env var AND `NODE_ENV !== production`, decodes `{ userId, role }` payload and sets `req.user` directly, bypassing JWT. In production: no-op.
**Rationale:** Avoids fake phone numbers / real OTP flows for 500+ synthetic users. Production safety is enforced at the middleware level, not by configuration discipline alone.

### ADR-015: Four-Type Group Taxonomy (REGIONAL | CULTURAL | PROFESSIONAL | INTEREST)
**Decision:** Single `Group` model with `type` + `scope` enums. REGIONAL country-level auto-joins on register. All others suggested at onboarding and in home feed. All member lists visible; conversation initiation costs diamonds. Social feed (posts + flat comments + likes) on all types. INTEREST groups require member proposal + admin approval. Hierarchy via `parentGroupId`.
**Rationale:** Four genuinely different use cases with different join rules, visibility, and capabilities. One model + type enum is simpler than four separate models while making behaviour explicit and testable.

### ADR-016: IntroductionDrop Model — Replacing WeekKey Cap
**Decision:** `IntroductionDrop` (themed category with member pool + release schedule) sits above `Introduction` (curated 1:1 pairing per recipient). No weekly cap. AI picks 3–5 best matches per recipient from the pool. Early access via tiered diamond spend. Event-based drops auto-approved.
**Rationale:** Single-weekly-intro cap prevented multi-themed, multi-frequency drops. Separating the "drop concept" from the "individual pairing" enables personalised curation at scale and creates natural monetisation touchpoints.

### ADR-017: AI Integration — OpenAI + pgvector for Profile Intelligence
**Decision:** `libs/ai` wraps gpt-4o-mini (completions), text-embedding-3-small (embeddings), and Whisper (voice transcription). ProfileEmbedding model stores summary, trait tags, vibe scores, and 1536-dim vector in Supabase pgvector. All AI paths are optional no-ops when API key absent.
**Rationale:** Demographic matching alone is insufficient for Indian diaspora matrimony. Voice intro vibes, prompt answer depth, habit consistency, and event attendance are personality signals that only semantic AI analysis can extract. pgvector is native to Supabase — zero extra infrastructure. gpt-4o-mini is 15× cheaper than gpt-4o with sufficient quality for profile analysis.

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

Phase 1 ✅ Foundation complete.

Phase 2 ✅ Auth ALL DONE (171 tests, 21 suites).
AUTH-001 ✅ POST /api/v1/auth/otp/request
AUTH-002 ✅ POST /api/v1/auth/otp/verify
AUTH-003 ✅ POST /api/v1/auth/token/refresh
AUTH-004 ✅ POST /logout + POST /logout/all
AUTH-005 ✅ requireAuth middleware
QUAL-001 ✅ Jest coverage (Istanbul lcov/html, thresholds)
QUAL-002 ✅ SonarCloud integration
AUTH-006 ✅ POST /admin/auth/login (bcrypt + TOTP)
AUTH-007 ✅ requireRole() user RBAC middleware
AUTH-008 ✅ requireAdminRole() admin RBAC + auditLog()

Phase 3 ✅ Profile ALL DONE (344 tests, 29 suites).
PROF-001 ✅ POST /api/v1/profile
PROF-002 ✅ PUT /api/v1/profile/real-life/:questionKey
PROF-003 ✅ PUT /api/v1/profile/story/:promptKey
PROF-004 ✅ POST /api/v1/profile/media (S3 + multer)
PROF-005 ✅ recalculateCompletionScore()
PROF-006 ✅ GET /api/v1/profile/me + GET /api/v1/profiles/:id

Phase 4 ✅ Matching ALL DONE (497 tests, 35 suites).
MATCH-001 ✅ Scoring algorithm v1 (9 dimensions)
MATCH-002 ✅ BullMQ worker: batch-compute all user pairs
MATCH-003 ✅ Redis-cached score lookup
MATCH-004 ✅ GET /api/v1/discover — paginated feed
MATCH-005 ✅ Feature-flag gate for algorithm v2

Phase 5 ✅ Messaging ALL DONE (664 tests, 47 suites).
MSG-000 ✅ libs/messaging scaffold + libs/firebase singleton + Prisma schema updates
MSG-001 ✅ GET /api/v1/conversations + GET /:convId/messages
MSG-002 ✅ POST /api/v1/conversations/:convId/messages + GET /:convId/upload-url
MSG-003 ✅ GET /api/v1/auth/firebase-token + Firestore rules doc
MSG-004 ✅ POST /api/v1/conversations/:convId/read (read receipts)
MSG-005 ✅ POST /api/v1/messages/:msgId/flag + admin flag moderation

Phase 6 ✅ Notifications ALL DONE (696 tests, 51 suites).
NOTIF-001 ✅ libs/notification Brevo email adapter (Node 22 native fetch)
NOTIF-002 ✅ Twilio Programmable SMS adapter
NOTIF-003 ✅ Firebase FCM push adapter
NOTIF-004 ✅ BullMQ notification worker

Phase 6b ✅ Trusted Device Bypass ALL DONE (716 tests, 53 suites).
AUTH-TD ✅ POST /api/v1/auth/trusted-device — skip OTP for trusted devices
  - Device trust set on every successful OTP verify; sliding TTL window (TRUSTED_DEVICE_TTL_DAYS default 90)
  - DeviceNotTrustedError → 401; Flutter falls back to full OTP flow
  - Rate-limit: 10 attempts/phone/hour

Phase 7 ✅ Payments ALL DONE (~786 tests, 58 suites).
PAY-001 ✅ POST /api/v1/payment/stripe/checkout — Founding Member Stripe Checkout
PAY-002 ✅ POST /api/v1/payment/stripe/webhook — Stripe event dispatcher
PAY-003 ✅ POST /api/v1/payment/razorpay/order + POST /razorpay/capture
PAY-004 ✅ POST /api/v1/payment/razorpay/webhook — Razorpay event dispatcher
PAY-005 ✅ GET /api/v1/payment/membership — active membership lookup
PAY-006 ✅ POST /api/v1/payment/diamonds/purchase — Stripe diamond checkout + ledger INSERT
PAY-007 ✅ GET /api/v1/payment/diamonds/balance + POST /diamonds/spend
PAY-008 ✅ POST /admin/payment/refund (SUPERADMIN) — refund + ledger reversal

Phase 7b ✅ New Feature Libs + Tests ALL DONE (950 tests, 70 suites).
Service layers (libs) + jest.config.ts + unit tests written and passing for:
  - libs/connections — sendConnectionRequest, listConnections, acceptConnection, declineConnection, withdrawConnection (21 tests)
  - libs/groups — listGroups, getGroup, joinGroup, leaveGroup, getGroupMembers, getGroupEvents (24 tests)
  - libs/gatherings — listEvents, getEvent, rsvpToEvent, cancelRsvp, getEventAttendees (18 tests)
  - libs/verification — submitVerification, getVerificationStatus, getTrustScore, getVerificationUploadUrl (13 tests)
  - libs/habits — listHabits, logHabit, deleteHabitLog, getHabitStreak, addHabitReflection + computeStreaks (18 tests)
  - libs/introductions — getWeekKey, listCurrentIntroductions, listIntroductionHistory, acceptIntroduction, declineIntroduction (18 tests)
  - libs/prompts — getCurrentPrompt, respondToPrompt, getPromptResponses, resonateResponse, unresonateResponse (18 tests)
  - libs/saved-profiles — listSavedProfiles, saveProfile, updateSavedProfile, unsaveProfile (14 tests)
  - libs/trust — blockUser, unblockUser, listBlocks, reportUser, getSignals (15 tests)
  - libs/matching — getMatchTuning, setMatchTuning + weight clamping (7 tests, added to existing suite)
  - libs/auth — sendMagicLink, verifyMagicLink email magic link (9 tests, added to existing suite)
  - libs/profile — toggleProfilePause, getVoiceIntroUploadUrl, saveVoiceIntro extensions (10 tests, added to existing suite)
TypeScript fixes also applied: PaginationMeta extended, StorageAdapter.getPublicUrl added, membership enum casting fixed,
  gatherings/groups/verification/saved-profiles Prisma enum cast issues resolved, email-magic-link function signatures corrected.
Phase 7b gateway test + code review work (2026-05-29):
  - 10 gateway controller test files written (connections, habits, tuning, signals, profile-extensions, introductions, trust, events, saved, prompts)
  - 5 new constants files + 22 STANDARDS.md files created across all new route/controller dirs
  - Code review violations fixed: magic strings eliminated, HTTP_STATUS import added, dead constant removed

Phase 8a ✅ Seeder ALL DONE (1,091 tests after seeder, 77 suites).
apps/seeder port 3100: SEED-001→009 complete. autonomous drip seeder, 500 profiles, 6 activity types, flush + status control API.
See "Key files from Phase 8a (Seeder)" section below.

Phase 8b ✅ AI Intelligence Layer ALL DONE (1,223 tests, 89 suites).
libs/ai: AI-001→007 all complete. OpenAI gpt-4o-mini + text-embedding-3-small + Whisper-1. BullMQ 60s debounce worker.
AI-001 ✅ libs/ai scaffold — isAiConfigured() guard, getAiClient() singleton, AiNotConfiguredError
AI-002 ✅ generateProfileIntelligence(userId) — queries User model (not Profile), GPT + embeddings, upserts ProfileEmbedding
AI-003 ✅ transcribeVoiceIntro(userId, s3Key) — GetObjectCommand download, whisper-1, voiceIntroTranscript update
AI-004 ✅ proposeIntroductionDrops(region) — user.currentCountry filter, min 10 profiles, DRAFT IntroductionDrops
AI-005 ✅ generateEventPreConnections(eventId) — eventRsvp + userBlock models, event.title/startAt, SCHEDULED drops 72h before
AI-006 ✅ quiet-window.ts — isWithinWindow(), msUntilWindowOpens(), getContactWindow(); notification worker re-queues on defer
AI-007 ✅ ai.worker.ts + enqueue-intelligence.ts — BullMQ concurrency 2, jobId 'pi:${userId}' debounce, conditional startup
See "Key files from Phase 8b (AI)" section below.

Phase 8c ✅ Groups Revamp ALL DONE (1,312 tests, 93 suites).
libs/groups + apps/gateway/src/controllers/groups + apps/gateway/src/routes/groups: GRP-R-001→007 complete.
GRP-R-001 ✅ libs/groups refactor — REGIONAL/CULTURAL/PROFESSIONAL/INTEREST types; joinGroup(userId, groupId, joinedVia), leaveGroup, autoJoinRegionalCountryGroup; listSuggestedGroups; getSuggestedGroupsForOnboarding; paginated getGroupMembers
GRP-R-002 ✅ Group suggestion engine — listSuggestedGroups(userId, limit) ranked by country match + memberCount; SystemConfig.SUGGESTED_GROUPS_MAX
GRP-R-003 ✅ Group social feed service — feed.service.ts: createPost, listPosts (isPinned DESC), deletePost (author/admin), likePost/unlikePost idempotent, addComment, listComments, pinPost/unpinPost
GRP-R-004 ✅ Interest group proposal flow — proposal.service.ts: proposeGroup, getGroupProposals, approveGroupProposal ($transaction: Group create + auto-join), rejectGroupProposal; ProposalNotPendingError guard
GRP-R-005 ✅ Gateway endpoints — 16 routes: list, get, suggested, onboarding-suggestions, join, leave, members, events, feed, posts CRUD, like/unlike, comments, proposals; static routes before /:groupId
GRP-R-006 ✅ Admin endpoints — groups-admin.controller.ts: GET/POST/POST proposals, POST/DELETE pin; 17 tests
GRP-R-007 ✅ Seeder group data — 21 system groups (5 REGIONAL + 6 CULTURAL + 5 PROFESSIONAL + 5 INTEREST); seedSystemGroups() idempotent; POST /seed/groups endpoint; called in triggerRun before drip
See "Key files from Phase 8c (Groups Revamp)" section below.

── PHASE 8 SERIES — NEXT IMPLEMENTATION BLOCK ──────────────────────────────
All Phase 8 design decisions locked (2026-05-29). Full specs in epics-stories.md.
Read project-management/phases.md section "NEW SCOPE: Phase 8 Series" for task list.

⚠️ MANDATORY FIRST STEP: DB-MIGRATION-001 — all new Prisma schema changes MUST land
before any Phase 8a/8b/8c/8d/8e work begins. Run locally (cloud runner cannot reach Supabase).

Phase 8 work order:
  1. DB-MIGRATION-001 — ✅ DONE — schema migration (pgvector, new models)
  2. Phase 8a (SEED-001→009) — ✅ DONE (2026-05-29) — 1,091 tests, 77 suites — apps/seeder autonomous data seeder, port 3100
  3. Phase 8b (AI-001→007) — ✅ DONE (2026-05-29) — 1,223 tests, 89 suites — libs/ai: OpenAI completions + embeddings + Whisper + BullMQ wiring
  4. Phase 8c (GRP-R-001→007) — ✅ DONE (2026-05-30) — 1,312 tests, 93 suites — Groups revamp: 4-type taxonomy + social feed + proposals + admin + seeder groups
  5. Phase 8d (IDROP-001→006) — IntroductionDrop: multi-drop, AI-curated pairings  ← NEXT
  6. Phase 8e (ADMIN-001→017) — Admin API + Analytics (expanded 2026-05-29: +GroupProposal mgmt, +SystemConfig, +seeder monitoring, +AI monitoring, +extended analytics)

⚠️ IMPORTANT: Run `npm install --legacy-peer-deps` if you haven't — `stripe` and `razorpay` were added to root package.json in Phase 7.

Key files from Phase 7 (Payments):
- libs/payment/src/types/payment.types.ts — CheckoutSessionParams, WebhookEvent, WebhookEventType, MembershipDto, DiamondPackage, CreditDiamondsParams, ActivateMembershipParams
- libs/payment/src/adapters/base.payment.adapter.ts — PaymentAdapter interface, UnsupportedOperationError, PaymentSignatureError
- libs/payment/src/adapters/stripe/stripe.payment.adapter.ts — Stripe SDK (API v2024-06-20), subscription + payment modes
- libs/payment/src/adapters/razorpay/razorpay.payment.adapter.ts — Razorpay SDK, HMAC-SHA256 order + webhook verification
- libs/payment/src/adapters/mock/mock.payment.adapter.ts — deterministic test data
- libs/payment/src/adapters/index.ts — lazy singletons getStripeAdapter(), getRazorpayAdapter(), _resetPaymentAdapters()
- libs/payment/src/membership.service.ts — activateMembership(), getActiveMembership(), cancelMembership(), markMembershipPastDue(), MembershipAlreadyActiveError
- libs/payment/src/diamond.service.ts — DIAMOND_PACKAGES, getDiamondBalance(), creditDiamonds(), spendDiamonds(), refundDiamonds(), InsufficientDiamondsError
- libs/payment/src/checkout.service.ts — createMembershipCheckout(), createDiamondCheckout(), createRazorpayMembershipOrder(), captureRazorpayPayment(), markPaymentRefunded(), PaymentNotFoundError, InvalidDiamondPackageError
- libs/payment/src/webhook.service.ts — processStripeWebhook(), processRazorpayWebhook()
- libs/payment/src/index.ts — barrel
- apps/gateway/src/app.ts — express.raw() before express.json() for /stripe/webhook + /razorpay/webhook paths (ADR-011)
- apps/gateway/src/routes/payment/index.ts — 9 payment routes
- apps/gateway/src/routes/admin/index.ts — POST /admin/payment/refund added
- apps/gateway/src/controllers/payment/ — stripe, razorpay, membership, diamond controllers
- apps/gateway/src/controllers/admin/payment-admin.controller.ts
- apps/gateway/src/constants/payment.constants.ts — PAYMENT_ERRORS, PAYMENT_MESSAGES
- libs/config/src/env.ts — STRIPE_WEBHOOK_SECRET, STRIPE_FOUNDING_MEMBER_PRICE_ID, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, PAYMENT_SUCCESS_URL, PAYMENT_CANCEL_URL
- jest.preset.js — @abroad-matrimony/payment moduleNameMapper entry added

Key files from Phase 6b (Trusted Device Bypass):
- libs/auth/src/trusted-device.service.ts — trustedDeviceLoginService(), checkTrustedDeviceRateLimit(), DeviceNotTrustedError
- libs/auth/src/otp-verify.service.ts — stamps isTrusted/trustedAt/trustedExpiresAt on every successful OTP
- apps/gateway/src/schemas/auth/trusted-device.schema.ts — E.164 phone + UUID fingerprint
- apps/gateway/src/controllers/auth/trusted-device.controller.ts
- libs/db/prisma/schema.prisma — Device: trustedAt DateTime?, trustedExpiresAt DateTime?
- libs/config/src/env.ts — TRUSTED_DEVICE_TTL_DAYS (default 90)
- libs/shared/src/constants/index.ts — CACHE_KEYS.TRUSTED_DEVICE_ATTEMPTS

Key files from Phase 6 (NOTIF-001 to NOTIF-004):
- libs/notification/src/adapters/email/ — BrevoEmailAdapter, MockEmailAdapter, getEmailAdapter()
- libs/notification/src/adapters/sms/ — TwilioSmsAdapter, MockSmsAdapter, getSmsAdapter()
- libs/notification/src/adapters/push/ — FirebasePushAdapter, MockPushAdapter, getPushAdapter()
- libs/notification/src/notification.worker.ts — processNotification(), createNotificationWorker(), enqueueNotification()
- libs/config/src/env.ts — TWILIO_PHONE_NUMBER added
- jest.preset.js — @abroad-matrimony/notification mapper added

Key files from Phase 5 (Messaging):
- libs/firebase/src/firebase.ts — initFirebase(), getFirestoreDb(), getRealtimeDb(), getFirebaseMessaging(), getFirebaseAuth(), shutdownFirebase(), isFirebaseConfigured()
- libs/messaging/src/conversation.service.ts, send-message.service.ts, firebase-token.service.ts, read-receipt.service.ts, flag-message.service.ts
- libs/messaging/src/adapters/ — FirestoreMessagingAdapter (prod), MockMessagingAdapter (dev/test)
- apps/gateway/src/controllers/conversations/, messages/, admin/flags.controller.ts
- docs/firestore-security-rules.md
Prisma changes (applied): IMAGE in MessageType, mediaUrl/flagCount/isHidden on Message, FlagReason + FlagAction enums, Flag model

BUG-007: requireAdminRole missing from auth mocks — when adding new admin routes, add requireAdminRole stub to ALL jest.mock('@abroad-matrimony/auth') blocks in gateway tests.

KEY DECISIONS (Phases 1–7b):
- USER_REGISTERED CloudEvent fires in AUTH-002 (not AUTH-001). See BUG-001 in bugs.md.
- Diamond ledger is append-only (ADR-006). No UPDATEs.
- All money in integer paise/cents (ADR-007). Never floats.
- Stripe/Razorpay adapters use dynamic require() inside factory — never top-level import (ADR-012).
- express.raw() before express.json() for webhook paths (ADR-011).

KEY DECISIONS (Phase 8 — all locked 2026-05-29):
- DB-MIGRATION-001 MUST complete before any Phase 8 implementation. Run prisma db push locally.
- apps/seeder: independent NX app port 3100, NEVER runs in production (hard NODE_ENV guard).
- SEEDER_SECRET: gateway middleware bypass sets req.user from token payload; no-op in production (ADR-014).
- isSeeded flag: Boolean @default(false) on User/Profile/Group/GroupPost — enables clean flush.
- 500 profiles: UK 35%, Germany 20%, Australia 20%, Canada 15%, India 10%.
- Drip cadence: 3–5 new profiles at random offset within 3–4 hour window (organic feel).
- Groups: single Group model with type enum REGIONAL|CULTURAL|PROFESSIONAL|INTEREST (ADR-015).
- REGIONAL country-level groups: auto-join on registration. All others: suggested → manual join.
- Suggested groups at onboarding, max 20 (configurable via SystemConfig table).
- All member lists visible in all group types; initiating conversation from group costs diamonds.
- Social feed: posts + flat comments + likes. No video, no nested threads.
- INTEREST groups: member proposes → admin approves (hybrid). Group hierarchy via parentGroupId.
- IntroductionDrop (themed pool) → Introduction (curated 1:1 per recipient). No weekly cap (ADR-016).
- AI picks 3–5 best matches from pool per recipient. Flow: AI DRAFT → admin approve → SCHEDULED → LIVE.
- Early access: VIEW costs earlyAccessCost diamonds (blurred); UNLOCK costs unlockCost (full profile).
- New ledger reasons: INTRO_EARLY_VIEW, INTRO_EARLY_UNLOCK, GROUP_CONVERSATION_INITIATION.
- Event pre-connections: auto-SCHEDULED IntroductionDrop, 72h before event, no admin approval needed.
- libs/ai: gpt-4o-mini (completions), text-embedding-3-small (1536-dim), Whisper (voice) (ADR-017).
- ProfileEmbedding: summary (150w), traitTags (8–12), vibeScores (5 dims 1–10), pgvector embedding.
- All AI paths are no-ops when OPENAI_API_KEY absent (isAiConfigured() guard in libs/ai).
- BullMQ profile intelligence job fires 60s debounce after any profile signal update.
- Quiet window: 22:00–07:00 in recipient's local timezone; notifications deferred not dropped.
- SystemConfig table: key-value store for admin-configurable settings (e.g. SUGGESTED_GROUPS_MAX=20).
- Phase 8e Admin scope expanded (2026-05-29): now 17 tasks (ADMIN-001→017). New: ADMIN-013 GroupProposal approve/reject, ADMIN-014 SystemConfig CRUD, ADMIN-015 Seeder monitoring (status/flush/logs), ADMIN-016 AI/ProfileEmbedding monitoring (queue depth, stale embeddings, recompute), ADMIN-017 Extended analytics (group trends, drop engagement, diamond early access, AI vs admin ratios).
- Admin endpoints for new Phase 8 models: all in apps/admin-api (port 3001). GroupProposal → ADMIN-013, SystemConfig → ADMIN-014, seeder flush → ADMIN-015, ProfileEmbedding recompute → ADMIN-016, drop approval → ADMIN-011, AI proposals dashboard → ADMIN-012.

Key files from Phase 8a (Seeder — SEED-001→009):
- apps/seeder/src/server.ts — entry point, production guard (NODE_ENV=production → process.exit(1))
- apps/seeder/src/app.ts — Express app: /health (no auth), /seed (requireSeederKey), 404, error handler
- apps/seeder/src/lib/seeder-env.ts — getSeederEnv() (seeder-only vars, no Zod gateway schema dep)
- apps/seeder/src/lib/seeder-logger.ts — createChildLogger({ module: 'seeder' })
- apps/seeder/src/lib/seeder-state.ts — in-memory state: running/dripPaused/lastRunAt/lastDripAt/totalProfilesCreated
- apps/seeder/src/lib/seeder-token.ts — buildSeederToken(secret, payload) — mirrors gateway format
- apps/seeder/src/lib/gateway-client.ts — getGatewayClient() axios singleton + asUser(userId, role, deviceId)
- apps/seeder/src/data/names.data.ts — 12 cultural background name banks; randomName(background, gender)
- apps/seeder/src/data/real-life-answers.data.ts — all 12 question keys × 5 persona types; getRandomAnswer()
- apps/seeder/src/data/story-prompts.data.ts — 3 prompt keys × 5 variants; getRandomStoryAnswer()
- apps/seeder/src/factories/profile.factory.ts — createSeededProfile(): direct Prisma user create + gateway API calls for profile/answers/prompts/groups
- apps/seeder/src/services/photo.service.ts — warmPhotoCache() + pickPhotoUrl(gender); S3 ListObjects, CloudFront preferred
- apps/seeder/src/services/group-join.service.ts — autoJoinGroups(profile): Prisma transaction, GroupMembership + memberCount++
- apps/seeder/src/services/activity.simulator.ts — runActivitySimulation(): 6 action types, 70% intro accept rate
- apps/seeder/src/services/flush.service.ts — flushAllSeededData(): 17 deleteMany in Prisma $transaction (dependency order)
- apps/seeder/src/services/status.service.ts — getSeederStatus(): isSeeded counts + in-memory state
- apps/seeder/src/jobs/drip.job.ts — BullMQ seeder:drip; scheduleDripJob/triggerImmediateDrip/startDripWorker/closeDripWorker
- apps/seeder/src/jobs/activity.job.ts — BullMQ seeder:activity repeatable every 2h
- apps/seeder/src/jobs/match-recompute.job.ts — BullMQ seeder:match-recompute after each drip
- apps/seeder/src/middleware/seeder-key.middleware.ts — requireSeederKey: X-Seeder-Key header check
- apps/seeder/src/controllers/seed.controller.ts — seedController: getStatus/triggerRun/flush/pause/resume
- apps/seeder/src/routes/seed.routes.ts — all seeder control routes behind requireSeederKey
- apps/seeder/src/__tests__/seed.controller.test.ts — 13 supertest integration tests
- apps/seeder/package.json + tsconfig.json + jest.config.ts — NX app scaffold
- apps/gateway/src/middleware/seeder-auth.middleware.ts — SEED-004/ADR-014: seederAuthMiddleware + buildSeederToken; 11 tests
- apps/gateway/src/app.ts — seederAuthMiddleware mounted after express.json(), before routes
- libs/config/src/env.ts — SEEDER_SECRET (optional), OPENAI_API_KEY (optional), AI_MODEL, EMBEDDING_MODEL added

Key files from Phase 8b (AI — AI-001→007):
- libs/ai/package.json — @abroad-matrimony/ai lib scaffold; deps: openai ^6.39.1, @aws-sdk/client-s3, bullmq, @abroad-matrimony/config/db/logger/shared
- libs/ai/src/types/ai.types.ts — VibeScores, ContactWindow, ProfileEmbeddingDto, IntroductionDropDraftDto, ProfileIntelligenceJobData
- libs/ai/src/client.ts — isAiConfigured(), getAiClient() OpenAI singleton, _resetAiClient(), AiNotConfiguredError
- libs/ai/src/profile-intelligence.service.ts — generateProfileIntelligence(userId): queries prisma.user (not Profile), response_format json_object, upserts ProfileEmbedding with JSON cast for vibeScores/contactWindow
- libs/ai/src/whisper.service.ts — transcribeVoiceIntro(userId, s3Key): downloads via GetObjectCommand (not StorageAdapter), calls whisper-1, updates voiceIntroTranscript, enqueues intelligence job; returns '' on any error
- libs/ai/src/intro-grouping.service.ts — proposeIntroductionDrops(region): queries prisma.user with currentCountry filter; min 10 profiles; handles GPT response as array or { groups: [...] }; creates DRAFT IntroductionDrops
- libs/ai/src/event-preconnect.service.ts — generateEventPreConnections(eventId): uses prisma.eventRsvp (not eventAttendee) + prisma.userBlock (not block); event.title + event.startAt; MIN_PAIRS=4, PRE_CONNECT_HOURS=72
- libs/ai/src/quiet-window.ts — getContactWindow(userId), isWithinWindow(window, now), msUntilWindowOpens(window, now); Intl.DateTimeFormat for local hour; fail-open for unknown timezone
- libs/ai/src/enqueue-intelligence.ts — enqueueProfileIntelligence(userId, redisUrl): stable jobId 'pi:${userId}', 60s delay, removes existing job first to reset debounce
- libs/ai/src/ai.worker.ts — createAiWorker(redisUrl): BullMQ Worker, concurrency 2; processProfileIntelligence(); triggerProfileIntelligenceNow()
- libs/ai/src/index.ts — barrel exports for all services, client, quiet-window, worker, types
- libs/ai/jest.config.ts — displayName: 'ai', preset: ../../jest.preset.js
- libs/ai/src/__tests__/client.test.ts — 11 tests
- libs/ai/src/__tests__/profile-intelligence.service.test.ts — 8 tests
- libs/ai/src/__tests__/whisper.service.test.ts — 7 tests
- libs/ai/src/__tests__/intro-grouping.service.test.ts — 7 tests
- libs/ai/src/__tests__/event-preconnect.service.test.ts — 8 tests
- libs/ai/src/__tests__/quiet-window.test.ts — 10 tests
- libs/notification/src/notification.worker.ts — quiet window check for PUSH: dynamic import('@abroad-matrimony/ai'); re-queues with delay on QUIET_WINDOW_DEFER (not failed)
- libs/notification/src/types/notification.types.ts — PushPayload.userId?: string added for quiet window lookup
- libs/profile/src/extensions.service.ts — saveVoiceIntro() fires transcribeVoiceIntro() as void (fire-and-forget) after saving S3 key
- libs/profile/package.json — @abroad-matrimony/ai + @abroad-matrimony/config + @abroad-matrimony/storage added to deps
- apps/gateway/src/server.ts — AI worker started conditionally (isAiConfigured() guard); aiWorker.close() in shutdown
- libs/shared/src/constants/index.ts — QUEUE_NAMES.PROFILE_INTELLIGENCE + JOB_TYPES.PROFILE_INTELLIGENCE_UPDATE added
- jest.preset.js — @abroad-matrimony/ai moduleNameMapper entry added
- tsconfig.base.json — @abroad-matrimony/ai path alias added

Key files from Phase 8c (Groups Revamp — GRP-R-001→007):
- libs/groups/src/index.ts — FULLY REWRITTEN: joinGroup(userId, groupId, joinedVia?), leaveGroup(userId, groupId), autoJoinRegionalCountryGroup(userId, country), listSuggestedGroups(userId, limit), getSuggestedGroupsForOnboarding(userId), getGroupMembers(groupId, page, limit) → PaginatedGroupMembersResult; AlreadyInGroupError, NotInGroupError (new); AlreadyGroupMemberError, NotGroupMemberError kept as @deprecated aliases
- libs/groups/src/feed.service.ts — CREATED: createPost(), listPosts(), deletePost(userId, postId, isAdmin?), likePost(), unlikePost() idempotent, addComment(), listComments(), pinPost(), unpinPost(); PostNotFoundError, PostForbiddenError
- libs/groups/src/proposal.service.ts — CREATED: proposeGroup(), getGroupProposals(status?), approveGroupProposal() — creates Group + auto-joins proposer in $transaction, rejectGroupProposal(); GroupProposalNotFoundError, AlreadyProposedError, ProposalNotPendingError
- libs/groups/src/__tests__/groups.service.test.ts — REWRITTEN (new tests for autoJoinRegionalCountryGroup, listSuggestedGroups, getSuggestedGroupsForOnboarding)
- libs/groups/src/__tests__/feed.service.test.ts — CREATED (pinPost, unpinPost, likePost idempotency, member validation)
- libs/groups/src/__tests__/proposal.service.test.ts — CREATED (proposal create, approve creates group, ProposalNotPendingError guard)
- apps/gateway/src/controllers/groups/groups.controller.ts — REWRITTEN: mapGroupError handles 11 error classes; new handlers: suggested, onboardingSuggestions, getFeed, createPost, deletePost, likePost, unlikePost, addComment, listComments, proposeGroup, approveProposal, rejectProposal
- apps/gateway/src/routes/groups/index.ts — REWRITTEN: static routes (/suggested, /onboarding-suggestions, /proposals) BEFORE /:groupId; 16 total routes
- apps/gateway/src/schemas/groups/groups.schema.ts — REWRITTEN: added groupAndPostParamSchema, paginationQuerySchema, createPostSchema, addCommentSchema, proposeGroupSchema, suggestedGroupsQuerySchema
- apps/gateway/src/constants/groups.constants.ts — UPDATED: POST_NOT_FOUND, POST_FORBIDDEN, PROPOSAL_NOT_FOUND, ALREADY_PROPOSED, PROPOSAL_NOT_PENDING errors; POST_CREATED, POST_DELETED, LIKED, UNLIKED, COMMENT_ADDED, PINNED, UNPINNED, PROPOSAL_CREATED, PROPOSAL_APPROVED, PROPOSAL_REJECTED messages
- apps/gateway/src/controllers/groups/__tests__/groups.controller.test.ts — REWRITTEN: all 11 error classes in mock; getGroupMembers returns PaginatedGroupMembersResult; test suites for all new endpoints
- apps/gateway/src/controllers/admin/groups-admin.controller.ts — CREATED (GRP-R-006): listProposals, approveProposal, rejectProposal, pinPost, unpinPost; MODERATOR+ required
- apps/gateway/src/routes/admin/index.ts — UPDATED: 5 new admin group routes; inline schemas for proposalId/groupAndPost/rejectBody/status
- apps/gateway/src/controllers/admin/__tests__/groups-admin.controller.test.ts — CREATED (17 tests)
- apps/seeder/src/data/groups.data.ts — CREATED (GRP-R-007): 21 system groups (5 REGIONAL, 6 CULTURAL, 5 PROFESSIONAL, 5 INTEREST)
- apps/seeder/src/services/group-seed.service.ts — CREATED: seedSystemGroups() idempotent (findFirst by name), isSeeded:false, returns {created, existing, total}
- apps/seeder/src/controllers/seed.controller.ts — UPDATED: triggerRun calls seedSystemGroups() first; new seedGroups handler
- apps/seeder/src/routes/seed.routes.ts — UPDATED: POST /seed/groups route added
- apps/seeder/src/__tests__/seed.controller.test.ts — UPDATED: mockSeedGroups added; /seed/run tests updated; /seed/groups tests added
- apps/seeder/src/__tests__/group-seed.service.test.ts — CREATED (6 tests: create-all, idempotent, mixed, partial-failure, type-coverage, isSeeded:false)

NEW ENV VARS (Phase 8 — add to libs/config/src/env.ts + .env.example):
- SEEDER_SECRET: random secret token for gateway auth bypass (seeder + gateway both need it) ✅ added
- GATEWAY_URL: seeder's target for HTTP calls (default http://localhost:3000) ✅ added to seeder-env.ts
- SEEDER_PORT: seeder app port (default 3100) ✅ added to seeder-env.ts
- SEEDER_PHOTO_S3_PREFIX: S3 prefix for seeder photos (default seeder/profile-photos) ✅ added to seeder-env.ts
- SEEDER_INITIAL_COUNT: total profiles to seed on first run (default 500) ✅ added to seeder-env.ts
- OPENAI_API_KEY: OpenAI API key (optional — AI no-ops if absent) ✅ added to libs/config/src/env.ts
- AI_MODEL: OpenAI completions model (default gpt-4o-mini) ✅ added to libs/config/src/env.ts
- EMBEDDING_MODEL: OpenAI embedding model (default text-embedding-3-small) ✅ added to libs/config/src/env.ts

SonarCloud: SONAR_TOKEN in GitHub Secrets. Repo is public.

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
