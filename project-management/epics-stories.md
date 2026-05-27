# Abroad Matrimony — Epics & User Stories

> Each story has: description · acceptance criteria · implementation subtasks · status
>
> **Status key:** ✅ Done · 🔄 In Progress · ⏳ Backlog · 🚫 Blocked · ❌ Cancelled

---

## PHASE 2 — Auth

### AUTH-001 · Request OTP ✅
**Story:** As a new or returning user, I send my phone number and receive an OTP so I can log in.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `POST /api/v1/auth/otp/request` accepts `{ phone }` in request body
- [x] Phone is validated as E.164 format (e.g. `+919876543210`); returns 400 if invalid
- [x] Rate-limited to 3 requests per phone per hour via Redis; returns 429 with `retryAfterSeconds` if exceeded
- [x] On allowed request: OTP sent via Twilio Verify (SMS channel)
- [x] If `TWILIO_ACCOUNT_SID` not set in `.env`: log mock message, skip actual send
- [x] Returns `200 { success: true, data: { message, expiresInSeconds: 600 } }`
- [x] No DB query performed; no CloudEvent published here (moved to AUTH-002)
- [x] Unit tests pass (15 tests); route integration tests pass (9 tests)

**Implementation Subtasks:**

*Dependencies*
- [x] `npm install twilio compression @types/compression`

*Gateway infrastructure (one-time setup, needed by all Phase 2 routes)*
- [x] Add `compression` + `requestIdMiddleware` to `apps/gateway/src/app.ts`
- [x] Create `apps/gateway/tsconfig.json` — extends tsconfig.base, correct path alias resolution
- [x] Create `apps/gateway/src/types/express.d.ts` — augment `Request.requestId`
- [x] Create `apps/gateway/src/middleware/request-id.middleware.ts` — X-Request-ID
- [x] Create `apps/gateway/src/middleware/validate.middleware.ts` — `validateBody(schema)` factory
- [x] Create `apps/gateway/src/middleware/STANDARDS.md`
- [x] Add `requestId` to `AppError` response body in `error.middleware.ts`
- [x] Add `requestId?: string` to `ApiResponse` in `libs/shared/src/types/index.ts`

*libs/auth — service layer*
- [x] Create `libs/auth/package.json`
- [x] Create `libs/auth/src/adapters/base.otp.adapter.ts` — `OtpAdapter` interface
- [x] Create `libs/auth/src/adapters/twilio.otp.adapter.ts` — Twilio Verify implementation
- [x] Create `libs/auth/src/adapters/mock.otp.adapter.ts` — mock (dev/test)
- [x] Create `libs/auth/src/adapters/index.ts` — `getOtpAdapter()` factory
- [x] Create `libs/auth/src/otp.rate-limit.ts` — Redis INCR/EXPIRE pattern
- [x] Create `libs/auth/src/index.ts` — barrel exports

*Gateway — route + controller + schema*
- [x] Create `apps/gateway/src/schemas/auth/otp-request.schema.ts` — Zod E.164
- [x] Create `apps/gateway/src/controllers/auth/otp.controller.ts` — HTTP handler
- [x] Create `apps/gateway/src/controllers/auth/STANDARDS.md`
- [x] Create `apps/gateway/src/routes/auth/index.ts` — router (path + middleware chain only)
- [x] Create `apps/gateway/src/routes/auth/STANDARDS.md`
- [x] Create `apps/gateway/src/constants/auth.constants.ts` — AUTH_ERRORS, AUTH_MESSAGES, OTP_EXPIRY_SECONDS
- [x] Update `apps/gateway/src/routes/index.ts` — mount auth router at `/api/v1/auth`
- [x] Update `apps/gateway/package.json` — add `@abroad-matrimony/auth` dependency

*Tests (24 total — all passing)*
- [x] Create `jest.preset.js` + `libs/auth/jest.config.ts` + `apps/gateway/jest.config.ts`
- [x] Write `libs/auth/src/__tests__/otp.rate-limit.test.ts` (5 tests)
- [x] Write `libs/auth/src/__tests__/adapters/twilio.otp.adapter.test.ts` (6 tests)
- [x] Write `libs/auth/src/__tests__/adapters/mock.otp.adapter.test.ts` (4 tests)
- [x] Write `apps/gateway/src/controllers/auth/__tests__/otp.controller.test.ts` (9 tests)

**Decision Log:**
- `USER_REGISTERED` CloudEvent moved from AUTH-001 → AUTH-002 (user not yet in DB at this point; false event risk if verify fails) — see BUG-001
- `apps/gateway/tsconfig.json` must NOT override `baseUrl` — doing so breaks path aliases inherited from `tsconfig.base.json`

---

### AUTH-002 · Verify OTP ✅
**Story:** As a user, I submit the 6-digit OTP and my device fingerprint to get access + refresh tokens.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `POST /api/v1/auth/otp/verify` accepts `{ phone, code, deviceFingerprint, deviceName?, platform? }`
- [x] Validates code against Twilio Verify (or mock check in dev)
- [x] On success: upsert `users` row (create if new, find if existing)
- [x] On new user: publish `USER_REGISTERED` CloudEvent
- [x] Upsert `devices` row for this fingerprint
- [x] Issue JWT access token (15m) + refresh token (30d)
- [x] Store refresh token hash in Redis (`am:rt:<tokenId>`) + `refresh_tokens` DB table
- [x] Returns `200 { success: true, data: { accessToken, refreshToken, expiresIn, user } }`
- [x] Returns 400 if code invalid/expired (`OtpInvalidError` → `VALIDATION_ERROR`)
- [x] Enforces `MAX_DEVICES_PER_USER = 5` limit — returns 409 if exceeded (`DeviceLimitError` → `CONFLICT`)

**Implementation Subtasks:**
- [x] `libs/auth/src/jwt.service.ts` — `issueTokenPair()`, `verifyAccessToken()`, `verifyRefreshToken()`
- [x] `libs/auth/src/otp.service.ts` — `verifyOtp(phone, code)` via adapter
- [x] `libs/auth/src/refresh-token.service.ts` — `storeRefreshToken()`, `getStoredRefreshToken()`, `revokeToken()`, `revokeAllForUser()`, `hashToken()`
- [x] `libs/auth/src/otp-verify.service.ts` — orchestrator (`otpVerifyService()`), `OtpInvalidError`, `DeviceLimitError`
- [x] `apps/gateway/src/schemas/auth/otp-verify.schema.ts` — Zod schema + `OtpVerifyBody` type
- [x] `apps/gateway/src/controllers/auth/otp.controller.ts` — add `verifyOtp` handler (same file as `requestOtp`)
- [x] `apps/gateway/src/routes/auth/index.ts` — wire `POST /otp/verify` route
- [x] `libs/auth/src/index.ts` — barrel exports for all new services
- [x] Publish `USER_REGISTERED` event on `wasCreated === true` (ADR-008 enforced)

*Tests — 39 new tests (63 total across auth + gateway):*
- [x] `libs/auth/src/__tests__/jwt.service.test.ts` — 10 tests (issueTokenPair, verifyAccessToken, verifyRefreshToken)
- [x] `libs/auth/src/__tests__/refresh-token.service.test.ts` — 14 tests (hashToken, store, get, revoke, revokeAll)
- [x] `libs/auth/src/__tests__/otp-verify.service.test.ts` — 10 tests (returning user, new user, error cases)
- [x] `apps/gateway/src/controllers/auth/__tests__/otp-verify.controller.test.ts` — 8 tests (integration)

**Decision Log:**
- `DeviceLimitError` maps to HTTP 409 Conflict (not 422) — device limit is a resource contention conflict, not a validation error
- Existing device fingerprint bypasses device-count check — returning user on same device always succeeds regardless of count
- `verifyOtp()` sourced from `otp.service.ts` (which delegates to the same OTP adapter used in AUTH-001); same adapter, same mock in tests
- JWT `expiresIn` returned as integer seconds (900 = 15m) to avoid client-side string parsing

---

### AUTH-003 · Refresh Token ✅
**Story:** As a user with an expiring access token, I rotate my refresh token to get a new token pair.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `POST /api/v1/auth/token/refresh` accepts `{ refreshToken }` in body
- [x] Old token revoked immediately before issuing new pair (one-time-use guarantee)
- [x] If token already revoked (reuse detected): revoke ALL devices for that user via `revokeAllForUser()`
- [x] Returns new `{ accessToken, refreshToken, expiresIn }`
- [x] Returns 401 if token invalid/expired/not found
- [x] Returns 401 (not 409 or 403) on reuse — same response as invalid to avoid leaking information

**Implementation Subtasks:**
- [x] `libs/auth/src/token-refresh.service.ts` — `tokenRefreshService()`, `TokenInvalidError`, `TokenReuseError`
- [x] Reuse detection: `getStoredRefreshToken()` returns null → call `revokeAllForUser()` → throw `TokenReuseError`
- [x] DB user lookup on every refresh to pick up current role (e.g. upgraded to FOUNDING_MEMBER)
- [x] Deleted-account guard: user not found in DB → throw `TokenInvalidError`
- [x] `apps/gateway/src/schemas/auth/token-refresh.schema.ts` — Zod schema
- [x] `apps/gateway/src/controllers/auth/token.controller.ts` — `refreshToken` handler
- [x] `apps/gateway/src/routes/auth/index.ts` — `POST /token/refresh` wired
- [x] `libs/auth/src/index.ts` — barrel exports for new service + error classes

*Tests — 19 new tests (82 total):*
- [x] `libs/auth/src/__tests__/token-refresh.service.test.ts` — 12 tests
- [x] `apps/gateway/src/controllers/auth/__tests__/token-refresh.controller.test.ts` — 7 tests

**Decision Log:**
- Reuse detection returns identical 401 response as invalid token — callers cannot distinguish the two, preventing enumeration of security events
- Role is always fetched from DB at refresh time, not from token claims — ensures suspended/promoted users see correct access level on the very next refresh cycle
- Old token is revoked atomically (Redis + DB) *before* new pair is issued — if issue/store fails, the old token is already dead, preventing double-spend

---

### AUTH-005 · requireAuth Middleware ✅
**Story:** As any protected route, I need to verify the caller's identity before proceeding.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] Reads `Authorization: Bearer <token>` header
- [x] Verifies JWT with `JWT_ACCESS_SECRET`; attaches `req.user = { id, role, deviceId }`
- [x] Returns 401 if token missing/invalid/expired or scheme is not Bearer
- [x] Returns 403 if `role === 'SUSPENDED'`

**Implementation Subtasks:**
- [x] `libs/auth/src/middleware/require-auth.middleware.ts` — self-contained, sends JSON response directly (no AppError coupling so libs/auth stays framework-light)
- [x] `libs/auth/src/index.ts` — `requireAuth` exported from barrel
- [x] `apps/gateway/src/types/express.d.ts` — `req.user?: { id, role, deviceId }` augmentation added
- [x] `libs/auth/src/__tests__/middleware/require-auth.middleware.test.ts` — 9 tests

**Decision Log:**
- `requireAuth` sends raw JSON directly rather than calling `next(AppError)` — keeps `libs/auth` decoupled from `apps/gateway`'s `AppError` class; the response shape still matches `ApiResponse<never>`
- Lives in `libs/auth` (not `apps/gateway/middleware`) so it can be reused by `apps/admin-api` in a future phase

---

### AUTH-004 · Logout ✅
**Story:** As a user, I log out of my current device or all devices.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `POST /api/v1/auth/logout` — revokes current device refresh tokens → 204
- [x] `POST /api/v1/auth/logout/all` — revokes all refresh tokens for user → 204
- [x] Both protected by `requireAuth` middleware
- [x] Returns `204 No Content` (no body)

**Implementation Subtasks:**
- [x] `revokeForDevice(userId, deviceId)` added to `refresh-token.service.ts` — revokes by (userId, deviceId) pair (Redis + DB)
- [x] 3 new tests for `revokeForDevice` added to `refresh-token.service.test.ts`
- [x] `apps/gateway/src/controllers/auth/logout.controller.ts` — `logout` + `logoutAll` handlers
- [x] `apps/gateway/src/routes/auth/index.ts` — `POST /logout` + `POST /logout/all` wired with `requireAuth`
- [x] `libs/auth/src/index.ts` — `revokeForDevice` exported from barrel
- [x] `apps/gateway/src/controllers/auth/__tests__/logout.controller.test.ts` — 11 tests

**Decision Log:**
- Single-device logout uses `revokeForDevice(userId, deviceId)` — the `deviceId` comes from `req.user` which is set by the access token verified by `requireAuth`; no refresh token is needed in the request body
- Existing tests for otp/verify/refresh controllers updated to stub `requireAuth` as a pass-through — prevents route registration errors when `createApp()` loads the updated auth router

---

### AUTH-006 · Admin Login ✅
**Story:** As an admin, I log in with email + password + TOTP to get an admin JWT.
**Started:** 2026-05-27

**Acceptance Criteria:**
- [ ] `POST /admin/auth/login` accepts `{ email, password, totpCode? }`
- [ ] Email validated as valid email; password min 1 char — 400 if invalid
- [ ] Rate-limited to 10 attempts per email per 15 minutes via Redis → 429 + `retryAfterSeconds`
- [ ] Looks up `admin_users` by email; runs `bcrypt.compare` even when email not found (timing-safe)
- [ ] Returns 401 `INVALID_CREDENTIALS` on wrong email **or** wrong password (no enumeration)
- [ ] If `isTotpEnabled === true` and `totpCode` absent → 403 `TOTP_REQUIRED`
- [ ] If `isTotpEnabled === true` and `totpCode` present but wrong → 403 `TOTP_INVALID`
- [ ] On success: update `lastLoginAt`; issue admin JWT (`ADMIN_JWT_SECRET`, 8h); return `{ accessToken, expiresIn: 28800, admin: { id, email, name, role } }`

**Implementation Subtasks:**
- [x] `npm install bcrypt speakeasy` + dev types
- [x] `libs/shared/src/constants/index.ts` — add `ADMIN_LOGIN_ATTEMPTS` cache key
- [x] `libs/auth/src/jwt.service.ts` — add `issueAdminToken()`, `verifyAdminToken()`, `AdminTokenResult`
- [x] `libs/auth/src/admin.rate-limit.ts` — `checkAdminLoginRateLimit(email)`, 10 req/15 min
- [x] `libs/auth/src/admin-auth.service.ts` — `adminLoginService()`, `AdminCredentialsError`, `AdminTotpRequiredError`, `AdminTotpInvalidError`
- [x] `libs/auth/src/index.ts` — barrel exports for new service + error classes
- [x] `apps/gateway/src/constants/admin.constants.ts` — `ADMIN_ERRORS`, `ADMIN_MESSAGES`
- [x] `apps/gateway/src/schemas/admin/admin-login.schema.ts` — Zod schema
- [x] `apps/gateway/src/controllers/admin/admin-auth.controller.ts`
- [x] `apps/gateway/src/controllers/admin/STANDARDS.md`
- [x] `apps/gateway/src/routes/admin/index.ts`
- [x] `apps/gateway/src/routes/admin/STANDARDS.md`
- [x] `apps/gateway/src/routes/index.ts` — mount `/admin` router
- [x] `apps/gateway/src/types/express.d.ts` — add `req.admin?` augmentation
- [x] `libs/auth/src/__tests__/admin-auth.service.test.ts` — 9 unit tests
- [x] `libs/auth/src/__tests__/admin.rate-limit.test.ts` — 5 unit tests
- [x] `apps/gateway/src/controllers/admin/__tests__/admin-auth.controller.test.ts` — 9 integration tests
- [x] `libs/auth/src/__tests__/jwt.service.test.ts` — added 5 tests for admin JWT functions

**Decision Log:**
- 401 returned for both unknown email AND wrong password — prevents admin email enumeration
- `bcrypt.compare` always runs (with a lazy-cached dummy hash when email not found) — constant-time response prevents timing-based enumeration
- 403 `TOTP_REQUIRED` vs `TOTP_INVALID` are intentionally distinct: 403 only fires after password validates, so it reveals the password was correct — this is standard 2FA UX (same as AWS Console, GitHub) and acceptable for admin panels where email+password are already known to the attacker if they can guess one
- No refresh token for admin — 8h access token is the full session; admin sessions don't rotate
- Route mounted at `/admin/auth/login` (not `/api/v1/admin`) — separate namespace keeps admin and user APIs clearly distinct

---

### AUTH-007 · requireRole Middleware ✅
**Story:** As a route that needs a specific user role, I block access if the caller doesn't qualify.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `requireRole(...roles: UserRole[])` — factory returns middleware that checks `req.user.role`
- [x] Returns 401 if `req.user` is not set (requireAuth missing from chain)
- [x] Returns 403 FORBIDDEN if role not in allowed list
- [x] Composes with `requireAuth` (must come after in chain)
- [x] Works with single role or multiple roles (OR semantics)
- [x] Logs warning with userId + attempted role on 403

**Implementation Subtasks:**
- [x] `libs/auth/src/middleware/require-role.middleware.ts`
- [x] `libs/auth/src/types/express.d.ts` — Express Request augmentation for req.user / req.admin / req.requestId in libs/auth context
- [x] Tests — 12 tests covering 401 (no req.user), 403 (wrong role, multi-role list, SUSPENDED), next() calls

**Decision Log:**
- Added `libs/auth/src/types/express.d.ts` to mirror the gateway's Express augmentation.  TypeScript merges declarations — having it in both places is safe and required so ts-jest can compile auth middleware without TS errors inside the lib's own tsconfig context.

---

### AUTH-008 · requireAdminRole Middleware ✅
**Story:** As an admin route, I verify the caller has a valid admin JWT with the required AdminRole.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] Reads `Authorization: Bearer <token>`, verifies with `ADMIN_JWT_SECRET` via `verifyAdminToken()`
- [x] Attaches `req.admin = { id, role, email }` on success
- [x] Returns 401 if header missing/malformed or token invalid/expired
- [x] Returns 403 if `roles` list provided and admin's role is not in it
- [x] No role list → any authenticated admin is allowed
- [x] All admin mutations must write to `audit_logs` via `auditLog()` helper
- [x] `auditLog()` re-throws on DB failure so callers can decide whether to abort

**Implementation Subtasks:**
- [x] `libs/auth/src/middleware/require-admin-role.middleware.ts`
- [x] `libs/auth/src/audit.service.ts` — `auditLog(input: AuditLogInput): Promise<void>`
- [x] Tests — 15 tests (requireAdminRole: 13 tests, auditLog: 6 tests)
- [x] Barrel exports added to `libs/auth/src/index.ts`

**Decision Log:**
- `auditLog()` awaits the DB write and re-throws on failure.  Fire-and-forget was considered but rejected — silent audit failures would create compliance blind spots.  Controllers that call `auditLog()` should decide whether to abort the operation or log + continue.
- `Prisma.InputJsonValue` cast required for `before`/`after` JSON fields — Prisma's generated types are overly strict about `Record<string, unknown>` → `InputJsonValue`.  Using an explicit cast keeps the service signature ergonomic without widening to `any`.

---

## PHASE 3 — Profile

### PROF-001 · Create Profile ⏳
**Story:** As a verified phone user, I create my profile with basic details to join the platform.

**Acceptance Criteria:**
- [ ] `POST /api/v1/profile` — requires `requireAuth`
- [ ] Body: `{ name, dateOfBirth, gender, currentCity, currentCountry, settlementIntent, bio? }`
- [ ] Validates: name min 2 chars, DOB ≥ 18 years ago, gender enum, city/country non-empty
- [ ] Creates `profiles` row; returns `ProfileDto`
- [ ] 409 if profile already exists for this user

**Implementation Subtasks:**
- [ ] Schema + handler in `apps/gateway/src/routes/profile/`
- [ ] Tests

---

### PROF-002 · Upsert Real-Life Answer ⏳
**Story:** As a user, I answer one of the 12 real-life questions to improve my compatibility matching.

**Acceptance Criteria:**
- [ ] `PUT /api/v1/profile/real-life/:questionKey`
- [ ] Validates `questionKey` against `RealLifeQuestionKey` enum
- [ ] Upserts `real_life_answers` row
- [ ] Triggers completion score recalculation (async via event or direct)

---

### PROF-003 · Upsert Story Prompt ⏳
**Story:** As a user, I answer one of the 3 story prompts to give others a personal glimpse.

**Acceptance Criteria:**
- [ ] `PUT /api/v1/profile/story/:promptKey`
- [ ] Validates `promptKey` against `StoryPromptKey` enum
- [ ] Upserts `story_prompt_answers` row

---

### PROF-004 · Upload Profile Media ⏳
**Story:** As a user, I upload up to 6 photos that appear on my profile.

**Acceptance Criteria:**
- [ ] `POST /api/v1/profile/media` — multipart/form-data
- [ ] Accept: jpg, png, webp only; max 5 MB per file
- [ ] Upload to AWS S3; store `media` row with `s3Key` + `url`
- [ ] Max 6 photos per user; 409 if limit reached
- [ ] Requires `libs/storage` to be created (S3 adapter)

---

### PROF-005 · Completion Score ⏳
**Story:** As the platform, I compute a profile completion % so users know what to fill in.

**Acceptance Criteria:**
- [ ] Score components: basics 20% + RL answers 40% + story prompts 20% + photos 10% + verification 10%
- [ ] Recomputed on every profile/answer/media change
- [ ] Stored in `profiles.completionScore`

---

### PROF-006 · Get Profile ⏳
**Story:** As a user, I view my own profile or browse another user's profile.

**Acceptance Criteria:**
- [ ] `GET /api/v1/profile/me` — full own profile
- [ ] `GET /api/v1/profiles/:id` — public view (omit sensitive fields)
- [ ] Returns `ProfileDto`

---

## PHASE 4 — Matching

### MATCH-001 · Scoring Algorithm v1 ⏳
**Story:** As the platform, I compute a compatibility score between any two users across 9 dimensions.

**Dimensions & weights (sum = 1.0):**
- verification 0.15 · settlementIntent 0.20 · realLifeAnswers 0.25 · profileCompleteness 0.10 · checkInRecency 0.05 · ageCompatibility 0.10 · groupMembership 0.05 · languageMatch 0.05 · faithAlignment 0.05

**Acceptance Criteria:**
- [ ] `computeScore(userA, userB): ScoreBreakdown` — pure function, no side effects
- [ ] Total score normalised 0–1
- [ ] Result stored in `match_scores` table

---

### MATCH-002 · Score Compute Worker ⏳
**Story:** As the platform, I batch-compute scores for all user pairs when triggered.

**Acceptance Criteria:**
- [ ] BullMQ worker processes `SCORE_RECOMPUTE_REQUESTED` events
- [ ] Computes scores for all active user pairs
- [ ] Skips pairs computed within last 24h (unless forced)

---

### MATCH-003 · Cached Score Lookup ⏳
**Story:** As the discovery feed, I retrieve scores quickly from Redis without hitting the DB every time.

---

### MATCH-004 · Discovery Feed ⏳
**Story:** As a user, I see a paginated list of compatible matches sorted by score.

**Acceptance Criteria:**
- [ ] `GET /api/v1/discover?cursor=&limit=20`
- [ ] Filters: exclude suspended users, exclude already-connected users
- [ ] Cursor-based pagination

---

### MATCH-005 · Feature Flag for Algorithm v2 ⏳
**Story:** As the platform, I can roll out algorithm v2 to a subset of users without a deploy.

---

## PHASE 5 — Groups + Connections + Messaging

### GROUP-001 · Create Group ⏳
**Story:** As an admin, I create a regional group to bring users together.

**Acceptance Criteria:**
- [ ] `POST /admin/groups` — requires `requireAdminRole(SUPERADMIN, OPS)`
- [ ] Body: `{ name, region, launchDate, introDayOfWeek, capacity }`
- [ ] Creates `groups` row; returns `GroupDto`

---

### GROUP-002 · Weekly Intro Drop ⏳
**Story:** As the platform, I automatically drop intro pairs within each group every week on the configured day.

**Acceptance Criteria:**
- [ ] BullMQ cron job runs weekly
- [ ] Pairs members by score; creates `IntroDropLog` record
- [ ] Publishes `GROUP_INTRO_DROP` CloudEvent

---

### GROUP-003 · Member List ⏳
**Story:** As a group member, I see who else is in my group.

---

### CONN-001 · Send Connection ⏳
**Story:** As a user, I send a connection request to someone I'm interested in.

**Acceptance Criteria:**
- [ ] `POST /api/v1/connections` — body: `{ receiverId, message? }`
- [ ] Requires `FOUNDING_MEMBER` role (diamond spend gate) or free tier limit
- [ ] Creates `connections` row; publishes `CONNECTION_SENT` event

---

### CONN-002 · Accept / Decline ⏳
**Story:** As a user, I respond to an incoming connection request.

**Acceptance Criteria:**
- [ ] `PATCH /api/v1/connections/:id` — body: `{ action: 'accept' | 'decline' }`
- [ ] On accept: trigger CONN-003 (match creation)
- [ ] Publishes `CONNECTION_ACCEPTED` or declines silently

---

### CONN-003 · Match Creation ⏳
**Story:** As the platform, I create a Match when a connection is accepted, enabling messaging.

**Acceptance Criteria:**
- [ ] Creates `matches` + `conversations` row atomically
- [ ] Publishes `MATCH_CREATED` event

---

### VER-001 · Submit Verification ⏳
**Story:** As a user, I upload my ID document + selfie to request identity verification.

---

### VER-002 · Admin Review Queue ⏳
**Story:** As an admin, I see pending verification requests and review them.

---

### VER-003 · Approve / Reject ⏳
**Story:** As an admin, I approve or reject a verification request.

---

### MSG-001 · Conversation Endpoints ⏳
**Story:** As matched users, we have a conversation thread we can fetch.

---

### MSG-002 · Send / Fetch Messages ⏳
**Story:** As a matched user, I send and read messages in a conversation.

---

### MSG-003 · WebSocket Real-time ⏳
**Story:** As a user in an active conversation, messages appear in real-time without polling.

---

### MSG-004 · Read Receipts ⏳
**Story:** As a sender, I know when my message has been read.

---

## PHASE 6 — Notifications

### NOTIF-001 · Brevo Email Adapter ⏳
**Story:** As the platform, I send transactional emails via Brevo.

---

### NOTIF-002 · Twilio SMS Adapter ⏳
**Story:** As the platform, I send SMS notifications via Twilio Programmable SMS.

---

### NOTIF-003 · Firebase Push Adapter ⏳
**Story:** As the platform, I send push notifications to mobile devices via Firebase Admin SDK.

---

### NOTIF-004 · Notification Worker ⏳
**Story:** As the platform, I process notification jobs from the BullMQ queue and dispatch via the right channel.

---

## PHASE 7 — Payments

### PAY-001 · Stripe Checkout ⏳
### PAY-002 · Stripe Webhook ⏳
### PAY-003 · Razorpay Order ⏳
### PAY-004 · Razorpay Webhook ⏳
### PAY-005 · Membership Activation ⏳
### PAY-006 · Diamond Purchase ⏳
### PAY-007 · Diamond Spend ⏳
### PAY-008 · Refund Handling ⏳

---

## PHASE 8 — Admin API + Analytics

### ADMIN-001 · Admin Login ⏳ (see AUTH-006)
### ADMIN-002 · User Management ⏳
### ADMIN-003 · Feature Flag Toggle ⏳
### ADMIN-004 · Verification Queue ⏳
### ADMIN-005 · Audit Log Viewer ⏳
### ADMIN-006 · Moderation Queue ⏳
### ADMIN-007 · KPI Dashboard ⏳
