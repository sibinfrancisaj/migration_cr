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

### PROF-001 · Create Profile ✅
**Story:** As a verified phone user, I create my profile with basic details to join the platform.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `POST /api/v1/profile` — requires `requireAuth`
- [x] Body: `{ name, dateOfBirth, gender, currentCity, currentCountry, settlementIntent, bio? }`
- [x] Validates: name ≥ 2 chars, DOB ≥ 18 years ago (z.coerce.date + refine), gender enum, city/country/settlementIntent non-empty
- [x] Creates `profiles` row; returns `ProfileDto` (empty arrays for photos/answers not yet created)
- [x] 409 CONFLICT if profile already exists for this user
- [x] 28 tests passing (10 service + 18 controller)

**Implementation Subtasks:**
- [x] Create `libs/profile/` — new domain library
- [x] `libs/profile/package.json` + `tsconfig.spec.json` + `jest.config.ts`
- [x] `libs/profile/src/profile.service.ts` — `createProfileService()` + `ProfileAlreadyExistsError`
- [x] `libs/profile/src/index.ts` — barrel exports
- [x] `apps/gateway/src/schemas/profile/create-profile.schema.ts` — Zod schema with `z.coerce.date()` + age guard
- [x] `apps/gateway/src/constants/profile.constants.ts` — PROFILE_ERRORS
- [x] `apps/gateway/src/controllers/profile/profile.controller.ts` + STANDARDS.md
- [x] `apps/gateway/src/routes/profile/index.ts` + STANDARDS.md
- [x] Update `apps/gateway/src/routes/index.ts` — mount at `/api/v1/profile`
- [x] Update `apps/gateway/package.json`, `tsconfig.base.json`, `jest.preset.js`, `gateway/jest.config.ts` — wire new lib
- [x] Tests — 10 unit (profile.service) + 18 integration (profile.controller)

**Decision Log:**
- New `libs/profile/` library created, following the same structure as `libs/auth/` — business logic stays out of the gateway.
- `z.coerce.date()` used for `dateOfBirth` — accepts ISO 8601 date strings (`"1990-05-15"`) and full datetimes (`"1990-05-15T00:00:00Z"`), converts to `Date` before the age refine runs.
- `completionScore` starts at 0 on creation. PROF-005 will implement the recalculation function called after every profile mutation.
- `ProfileDto.isVerified` is derived inline: `verificationStatus === VerificationStatus.APPROVED`.
- `bio: null` from Prisma mapped to `undefined` in `ProfileDto` to satisfy the `bio?: string` type.

---

### PROF-002 · Upsert Real-Life Answer ✅
**Story:** As a user, I answer one of the 12 real-life questions to improve my compatibility matching.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `PUT /api/v1/profile/real-life/:questionKey`
- [x] Validates `questionKey` against `RealLifeQuestionKey` enum — returns 400 VALIDATION_ERROR if invalid
- [x] Validates `value` as string (1–500 chars) or string array (1–20 items, each ≤200 chars)
- [x] Upserts `real_life_answers` row (composite key: `userId_questionKey`)
- [x] Triggers completion score recalculation synchronously (awaited for DB consistency)
- [x] Returns 404 NOT_FOUND when user has no profile yet
- [x] Returns 200 `{ success: true, data: RealLifeAnswerDto }` on success
- [x] 41 new tests added; 245 total tests, all passing

**Implementation Subtasks:**

*libs/profile — service layer*
- [x] Create `libs/profile/src/real-life-answer.service.ts` — `upsertRealLifeAnswer()`, `ProfileNotFoundError`
- [x] Create `libs/profile/src/score.service.ts` — `recalculateCompletionScore()` (basics 20 + RL 40 + story 20 + photo 10 + verification 10)
- [x] Update `libs/profile/src/index.ts` — export new services and types

*Gateway — schema + controller (extends existing route file)*
- [x] Create `apps/gateway/src/schemas/profile/upsert-real-life-answer.schema.ts` — param + body Zod schemas
- [x] Add `validateParams()` to `apps/gateway/src/middleware/validate.middleware.ts`
- [x] Add `upsertRealLifeAnswer` handler to `apps/gateway/src/controllers/profile/profile.controller.ts`
- [x] Add `PUT /real-life/:questionKey` route to `apps/gateway/src/routes/profile/index.ts`
- [x] Update `apps/gateway/src/constants/profile.constants.ts` — `NOT_FOUND` error constant

*Tests (41 new tests, all passing)*
- [x] `libs/profile/src/__tests__/real-life-answer.service.test.ts` — 12 tests (happy path, guard, upsert params, score call, error propagation)
- [x] `libs/profile/src/__tests__/score.service.test.ts` — 17 tests (all score breakdowns, pro-rating, DB write, no-profile guard, error propagation)
- [x] Extended `apps/gateway/src/controllers/profile/__tests__/profile.controller.test.ts` — 12 PROF-002 integration tests (200 string, 200 array, 401, 400 bad param, 400 missing value, 400 empty string, 400 empty array, 400 oversized, 400 bad array item, 400 wrong type, 404, 500)

**Decision Log:**
- Score recalculation is synchronous (awaited), not fire-and-forget. Ensures DB consistency even at slightly higher latency. Revisit as a BullMQ job if p99 latency becomes an issue during Matching phase.
- `ProfileNotFoundError` lives in `real-life-answer.service.ts` and is exported from the `libs/profile` barrel, ready to be reused by future services (story prompt, check-ins) that also require a profile to exist.
- `recalculateCompletionScore()` implemented as part of PROF-002 rather than waiting for PROF-005. PROF-005 now tracks wiring up the score call in PROF-003 and PROF-004.

---

### PROF-003 · Upsert Story Prompt ✅
**Story:** As a user, I answer one of the 3 story prompts to give others a personal glimpse.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `PUT /api/v1/profile/story/:promptKey`
- [x] Validates `promptKey` against `StoryPromptKey` enum — returns 400 VALIDATION_ERROR if invalid
- [x] Validates `answer` as non-empty string (1–1000 chars)
- [x] Upserts `story_prompt_answers` row (composite key: `userId_promptKey`)
- [x] Triggers completion score recalculation synchronously (awaited)
- [x] Returns 404 NOT_FOUND when user has no profile yet
- [x] Returns 200 `{ success: true, data: StoryPromptAnswerDto }` on success
- [x] 24 new tests; 269 total tests, all passing

**Implementation Subtasks:**

*libs/profile — service layer*
- [x] Create `libs/profile/src/story-prompt.service.ts` — `upsertStoryPrompt()`, reuses `ProfileNotFoundError`
- [x] Update `libs/profile/src/index.ts` — export `upsertStoryPrompt` and `UpsertStoryPromptInput`

*Gateway — schema + controller + route*
- [x] Create `apps/gateway/src/schemas/profile/upsert-story-prompt.schema.ts` — param + body Zod schemas
- [x] Add `upsertStoryPrompt` handler to `apps/gateway/src/controllers/profile/profile.controller.ts`
- [x] Add `PUT /story/:promptKey` to `apps/gateway/src/routes/profile/index.ts`

*Tests (24 new tests, all passing)*
- [x] `libs/profile/src/__tests__/story-prompt.service.test.ts` — 13 tests (happy path for all 3 keys, guard, upsert params, score call, error propagation)
- [x] Extended `apps/gateway/src/controllers/profile/__tests__/profile.controller.test.ts` — 11 PROF-003 integration tests (200, 200 all 3 keys, 401, 400 bad param, 400 missing, 400 empty, 400 too long, 400 wrong type, 404, 500)

**Decision Log:**
- `ProfileNotFoundError` imported directly from `./real-life-answer.service.js` within the lib (no circular dependency). Will refactor into a shared `errors.ts` if a third service needs it.
- Story prompts accept up to 1000 characters (vs 500 for real-life answers) — story prompts are narrative text and benefit from more space.

---

### PROF-004 · Upload Profile Media ✅
**Story:** As a user, I upload up to 6 photos that appear on my profile.

**Acceptance Criteria:**
- [x] `POST /api/v1/profile/media` — multipart/form-data, field name `photo`
- [x] Accept: jpg, png, webp only; max 5 MB per file
- [x] Upload to AWS S3 (or mock in dev/test); store `media` row with `s3Key` + `url`
- [x] Max 6 photos per user; 409 if limit reached
- [x] `libs/storage` created — S3 adapter + mock adapter + factory
- [x] Recalculates completion score after upload

**Subtasks:**
- [x] Install `@aws-sdk/client-s3` + `multer` + `@types/multer`
- [x] Add `@abroad-matrimony/storage` alias to `jest.preset.js`
- [x] `libs/storage/src/adapters/base.storage.adapter.ts` — `StorageAdapter` interface
- [x] `libs/storage/src/adapters/s3.storage.adapter.ts` — S3Client, PutObjectCommand, DeleteObjectCommand
- [x] `libs/storage/src/adapters/mock.storage.adapter.ts` — fake CDN URLs, no network
- [x] `libs/storage/src/adapters/index.ts` — `getStorageAdapter()` factory
- [x] `libs/storage/src/index.ts` — barrel
- [x] `libs/storage/jest.config.ts`
- [x] `libs/profile/src/media.service.ts` — `uploadProfilePhoto()`, `PhotoLimitExceededError`, `InvalidMimeTypeError`
- [x] Updated `libs/profile/src/index.ts` barrel
- [x] Added media error/message constants to `apps/gateway/src/constants/profile.constants.ts`
- [x] `apps/gateway/src/middleware/upload.middleware.ts` — multer memoryStorage, `uploadSinglePhoto`
- [x] `profileController.uploadPhoto` handler
- [x] `POST /media` route wired in `routes/profile/index.ts`
- [x] `libs/storage/src/__tests__/mock.storage.adapter.test.ts` (6 tests)
- [x] `libs/storage/src/__tests__/s3.storage.adapter.test.ts` (9 tests)
- [x] `libs/profile/src/__tests__/media.service.test.ts` (21 tests)
- [x] Extended controller integration test with 10 PROF-004 tests

**Decision Log:**
- S3 bucket kept private (no public ACL); CloudFront handles public delivery. URL is CloudFront-based when `AWS_CLOUDFRONT_DOMAIN` is set, otherwise S3 path-style.
- `getStorageAdapter()` factory returns `MockStorageAdapter` when AWS credentials are absent — no env var required for local dev or CI.
- `LIMIT_UNEXPECTED_FILE` MulterError (wrong field name) is mapped to 400 `NO_FILE_UPLOADED` — same UX as sending no file at all.
- S3 key pattern: `photos/<userId>/<randomUUID>.<ext>` — UUID guarantees uniqueness; extension from original filename for content negotiation.
- Media `order` is set to `existingPhotoCount + 1` on upload (1-based). No reorder endpoint yet — added to future-plans.

---

### PROF-005 · Completion Score ✅
**Story:** As the platform, I compute a profile completion % so users know what to fill in.

**Acceptance Criteria:**
- [x] Score components: basics 20% + RL answers 40% + story prompts 20% + photos 10% + verification 10%
- [x] `recalculateCompletionScore()` implemented in `libs/profile/src/score.service.ts` (PROF-002)
- [x] Called after profile creation (PROF-001) and real-life answer upsert (PROF-002)
- [x] Called after story prompt upsert (PROF-003)
- [x] Called after media upload (PROF-004)
- [x] Stored in `profiles.completionScore`

---

### PROF-006 · Get Profile ✅
**Story:** As a user, I view my own profile or browse another user's profile.
**Completed:** 2026-05-27

**Acceptance Criteria:**
- [x] `GET /api/v1/profile/me` — full own profile (auth required)
- [x] `GET /api/v1/profiles/:id` — profile by ID (auth required, UUID validation on param)
- [x] Returns `ProfileDto` with nested `realLifeAnswers`, `storyPrompts`, `photos`
- [x] Returns 404 NOT_FOUND if profile does not exist
- [x] 29 new tests; 298 total, all passing

**Implementation Subtasks:**

*libs/profile — service layer*
- [x] Add `getOwnProfile(userId)` to `libs/profile/src/profile.service.ts`
- [x] Add `getProfileById(profileId)` to `libs/profile/src/profile.service.ts`
- [x] Add private `toProfileDto()` mapper — maps profile row + related rows → `ProfileDto`; replaces hardcoded empty arrays in `createProfileService`
- [x] Update `libs/profile/src/index.ts` — export `getOwnProfile`, `getProfileById`

*Gateway — schema + controller + routes*
- [x] Create `apps/gateway/src/schemas/profile/get-profile.schema.ts` — `z.string().uuid()` param validation
- [x] Add `getOwnProfile` + `getProfileById` handlers to `apps/gateway/src/controllers/profile/profile.controller.ts`
- [x] Add `GET /me` to `apps/gateway/src/routes/profile/index.ts`
- [x] Create `apps/gateway/src/routes/profiles/index.ts` — `GET /:id` (plural router for public browse)
- [x] Register `profilesRouter` at `/api/v1/profiles` in `apps/gateway/src/routes/index.ts`

*Tests (29 new tests, all passing)*
- [x] Extended `libs/profile/src/__tests__/profile.service.test.ts` — 18 new tests for `getOwnProfile` + `getProfileById` (DTO shape, nested mapping, not-found, error propagation)
- [x] Extended `apps/gateway/src/controllers/profile/__tests__/profile.controller.test.ts` — 11 PROF-006 integration tests (200 me, 200 by-id, 401, 400 bad UUID, 404, 500 for both endpoints)

**Decision Log:**
- `GET /api/v1/profiles/:id` requires auth (you must be logged in to browse profiles) — open public browse could enable scraping; revisit if anonymous preview is needed for SEO.
- Both endpoints currently return the same `ProfileDto`. A `PublicProfileDto` (omitting `dateOfBirth`, `completionScore`, internal fields) should be introduced when the discovery/browse feature is built in the Matching phase. Noted in `future-plans.md`.
- Nested data (`realLifeAnswers`, `storyPromptAnswers`, `media`) cannot be fetched via Prisma include on `Profile` because those models relate to `User`, not `Profile`. They are fetched in parallel via `Promise.all` using the shared `userId`.
- `getProfileById` fetches the profile first (one round trip) then the nested data (one parallel round trip) — two DB calls total. Acceptable for MVP; could collapse to a single query via a User join if needed later.

---

## PHASE 4 — Matching

### MATCH-001 · Scoring Algorithm v1 ✅
**Story:** As the platform, I compute a compatibility score between any two users across 9 dimensions.

**Dimensions & weights (sum = 1.0):**
- verification 0.15 · settlementIntent 0.20 · realLifeAnswers 0.25 · profileCompleteness 0.10 · checkInRecency 0.05 · ageCompatibility 0.10 · groupMembership 0.05 · languageMatch 0.05 · faithAlignment 0.05

**Acceptance Criteria:**
- [x] `computeMatchScore(userA, userB, now?): ScoreResult` — pure function, no side effects, injectable `now` for tests
- [x] Total score normalised 0–1 (weighted sum rounded to 2dp)
- [x] Result stored in `match_scores` table via `computeAndSaveScore()`
- [x] Pair canonicalization — smaller UUID always stored as `userAId` (idempotent upsert)
- [x] `getUserScoringData()` exported for MATCH-002 batch worker reuse
- [x] 77 unit tests, 2 test suites — all green

**Key files:**
- `libs/matching/src/scoring.service.ts` — pure algorithm, all 9 dimension scorers, helpers (`tokenize`, `jaccardSimilarity`, `answerSimilarity`, `recencyScore`, `ageInYears`)
- `libs/matching/src/match-score.service.ts` — DB fetch (`getUserScoringData`), orchestration (`computeAndSaveScore`), `UserProfileMissingError`
- `libs/matching/src/index.ts` — barrel
- `libs/matching/src/__tests__/scoring.service.test.ts` — 56 pure-function tests
- `libs/matching/src/__tests__/match-score.service.test.ts` — 21 service/DB tests

**Decision Log:**
- **Jaccard similarity for text answers** — tokenize on `[\s,\/\-]+`, filter tokens < 2 chars; handles "UK or Canada" vs "Canada or UK" correctly (same token set → 1.0).
- **`answerSimilarity`** wraps scalar strings in a single-element set before Jaccard so `"Vegetarian" == "Vegetarian"` → 1.0.
- **Pair canonicalization** — `canonicalizePair(a, b)` returns `[a,b]` sorted lexicographically to guarantee the `@@unique([userAId, userBId, algorithmV])` constraint is never violated by reverse-order calls.
- **Injectable `now: Date`** — avoids flaky time-sensitive tests; all recency/age calculations pass `now` through.
- **`getUserScoringData` exported** — MATCH-002 BullMQ batch worker will call it directly to avoid code duplication.

---

### MATCH-002 · Score Compute Worker ✅
**Story:** As the platform, I batch-compute scores for all user pairs when triggered.

**Acceptance Criteria:**
- [x] BullMQ Worker processes `score-recompute` jobs on the `MATCHING` queue
- [x] Fetches all user IDs with profile rows in a single query
- [x] Bulk-loads recent scores in one query to avoid per-pair stale DB calls
- [x] Skips pairs computed within last 24 h when `force: false` (default)
- [x] Recomputes all pairs unconditionally when `force: true`
- [x] `UserProfileMissingError` increments error count — job does not crash
- [x] Generic per-pair errors increment error count — job does not crash
- [x] Publishes `SCORE_RECOMPUTE_COMPLETED` CloudEvent on finish (even with errors)
- [x] `enqueueScoreRecompute(redisUrl, data?)` helper for triggering the job
- [x] Fixed `jobId: "score-recompute"` for BullMQ deduplication
- [x] `processScoreRecompute()` exported separately for unit-test isolation (no BullMQ dep)
- [x] Progress reporting via `job.updateProgress(pct)` callback
- [x] Worker started/closed in `apps/gateway/src/server.ts` as part of graceful lifecycle
- [x] 22 unit tests — all green

**Key files:**
- `libs/matching/src/score-recompute.worker.ts` — `processScoreRecompute` + `createScoreRecomputeWorker` + `enqueueScoreRecompute`
- `libs/matching/src/__tests__/score-recompute.worker.test.ts` — 22 tests
- `apps/gateway/src/server.ts` — worker start/close wired into lifecycle
- `libs/shared/src/constants/index.ts` — `SCORE_RECOMPUTE_COMPLETED` added

**Decision Log:**
- **`processScoreRecompute` extracted from BullMQ Worker** — pure async function with optional `onProgress` callback; lets tests cover all business logic without mocking the BullMQ `Worker` class.
- **Bulk stale-check** — one `prisma.matchScore.findMany` loads all fresh pairs into a `Set<string>`; avoids N*(N-1)/2 individual `findUnique` calls.
- **Fixed `jobId`** — `"score-recompute"` prevents queuing duplicate pending jobs when admin triggers multiple recomputes rapidly.
- **`concurrency: 1`** — only one full recompute runs at a time; a second enqueued job waits until the first finishes.
- **In-process worker** — Worker runs inside the gateway process for Phase 4 MVP. ADR note added: move to dedicated worker app (`apps/worker`) in production.

---

### MATCH-003 · Cached Score Lookup ✅
**Story:** As the discovery feed, I retrieve scores quickly from Redis without hitting the DB every time.

**Acceptance Criteria:**
- [x] `getMatchScore(userAId, userBId)` — cache-aside: Redis first, DB fallback, then populates cache
- [x] `setMatchScoreCache(score)` — write-through on every `computeAndSaveScore` call
- [x] `deleteMatchScoreCache(userAId, userBId)` — explicit eviction for profile-update scenarios
- [x] Canonical pair key (`user-a:user-b` always, never `user-b:user-a`) regardless of argument order
- [x] `computedAt` re-hydrated from ISO string → `Date` on cache read
- [x] Redis errors swallowed with `log.warn` — never surface to callers
- [x] TTL = `CACHE_TTL.MATCH_SCORES_SECONDS` (86 400 s = 24 h)
- [x] `computeAndSaveScore` auto-populates cache after every DB upsert
- [x] 18 unit tests — all green

**Key files:**
- `libs/matching/src/score-cache.service.ts` — `getMatchScore` + `setMatchScoreCache` + `deleteMatchScoreCache`
- `libs/matching/src/__tests__/score-cache.service.test.ts` — 18 tests
- `libs/shared/src/constants/index.ts` — `CACHE_KEYS.MATCH_SCORE_PAIR` added

**Decision Log:**
- **Cache-aside pattern** — `getMatchScore` tries Redis, falls to DB on miss/error, then backfills cache. Keeps DB as source of truth; cache is best-effort.
- **Write-through on compute** — `computeAndSaveScore` calls `setMatchScoreCache` immediately after the DB upsert so the first discovery-feed read after a recompute is always a cache hit.
- **Error swallowing** — all Redis errors are caught inside the three cache functions; the DB path is always available as a fallback. This prevents a Redis outage from taking down score lookups.

---

### MATCH-004 · Discovery Feed ✅
**Story:** As a user, I see a paginated list of compatible matches sorted by score.

**Acceptance Criteria:**
- [x] `GET /api/v1/discover?cursor=&limit=20`
- [x] Filters: exclude suspended users, exclude already-connected users
- [x] Cursor-based pagination (composite keyset: `totalScore DESC, id ASC`)
- [x] Returns `ApiResponse<DiscoveryItemDto[]>` with `meta.cursor` + `meta.hasMore`
- [x] Validation: limit 1–100 (400 on bad value), cursor is opaque base64url string

**Key files:**
- `libs/matching/src/discover.service.ts` — `getDiscoveryFeed()`, `encodeCursor()`, `decodeCursor()`, `computeAge()`
- `apps/gateway/src/controllers/discover/discover.controller.ts` — `discoverController.getFeed`
- `apps/gateway/src/routes/discover/index.ts` — GET / with `requireAuth` + `validateQuery`
- `apps/gateway/src/schemas/discover/discover.schema.ts` — `discoverQuerySchema`
- `apps/gateway/src/lib/feature-flag-store.ts` — `PrismaFeatureFlagStore`
- Tests: `libs/matching/src/__tests__/discover.service.test.ts` (24 tests)
- Tests: `apps/gateway/src/controllers/discover/__tests__/discover.controller.test.ts` (12 tests)

**Decision Log:**
- Cursor encodes `{ score, id }` as base64url JSON for stable pagination when scores are equal
- Suspended users + already-connected users filtered in one pass after score lookup
- `FeatureFlagService` is a lazy singleton in the controller (initialised on first request) so Jest mocks are in place before the constructor runs

---

### MATCH-005 · Feature Flag for Algorithm v2 ✅
**Story:** As the platform, I can roll out algorithm v2 to a subset of users without a deploy.

**Key files:**
- Controller: lazy `FeatureFlagService` singleton checks `FEATURE_FLAGS.MATCHING_ALGORITHM_V2` per request
- `PrismaFeatureFlagStore` reads from the `feature_flags` table (Phase 4 MVP — uncached)
- If flag is enabled for `userId`, `algorithmVersion: 'v2'` is passed to `getDiscoveryFeed()`; otherwise `ALGORITHM_VERSION` ('v1') is used
- 2 integration tests cover flag-off (v1) and flag-on (v2) paths

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

### MSG-000 · libs/messaging scaffold + Firebase setup ✅
**Story:** As the platform, I have a messaging adapter layer and Firebase project wired up so all MSG stories can be built on top of it.
**Completed:** 2026-05-28

**Architecture Decision (ADR-010):**
- **Primary message store:** Google Firestore (same Firebase project as FCM push notifications)
- **Presence / onDisconnect:** Firebase Realtime DB (Firestore has no onDisconnect equivalent)
- **Media uploads (image + voice):** S3 via presigned URL — Flutter uploads direct to S3, URL stored in Firestore
- **Writes go through backend API** (validation, Firestore fanout, FCM trigger — all in one Node.js call)
- **Reads are direct Firestore** from Flutter client (real-time listeners, zero latency, offline sync)
- **Flags / moderation records:** Postgres via backend API (audit trail, admin queries)
- **Delivered status:** deferred to F-033 — MVP has sent + read only

**Firestore data structure:**
```
conversations/{convId}/
  messages/{msgId}
    senderId        string
    type            'text' | 'image' | 'voice'
    content         string          // text body OR S3/CloudFront URL
    durationSeconds number?         // voice only
    thumbnailUrl    string?         // image only (future)
    readAt          Timestamp?
    createdAt       Timestamp
    flagCount       number          // auto-moderation counter
    isHidden        boolean         // true when flagCount >= threshold (3)

  typing/{userId}
    isTyping        boolean
    updatedAt       Timestamp

users/{userId}/
  inbox/{convId}
    conversationId  string
    otherUserId     string
    otherUserName   string
    otherUserPhotoUrl string
    lastMessage     string          // text preview OR "📷 Photo" OR "🎤 Voice"
    lastMessageAt   Timestamp
    lastMessageType string
    lastSenderId    string
    unreadCount     number

presence/{userId}                  [Realtime DB — not Firestore]
  online          boolean
  lastSeen        Timestamp
```

**Prisma schema changes required (before MSG-001):**
- `MessageType` enum: add `IMAGE` (currently TEXT, VOICE, SYSTEM)
- `Message` model: add `mediaUrl String?`, `durationSeconds Int?`, `flagCount Int @default(0)`, `isHidden Boolean @default(false)`
- `Flag` model: add `FlagReason` enum (replace free-text `reason` String), add `actionTaken FlagAction?`
- New enums: `FlagReason`, `FlagAction`

**Acceptance Criteria:**
- [x] `libs/messaging/src/adapters/base.messaging.adapter.ts` — `MessagingAdapter` interface
- [x] `libs/messaging/src/adapters/firestore.messaging.adapter.ts` — Firebase Admin SDK implementation
- [x] `libs/messaging/src/adapters/mock.messaging.adapter.ts` — in-memory for tests (18 tests, all green)
- [x] `libs/messaging/src/adapters/index.ts` — `getMessagingAdapter()` factory (lazy singleton)
- [x] Firebase Admin SDK initialised in gateway `server.ts` (shared with FCM); graceful shutdown
- [x] Prisma schema updated: `IMAGE` in `MessageType`, `mediaUrl/durationSeconds/flagCount/isHidden` on `Message`, `FlagReason`/`FlagAction` enums, `Flag.reason` → `FlagReason`, `Flag.actionTaken FlagAction?`, `Flag.firestoreMsgId String?`
- [x] `libs/firebase/` singleton lib created (`initFirebase`, `getFirestoreDb`, `getRealtimeDb`, `getFirebaseMessaging`, `shutdownFirebase`, `isFirebaseConfigured`)
- [x] `libs/messaging/package.json` + `tsconfig.base.json` path aliases + `jest.preset.js` moduleNameMapper

**Key files:**
- `libs/firebase/src/firebase.ts` — Firebase Admin SDK singleton; `isFirebaseConfigured()` guards startup
- `libs/firebase/src/index.ts` — barrel
- `libs/messaging/src/adapters/base.messaging.adapter.ts` — `MessagingAdapter` interface
- `libs/messaging/src/adapters/firestore.messaging.adapter.ts` — Firestore implementation (batch writes, transactions for flagCount)
- `libs/messaging/src/adapters/mock.messaging.adapter.ts` — in-memory mock; `_reset()` for test isolation
- `libs/messaging/src/adapters/index.ts` — `getMessagingAdapter()` / `resetMessagingAdapter()`
- `libs/messaging/src/types/messaging.types.ts` — `MessageDto`, `ConversationMetaDto`, `SendMessageParams`, `MarkReadParams`, `FlagMessageParams`, `PaginatedMessagesResult`, `MessageType` enum
- `libs/messaging/src/__tests__/mock.adapter.test.ts` — 18 unit tests
- `apps/gateway/src/server.ts` — `initFirebase()` + `shutdownFirebase()` in lifecycle

**Decision Log:**
- `libs/firebase` created as a separate singleton lib (like `libs/cache`) so Firestore, FCM, and Realtime DB can all be served from one initialized app shared between `libs/messaging` and future `libs/notification`
- `FirestoreMessagingAdapter` uses ISO string timestamps (not Firestore Timestamps) to keep DTOs portable and serializable without Firebase dependencies in the service/controller layers
- `flagCount` increment uses a Firestore transaction (read-modify-write) to prevent race conditions when multiple users flag simultaneously
- `getMessagingAdapter()` falls back to `MockMessagingAdapter` when Firebase credentials absent — dev/CI works with zero configuration
- `firebase-admin` v13.10.0 installed; no peer dep conflicts

---

### MSG-001 · Conversation REST endpoints ✅
**Story:** As matched users, we can GET our conversation metadata and message history via REST (fallback + admin use — real-time is via Firestore direct).
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `GET /api/v1/conversations` — list my conversations ordered by most-recent message
- [x] `GET /api/v1/conversations/:convId` — get single conversation metadata
- [x] `GET /api/v1/conversations/:convId/messages?cursor=&limit=` — paginated message history (limit 1–100, default 50; cursor is ISO timestamp)
- [x] 401 if not authenticated; 403 if caller is not a participant; 404 if conversation does not exist
- [x] 400 if `convId` is not a valid UUID or `limit` is out of range
- [x] Returns `ConversationSummaryDto` (with `otherUser: { userId, name, photoUrl }`) + `MessageDto[]`

**Key files:**
- `libs/messaging/src/conversation.service.ts` — `listConversations()`, `getConversation()`, `getConversationMessages()`, `ConversationNotFoundError`, `ConversationForbiddenError`
- `libs/messaging/src/types/messaging.types.ts` — `ConversationSummaryDto`, `OtherUserSummary` added
- `apps/gateway/src/constants/messaging.constants.ts` — `MESSAGING_ERRORS`, `MESSAGING_MESSAGES`, `MESSAGING_LIMITS`
- `apps/gateway/src/schemas/conversations/messages.schema.ts` — `messagesQuerySchema` + `convIdParamsSchema`
- `apps/gateway/src/controllers/conversations/conversations.controller.ts` — `list`, `getOne`, `getMessages` handlers
- `apps/gateway/src/routes/conversations/index.ts` — 3 GET routes with `validateParams` + `validateQuery`
- `libs/messaging/src/__tests__/conversation.service.test.ts` — 17 unit tests
- `apps/gateway/src/controllers/conversations/__tests__/conversations.controller.test.ts` — 20 integration tests

**Decision Log:**
- `unreadCount` is always 0 until MSG-004 (read receipts) — noted in code and STANDARDS.md
- Authorization uses a lightweight Prisma query (only match IDs) for `getConversationMessages`, not the full participant include (performance)
- All existing createApp()-based controller tests updated with messaging mock to prevent module resolution issues
- `convId` validated as UUID at route level via `validateParams(convIdParamsSchema)` — controller receives guaranteed-valid UUIDs

**Key files (to create):**
- `apps/gateway/src/controllers/messaging/messaging.controller.ts`
- `apps/gateway/src/routes/messaging/index.ts`
- `apps/gateway/src/schemas/messaging/`
- `libs/messaging/src/conversation.service.ts`

---

### MSG-002 · Send message (text / image / voice) ✅
**Story:** As a matched user, I can send a text, image, or voice message to my match.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /api/v1/conversations/:convId/messages` — send message
  - Body: `{ type: 'TEXT'|'IMAGE'|'VOICE', content: string, durationSeconds?: number }`
  - `content` is text body for TEXT; S3/CloudFront URL for IMAGE and VOICE
  - Backend validates: caller is a participant, conversation is not archived, content not empty
- [x] `GET /api/v1/conversations/:convId/upload-url?type=image|voice&mimeType=...` — get S3 presigned upload URL
  - Returns: `{ uploadUrl, fileUrl }` (uploadUrl = S3 presigned PUT, fileUrl = CloudFront delivery URL)
  - Flutter uploads direct to S3, then sends POST /messages with fileUrl as content
- [x] On message send, backend writes to Firestore via MessagingAdapter (batch write already in `sendMessage`)
- [x] If Firebase is configured and recipient is offline (check Realtime DB presence) → send FCM push (best-effort)
- [x] Postgres `messages` row inserted (audit record — empty content for IMAGE/VOICE, URL in mediaUrl)
- [x] Returns `MessageDto` with Firestore doc ID
- [x] 400 if type is SYSTEM/invalid, content is empty, or mimeType not allowed (image: jpeg/png/webp; voice: m4a/webm)
- [x] 403 if caller is not a participant
- [x] 404 if conversation does not exist
- [x] 409 if conversation is archived

**FCM push payload:**
```json
{
  "title": "<senderName>",
  "body": "Sent you a photo" | "Sent you a voice message" | "<text preview>",
  "data": { "type": "new_message", "convId": "...", "msgId": "..." }
}
```

**Key files:**
- `libs/messaging/src/send-message.service.ts` — `sendMessage()`, `getUploadUrl()`, `ConversationArchivedError`, `assertParticipantActive()`, `trySendFcmPush()`
- `libs/storage/src/adapters/base.storage.adapter.ts` — `getPresignedUploadUrl()` added to interface
- `libs/storage/src/adapters/s3.storage.adapter.ts` — S3 implementation using `@aws-sdk/s3-request-presigner`
- `libs/storage/src/adapters/mock.storage.adapter.ts` — mock implementation (returns fake URLs)
- `apps/gateway/src/schemas/conversations/send-message.schema.ts` — `sendMessageBodySchema`, `uploadUrlQuerySchema` (with cross-field superRefine)
- `apps/gateway/src/constants/messaging.constants.ts` — `CONVERSATION_ARCHIVED` error, `MESSAGE_SENT` + `UPLOAD_URL_GENERATED` messages
- `apps/gateway/src/controllers/conversations/conversations.controller.ts` — `sendMessage` + `getUploadUrl` handlers added
- `apps/gateway/src/routes/conversations/index.ts` — `POST /:convId/messages` + `GET /:convId/upload-url`
- `libs/messaging/src/__tests__/send-message.service.test.ts` — 18 unit tests
- `apps/gateway/src/controllers/conversations/__tests__/send-message.controller.test.ts` — 26 integration tests

**Decision Log:**
- **Presigned URL on StorageAdapter**: Added `getPresignedUploadUrl(key, mimeType, expiresInSeconds)` to the interface to keep the adapter pattern consistent — MockStorageAdapter returns deterministic fake URLs for tests
- **Upload URL expiry**: 15 minutes (900s) — standard balance between usability and security
- **FCM push is best-effort**: `trySendFcmPush()` wraps all Firebase calls in try/catch and logs a warning on failure — message delivery never blocked by push failures
- **Postgres audit row uses same Firestore doc ID**: UUID generated by the adapter's `sendMessage()`, returned as `dto.id`, then inserted as `Message.id` — one source of truth, enables cross-database queries
- **IMAGE/VOICE Postgres storage**: `content = ''`, URL in `mediaUrl` — keeps Postgres row lightweight; Firestore has full message including mediaUrl in `content` field for Flutter display
- **SYSTEM type blocked at schema level**: `sendMessageBodySchema` rejects `SYSTEM` via `.refine()` — system messages are backend-only

---

### MSG-003 · Real-time (Flutter direct Firestore) ✅
**Story:** As a Flutter developer, I have clear documentation of all direct Firestore interactions so the app team can implement real-time features without backend changes.

**Note:** This is primarily a Flutter-side implementation. Backend role is minimal (Firebase custom token).

**Acceptance Criteria:**
- [x] `GET /api/v1/auth/firebase-token` — endpoint mints a Firebase custom auth token for the authenticated user
  - Uses `firebaseAdmin.auth().createCustomToken(userId)`
  - Flutter uses this token to call `FirebaseAuth.signInWithCustomToken()`
  - Token has 1-hour TTL; Flutter refreshes before expiry
  - 503 when Firebase credentials are absent (dev/CI)
- [x] Firestore security rules documented in `docs/firestore-security-rules.md`
  - Flutter read-only access to `conversations/{convId}/messages/{msgId}`
  - All writes go through REST API (Admin SDK bypasses rules)
  - `flagCount` and `isHidden` are READ-ONLY from client
  - Presence via Realtime Database (not Firestore)
- [x] `getFirebaseAuth()` added to `libs/firebase`
- [x] `createFirebaseToken()` service in `libs/messaging`
- [x] `FirebaseNotConfiguredError` → 503 in controller

**Key files:**
- `libs/firebase/src/firebase.ts` — `getFirebaseAuth()`
- `libs/messaging/src/firebase-token.service.ts` — `createFirebaseToken()`
- `apps/gateway/src/controllers/auth/firebase-token.controller.ts`
- `apps/gateway/src/routes/auth/index.ts` — `GET /firebase-token`
- `docs/firestore-security-rules.md`
- `libs/messaging/src/__tests__/firebase-token.service.test.ts` — 4 tests
- `apps/gateway/src/controllers/auth/__tests__/firebase-token.controller.test.ts` — 4 tests

---

### MSG-004 · Read receipts ✅
**Story:** As a message sender, I see when my message has been read (single grey tick → double blue tick).

**Acceptance Criteria:**
- [x] `POST /api/v1/conversations/:convId/read` — REST fallback for marking read
  - Body: `{ lastReadMessageId: UUID }` — marks message as read in Firestore + mirrors to Postgres
  - 404 if conversation or message not found
  - 403 if caller is not a participant
- [x] `markConversationRead()` service verifies participant authorization before marking
- [x] Postgres `messages.readAt` updated for audit trail
- [x] `MessageNotFoundForReadError` error class for clear error handling

**Key files:**
- `libs/messaging/src/read-receipt.service.ts` — `markConversationRead()`
- `apps/gateway/src/schemas/conversations/read-receipt.schema.ts`
- `apps/gateway/src/controllers/conversations/conversations.controller.ts` — `markRead` handler added
- `apps/gateway/src/routes/conversations/index.ts` — `POST /:convId/read`
- `libs/messaging/src/__tests__/read-receipt.service.test.ts` — 9 tests
- `apps/gateway/src/controllers/conversations/__tests__/read-receipt.controller.test.ts` — 8 tests

**Decision Log:**
- REST fallback only (not direct Firestore write from client) — keeps authorization server-side
- `updateMany` with `readAt: null` condition prevents double-stamping already-read messages

---

### MSG-005 · Message flagging + reporting ✅
**Story:** As a user, I can flag an inappropriate message and optionally add a report with details. As an admin, I can see all flagged messages, the total flags per user, and take moderation action.

**Architecture note:** Flags are Postgres records (audit trail, admin SQL queries). Firestore `flagCount` is a denormalised counter for client-side auto-hide (no admin query needed on Firestore).

**Acceptance Criteria:**

*Flagging flow (user):*
- [x] `POST /api/v1/messages/:msgId/flag` — flag a message
  - Body: `{ reason: FlagReason, description?: string }`
  - Creates Postgres `flags` record with `targetEntityType: 'message'`
  - Atomically increments Firestore `flagCount` via `incrementFlagCount()`
  - Auto-hides message at `flagCount >= 3` (mirrors to Postgres)
  - 404 if message not found; 409 if already flagged or self-flag
- [x] `FlagSelfError`, `AlreadyFlaggedError`, `MessageNotFoundError` error classes

*Admin flag management:*
- [x] `GET /admin/users/:userId/flags?page=1&limit=20` — paginated flag list (MODERATOR+)
- [x] `PUT /admin/flags/:flagId` — resolve/dismiss a flag (MODERATOR+)
  - If `actionTaken = MESSAGE_REMOVED`: hides message in Firestore + Postgres
  - If `status = DISMISSED` + no other open flags: unhides message in Firestore + Postgres
  - 404 if flag not found

**Key files:**
- `libs/messaging/src/flag-message.service.ts` — `flagMessage()`, `getAdminFlagSummary()`, `resolveFlag()`
- `apps/gateway/src/schemas/messages/flag.schema.ts` — `flagMessageBodySchema`
- `apps/gateway/src/schemas/admin/resolve-flag.schema.ts` — `resolveFlagBodySchema`, `adminFlagsQuerySchema`
- `apps/gateway/src/controllers/messages/messages.controller.ts` — `flagMessage` handler
- `apps/gateway/src/controllers/admin/flags.controller.ts` — `listByUser`, `resolve` handlers
- `apps/gateway/src/routes/messages/index.ts` — `POST /:msgId/flag`
- `apps/gateway/src/routes/admin/index.ts` — flag moderation routes added
- `apps/gateway/src/constants/flag.constants.ts`
- `libs/messaging/src/__tests__/flag-message.service.test.ts` — 20 tests
- `apps/gateway/src/controllers/messages/__tests__/flag.controller.test.ts` — 11 tests
- `apps/gateway/src/controllers/admin/__tests__/flags.controller.test.ts` — 11 tests

**Decision Log:**
- Firestore operations in `flagMessage()` and `resolveFlag()` are non-fatal (catch + log) — message flag record is the source of truth; Firestore update failure doesn't block the response
- `unhideMessage` only called when ALL remaining open flags for that message are gone (not just the flag being dismissed)
- `FlagReason` and `FlagAction` duplicated to `libs/shared` enums so gateway schemas have no Prisma dependency

---

## PHASE 6 — Notifications

### NOTIF-001 · Brevo Email Adapter ✅
**Story:** As the platform, I send transactional emails via Brevo.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `EmailAdapter` interface with `send(EmailPayload): Promise<void>`
- [x] `BrevoEmailAdapter` calls `POST https://api.brevo.com/v3/smtp/email` with `api-key` header (Node 22 native `fetch` — no new package)
- [x] `MockEmailAdapter` logs, no network, tracks `sent[]` for assertions
- [x] `getEmailAdapter()` factory: returns Brevo when `BREVO_API_KEY` set, Mock otherwise
- [x] `BREVO_FROM_EMAIL` + `BREVO_FROM_NAME` configurable (already in env schema)
- [x] Non-2xx response throws descriptive error
- [x] Tests: happy path, non-2xx error, network error, mock adapter, factory singleton + fallback

**Key files:**
- `libs/notification/src/adapters/email/base.email.adapter.ts`
- `libs/notification/src/adapters/email/brevo.email.adapter.ts`
- `libs/notification/src/adapters/email/mock.email.adapter.ts`
- `libs/notification/src/adapters/email/index.ts` — `getEmailAdapter()` factory + `_resetEmailAdapter()`

---

### NOTIF-002 · Twilio SMS Adapter ✅
**Story:** As the platform, I send SMS notifications via Twilio Programmable SMS.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `SmsAdapter` interface with `send(SmsPayload): Promise<void>`
- [x] `TwilioSmsAdapter` calls `client.messages.create()` (Programmable Messaging, distinct from Twilio Verify OTP)
- [x] `MockSmsAdapter` logs, no network, tracks `sent[]`
- [x] `getSmsAdapter()` factory: returns Twilio when `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_NUMBER` set
- [x] `TWILIO_PHONE_NUMBER` added to env schema + `.env.example`
- [x] Phone number masked in logs (`slice(0,6)+'****'`)
- [x] Tests: happy path, Twilio error, mock adapter, factory singleton + fallback

**Key files:**
- `libs/notification/src/adapters/sms/base.sms.adapter.ts`
- `libs/notification/src/adapters/sms/twilio.sms.adapter.ts`
- `libs/notification/src/adapters/sms/mock.sms.adapter.ts`
- `libs/notification/src/adapters/sms/index.ts` — `getSmsAdapter()` factory + `_resetSmsAdapter()`
- `libs/config/src/env.ts` — `TWILIO_PHONE_NUMBER` added

---

### NOTIF-003 · Firebase Push Adapter ✅
**Story:** As the platform, I send push notifications to mobile devices via Firebase Admin SDK.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `PushAdapter` interface with `send(PushPayload): Promise<void>`
- [x] `FirebasePushAdapter` calls `getFirebaseMessaging().send()` — uses `libs/firebase` singleton
- [x] `MockPushAdapter` logs, no network, tracks `sent[]`
- [x] `getPushAdapter()` factory: returns Firebase when `isFirebaseConfigured()`, Mock otherwise
- [x] FCM token masked in logs
- [x] Optional `data` field passed through to FCM message; omitted when not provided
- [x] Tests: mock adapter, factory fallback, Firebase dispatch (mocked FCM), error propagation

**Key files:**
- `libs/notification/src/adapters/push/base.push.adapter.ts`
- `libs/notification/src/adapters/push/firebase.push.adapter.ts`
- `libs/notification/src/adapters/push/mock.push.adapter.ts`
- `libs/notification/src/adapters/push/index.ts` — `getPushAdapter()` factory + `_resetPushAdapter()`

---

### NOTIF-004 · Notification Worker ✅
**Story:** As the platform, I process notification jobs from the BullMQ queue and dispatch via the right channel.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `processNotification(job)` — pure dispatch function (exported for unit-test isolation)
- [x] Switches on `NotificationType.EMAIL | SMS | PUSH` → correct adapter
- [x] `createNotificationWorker(redisUrl)` — BullMQ Worker on `QUEUE_NAMES.NOTIFICATION` queue, `concurrency: 5`
- [x] `enqueueNotification(redisUrl, job)` — adds job with `attempts: 3`, exponential backoff 5s
- [x] `removeOnComplete: { count: 1000 }`, `removeOnFail: { count: 500 }` to prevent queue bloat
- [x] Worker started in `apps/gateway/src/server.ts` lifecycle; closed on shutdown
- [x] `@abroad-matrimony/notification` path alias added to `jest.preset.js`
- [x] Tests: EMAIL/SMS/PUSH dispatch, error propagation for each type

**Key files:**
- `libs/notification/src/notification.worker.ts` — `processNotification`, `createNotificationWorker`, `enqueueNotification`
- `libs/notification/src/types/notification.types.ts` — `NotificationType`, `EmailPayload`, `SmsPayload`, `PushPayload`, `NotificationJobData`
- `libs/notification/src/index.ts` — barrel
- `libs/notification/package.json`
- `libs/notification/jest.config.ts`
- `apps/gateway/src/server.ts` — notification worker wired into lifecycle
- `jest.preset.js` — `@abroad-matrimony/notification` mapper added

---

## PHASE 7 — Payments ✅
**Completed:** 2026-05-28 | **Tests:** ~786 total, 58 suites

---

### PAY-001 · Stripe Checkout — Founding Member Plan ✅
**Story:** As a user, I initiate a Stripe Checkout session for the Founding Member subscription so I can pay and unlock full access.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /api/v1/payment/stripe/checkout` requires `requireAuth`
- [x] Creates a Stripe Checkout session in `subscription` mode using `STRIPE_FOUNDING_MEMBER_PRICE_ID`
- [x] Inserts a `PaymentIntent` row with `status: PENDING`, `provider: STRIPE`, `userId`
- [x] Returns `{ checkoutUrl, sessionId }`
- [x] Returns 400 if `STRIPE_FOUNDING_MEMBER_PRICE_ID` not configured
- [x] Returns 500 on Stripe API failure
- [x] Unit tests + integration tests pass

**Implementation Subtasks:**
- [x] `libs/payment/package.json` — `@abroad-matrimony/payment` lib with stripe + razorpay deps
- [x] `libs/payment/src/types/payment.types.ts` — DTOs and types
- [x] `libs/payment/src/adapters/base.payment.adapter.ts` — `PaymentAdapter` interface
- [x] `libs/payment/src/adapters/stripe/stripe.payment.adapter.ts` — Stripe impl (API v2024-06-20)
- [x] `libs/payment/src/adapters/mock/mock.payment.adapter.ts` — deterministic test data
- [x] `libs/payment/src/adapters/index.ts` — lazy singletons, `getStripeAdapter()`, `_resetPaymentAdapters()`
- [x] `libs/payment/src/checkout.service.ts` — `createMembershipCheckout()`
- [x] `apps/gateway/src/schemas/payment/stripe-checkout.schema.ts`
- [x] `apps/gateway/src/controllers/payment/stripe.controller.ts`
- [x] `apps/gateway/src/routes/payment/index.ts` — payment router
- [x] `apps/gateway/src/routes/index.ts` — register `/api/v1/payment`
- [x] `apps/gateway/src/constants/payment.constants.ts` — `PAYMENT_ERRORS`, `PAYMENT_MESSAGES`
- [x] `libs/config/src/env.ts` — `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`, `STRIPE_FOUNDING_MEMBER_PRICE_ID`
- [x] `.env.example` — all new payment env vars documented
- [x] `root/package.json` — `stripe: ^16.0.0` added
- [x] `jest.preset.js` — `@abroad-matrimony/payment` moduleNameMapper entry
- [x] All 14 existing gateway test files — `@abroad-matrimony/payment` mock added

---

### PAY-002 · Stripe Webhook Handler ✅
**Story:** As the platform, I receive Stripe webhook events and update membership/payment state accordingly.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /api/v1/payment/stripe/webhook` parses raw body (no `express.json()` wrapper)
- [x] Verifies `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET`
- [x] `checkout.session.completed` → activates membership + publishes `membership.activated` + `payment.succeeded` events
- [x] `invoice.payment_failed` → marks membership PAST_DUE, publishes `payment.failed`
- [x] `customer.subscription.deleted` → cancels membership
- [x] Diamond purchase session → credits diamonds via ledger INSERT
- [x] Returns `200 { received: true }` on success; 400 on invalid signature; 500 on handler error
- [x] `express.raw()` mounted before `express.json()` for webhook paths

**Implementation Subtasks:**
- [x] `apps/gateway/src/app.ts` — `express.raw()` before `express.json()` for both webhook paths
- [x] `libs/payment/src/webhook.service.ts` — `processStripeWebhook()` dispatcher
- [x] `libs/payment/src/__tests__/webhook.service.test.ts` — 6 Stripe tests

---

### PAY-003 · Razorpay Order + Payment Capture ✅
**Story:** As a user in India, I create a Razorpay order and capture payment after the Flutter Razorpay SDK completes the payment.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /api/v1/payment/razorpay/order` — creates order, inserts `PaymentIntent` PENDING, returns `{ orderId, amount, currency, keyId }`
- [x] `POST /api/v1/payment/razorpay/capture` — verifies HMAC-SHA256 signature, marks `PaymentIntent` SUCCEEDED
- [x] `PaymentSignatureError` → 400; `PaymentNotFoundError` → 404
- [x] Signature = HMAC-SHA256 of `{orderId}|{paymentId}` using Razorpay key secret

**Implementation Subtasks:**
- [x] `libs/payment/src/adapters/razorpay/razorpay.payment.adapter.ts` — Razorpay impl
- [x] `libs/payment/src/adapters/index.ts` — `getRazorpayAdapter()`
- [x] `libs/payment/src/checkout.service.ts` — `createRazorpayMembershipOrder()`, `captureRazorpayPayment()`
- [x] `root/package.json` — `razorpay: ^2.9.2` added
- [x] `apps/gateway/src/schemas/payment/razorpay-order.schema.ts`
- [x] `apps/gateway/src/schemas/payment/razorpay-capture.schema.ts`
- [x] `apps/gateway/src/controllers/payment/razorpay.controller.ts`

---

### PAY-004 · Razorpay Webhook Handler ✅
**Story:** As the platform, I receive Razorpay webhook events and update payment/membership state.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /api/v1/payment/razorpay/webhook` verifies `X-Razorpay-Signature` using `RAZORPAY_WEBHOOK_SECRET` (HMAC-SHA256 of raw body)
- [x] `payment.captured` → activates membership / credits diamonds + publishes events
- [x] `payment.failed` → marks `PaymentIntent` FAILED + publishes `payment.failed`
- [x] `express.raw()` middleware handles raw body for signature verification

**Implementation Subtasks:**
- [x] `libs/payment/src/webhook.service.ts` — `processRazorpayWebhook()` dispatcher
- [x] `libs/payment/src/__tests__/webhook.service.test.ts` — 2 Razorpay tests

---

### PAY-005 · Membership Activation ✅
**Story:** As a user, my membership is activated after a successful payment so I get Founding Member access.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `GET /api/v1/payment/membership` returns active membership DTO or `null`
- [x] `activateMembership()` upserts on `providerSubId` (Stripe) or creates new row (Razorpay)
- [x] Elevates `user.role` to `UserRole.FOUNDING_MEMBER` for `FOUNDING_MEMBER` plan
- [x] `cancelMembership(providerSubId)` → sets status CANCELLED
- [x] `markMembershipPastDue(providerSubId)` → sets status PAST_DUE
- [x] `MembershipDto` returned with id, userId, plan, status, provider, providerSubId, dates

**Implementation Subtasks:**
- [x] `libs/payment/src/membership.service.ts` — `activateMembership()`, `getActiveMembership()`, `cancelMembership()`, `markMembershipPastDue()`
- [x] `libs/payment/src/__tests__/membership.service.test.ts` — 8 tests
- [x] `apps/gateway/src/controllers/payment/membership.controller.ts`

---

### PAY-006 · Diamond Credit Purchase + Ledger INSERT ✅
**Story:** As a Founding Member, I purchase a diamond package via Stripe so I can unlock features.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /api/v1/payment/diamonds/purchase` — creates Stripe Checkout session in `payment` mode
- [x] Package key validated against `DIAMOND_PACKAGES` — throws `InvalidDiamondPackageError` (400) for unknown keys
- [x] `creditDiamonds()` appends a `DiamondLedger` row in a `$transaction`; returns `balanceAfter`
- [x] Throws when `delta <= 0`

**DIAMOND_PACKAGES:**
- `DIAMONDS_50`: 50 diamonds, ₹499 (49900 paise)
- `DIAMONDS_100`: 100 diamonds, ₹899 (89900 paise)
- `DIAMONDS_200`: 200 diamonds, ₹1499 (149900 paise)

**Implementation Subtasks:**
- [x] `libs/payment/src/diamond.service.ts` — `DIAMOND_PACKAGES`, `getDiamondBalance()`, `creditDiamonds()`
- [x] `libs/payment/src/__tests__/diamond.service.test.ts` — 10 tests
- [x] `libs/payment/src/checkout.service.ts` — `createDiamondCheckout()`
- [x] `apps/gateway/src/schemas/payment/diamond-purchase.schema.ts`
- [x] `apps/gateway/src/controllers/payment/diamond.controller.ts`

---

### PAY-007 · Diamond Spend + Balance Check ✅
**Story:** As a user, I spend diamonds to unlock features and see my current balance.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `GET /api/v1/payment/diamonds/balance` — returns `{ balance: number }`
- [x] `POST /api/v1/payment/diamonds/spend` — spends diamonds, returns new balance
- [x] `InsufficientDiamondsError` → 402 Payment Required
- [x] `spendDiamonds()` appends negative `DiamondLedger` row in `$transaction`; throws if balance insufficient
- [x] Throws when `amount <= 0`

**Implementation Subtasks:**
- [x] `libs/payment/src/diamond.service.ts` — `spendDiamonds()`
- [x] `apps/gateway/src/schemas/payment/diamond-spend.schema.ts` — `DiamondReason` enum validation

---

### PAY-008 · Refund Handling + Ledger Reversal ✅
**Story:** As an admin, I can refund a payment and reverse diamond credits when needed.
**Completed:** 2026-05-28

**Acceptance Criteria:**
- [x] `POST /admin/payment/refund` — requires `AdminRole.SUPERADMIN`
- [x] `markPaymentRefunded(providerPaymentId)` — sets `PaymentIntent` status to REFUNDED
- [x] `refundDiamonds(userId, amount)` — credits back diamonds with `DiamondReason.REFUND`
- [x] `PaymentNotFoundError` → 404
- [x] Admin route wired with `auditLog()` middleware

**Implementation Subtasks:**
- [x] `libs/payment/src/checkout.service.ts` — `markPaymentRefunded()`
- [x] `libs/payment/src/diamond.service.ts` — `refundDiamonds()`
- [x] `apps/gateway/src/schemas/payment/admin-refund.schema.ts`
- [x] `apps/gateway/src/controllers/admin/payment-admin.controller.ts`
- [x] `apps/gateway/src/routes/admin/index.ts` — `POST /admin/payment/refund`

**Decision Log:**
- **ADR-011 added:** Raw body middleware mounted before `express.json()` for Stripe/Razorpay webhook paths to preserve signature-verifiable body. See `apps/gateway/src/app.ts`.
- **Dynamic require for Stripe/Razorpay adapters:** Adapter factories use `require()` inside functions (not top-level `import`) so Jest tests never load the real SDKs. Packages added to root `package.json` — user must run `npm install --legacy-peer-deps`.
- **Append-only diamond ledger** (ADR-006 confirmed): No `UPDATE` to balance column; all writes are INSERTs using `$transaction`. Current balance = latest `balanceAfter` row.

---

---

## PHASE 8e — Admin API + Analytics
> **Scope updated:** 2026-05-29 — expanded to include all Phase 8 admin workflows (GroupProposal, IntroductionDrop, SystemConfig, seeder monitoring, AI/ProfileEmbedding monitoring, and new analytics dimensions).
> **App:** `apps/admin-api` (port 3001). All routes under `/admin/...`. All require `requireAdminRole()`.
> **Implementation order:** after Phase 8a data exists so dashboards are meaningful.

---

### ADMIN-001 · Admin Login ⏳
**Story:** Admin users log in with email + bcrypt password; optionally TOTP for SUPERADMIN.
**Status:** AUTH-006 already complete in `apps/gateway`. This task wires the standalone `apps/admin-api` app with the same auth logic.

**Acceptance Criteria:**
- [ ] `POST /admin/auth/login` — `{ email, password, totpCode? }` → `{ accessToken, adminUser }`
- [ ] Uses `adminLoginService()` from `libs/auth`; returns 401 on bad credentials, 403 on TOTP required/invalid
- [ ] Access token issued with `adminRole` claim; short TTL (8h)
- [ ] `POST /admin/auth/logout` — revokes current session token
- [ ] All admin routes reject requests without valid admin JWT

---

### ADMIN-002 · User Management ⏳
**Story:** As an admin, I can search, view, suspend, and ban users; wipe seeded data for clean resets.

**Acceptance Criteria:**
- [ ] `GET /admin/users?search=&status=&limit=20&cursor=` — paginated user list with profile + verification status
- [ ] `GET /admin/users/:userId` — full user detail (profile, devices, membership, verification, flags)
- [ ] `PUT /admin/users/:userId/suspend` — `{ reason, durationDays? }` → sets `user.status = SUSPENDED`; notifies via notification worker
- [ ] `PUT /admin/users/:userId/unsuspend` — restores user to ACTIVE
- [ ] `PUT /admin/users/:userId/ban` — `{ reason }` → sets `user.status = BANNED`; revokes all tokens (`revokeAllForUser`)
- [ ] `DELETE /admin/users/:userId/seeded` — deletes all records where `isSeeded = true` for that userId (profile, posts, connections, etc.)
- [ ] Requires MODERATOR or above for suspend/unsuspend; SUPERADMIN only for ban and wipe
- [ ] All actions write to `audit_logs` table

---

### ADMIN-003 · Feature Flag Toggle ⏳
**Story:** As an admin, I toggle feature flags on/off and set rollout percentages without a deployment.

**Acceptance Criteria:**
- [ ] `GET /admin/feature-flags` — list all flags with current value, rollout %, environment allowlist
- [ ] `GET /admin/feature-flags/:flagKey` — single flag detail
- [ ] `PUT /admin/feature-flags/:flagKey` — `{ enabled, rolloutPct?, userAllowlist?, envAllowlist? }` → updates DB + invalidates Redis cache
- [ ] `POST /admin/feature-flags` — create new flag (SUPERADMIN only)
- [ ] `DELETE /admin/feature-flags/:flagKey` — delete flag (SUPERADMIN only)
- [ ] Cache invalidation: delete `feature_flag:<flagKey>` from Redis on any mutation
- [ ] Returns 404 if flag not found

---

### ADMIN-004 · Verification Review Queue ⏳
**Story:** As a moderator, I review submitted ID documents and selfies, then approve or reject each submission.

**Acceptance Criteria:**
- [ ] `GET /admin/verification/queue?status=PENDING_REVIEW|APPROVED|REJECTED&limit=20&cursor=` — paginated
- [ ] Each item: `{ submissionId, userId, userName, idType, idFrontUrl, idBackUrl?, selfieUrl, submittedAt }`
- [ ] `PUT /admin/verification/:submissionId` — `{ action: "APPROVE"|"REJECT", reason? }`
  - On APPROVE: sets `Verification.status = APPROVED`, recalculates `TrustScore`, enqueues notification
  - On REJECT: sets `Verification.status = REJECTED`, enqueues notification with reason
- [ ] Requires MODERATOR role minimum
- [ ] 404 if submission not found; 409 if already actioned

---

### ADMIN-005 · Audit Log Viewer ⏳
**Story:** As a SUPERADMIN, I view a tamper-evident log of all admin actions for compliance.

**Acceptance Criteria:**
- [ ] `GET /admin/audit-logs?adminId=&action=&entityType=&from=&to=&limit=50&cursor=` — filterable, paginated
- [ ] Each entry: `{ id, adminId, adminEmail, action, entityType, entityId, metadata, createdAt }`
- [ ] Read-only — no mutations on audit log
- [ ] Requires SUPERADMIN role
- [ ] Entries written by all mutation endpoints via `auditLog(adminId, action, entityType, entityId, metadata)`

---

### ADMIN-006 · Moderation Queue ⏳
**Story:** As a moderator, I review flagged messages, hide harmful content, and resolve flags.

**Acceptance Criteria:**
- [ ] `GET /admin/moderation/flags?status=OPEN|RESOLVED|DISMISSED&limit=20&cursor=` — paginated flag queue
- [ ] Each item includes: flagId, reason, reporterUserId, targetUserId, messageSummary, flagCount, createdAt
- [ ] `GET /admin/moderation/flags/:flagId` — detail with full message content + flag history
- [ ] `PUT /admin/moderation/flags/:flagId/resolve` — `{ action: "WARN"|"HIDE"|"DISMISS"|"BAN_USER"|"DELETE_MESSAGE", note? }`
  - HIDE: calls `messagingAdapter.hideMessage(firestoreMsgId)`, sets `Message.isHidden = true`
  - DELETE_MESSAGE: calls `messagingAdapter.deleteMessage(firestoreMsgId)` (hard delete from Firestore)
  - BAN_USER: delegates to ADMIN-002 ban flow
  - Sets `Flag.status = RESOLVED`, `Flag.actionTaken`, writes audit log
- [ ] `POST /admin/moderation/flags/:flagId/dismiss` — sets status DISMISSED, audit logged
- [ ] Requires MODERATOR role minimum; BAN_USER action requires SUPERADMIN

---

### ADMIN-007 · Core KPI Dashboard ⏳
**Story:** As an admin, I see daily KPI metrics covering engagement, conversion, and platform health.

**Acceptance Criteria:**
- [ ] `GET /admin/analytics/kpi?from=&to=` — returns:
  - DAU / WAU / MAU (from profile activity)
  - New registrations per day
  - Profile completion rate (avg completionScore)
  - Connection funnel: requests sent → accepted → first message sent
  - Membership conversion rate (free → Founding Member)
  - Diamond spend volume (total paise per period)
  - Avg match score across all active users
- [ ] `GET /admin/analytics/cohort?from=&to=&granularity=day|week` — retention cohort (D1, D7, D30)
- [ ] All values are aggregated counts/averages; no raw PII returned
- [ ] Requires MODERATOR or above

---

### ADMIN-008 · Event Management ⏳
**Story:** As an admin, I create, update, and cancel gatherings that users can RSVP to.

**Acceptance Criteria:**
- [ ] `POST /admin/events` — `{ title, description, eventType, location?, virtualUrl?, startsAt, endsAt, groupId?, maxAttendees?, tags[] }`
- [ ] `PUT /admin/events/:eventId` — update any field; cannot change `startsAt` within 24h of event
- [ ] `DELETE /admin/events/:eventId` — cancels event; enqueues cancellation notification to all RSVPs
- [ ] `GET /admin/events?status=UPCOMING|LIVE|PAST&limit=20&cursor=` — paginated list with RSVP count
- [ ] `GET /admin/events/:eventId/attendees` — list of attendees (userId, name, rsvpAt)
- [ ] Requires MODERATOR role minimum
- [ ] Auto-creates SCHEDULED IntroductionDrop 72h before event (links to IDROP-001, Phase 8d)

---

### ADMIN-009 · Weekly Prompt Management ⏳
**Story:** As an admin, I create, schedule, and close weekly community prompts.

**Acceptance Criteria:**
- [ ] `POST /admin/prompts` — `{ question, opensAt, closesAt, groupId? }` — creates prompt
- [ ] `PUT /admin/prompts/:promptId` — update question/schedule (only if not yet open)
- [ ] `DELETE /admin/prompts/:promptId` — cancel prompt (only if not yet open); returns 409 if already open
- [ ] `GET /admin/prompts?status=SCHEDULED|OPEN|CLOSED&limit=20&cursor=` — paginated prompt list with response count
- [ ] `GET /admin/prompts/:promptId/responses` — all user responses, paginated, with resonate count per response
- [ ] `DELETE /admin/prompts/responses/:responseId` — moderator removes a response (writes audit log)
- [ ] Requires MODERATOR role minimum

---

### ADMIN-010 · Group Management ⏳
**Story:** As an admin, I provision and manage all four group types, pin/unpin posts, and archive groups.

**Acceptance Criteria:**
- [ ] `POST /admin/groups` — create group of any type: `{ name, type, scope, country?, city?, region, professionTag?, culturalTag?, parentGroupId?, coverImageUrl?, maxSize? }`
  - REGIONAL country-level groups: also triggers auto-join for all existing users from that country
  - Requires SUPERADMIN for REGIONAL/CULTURAL/PROFESSIONAL; MODERATOR sufficient for INTEREST
- [ ] `PUT /admin/groups/:groupId` — update name, description, coverImage, maxSize, isActive
- [ ] `DELETE /admin/groups/:groupId` — archives group (`isActive = false`); notifies all members
- [ ] `GET /admin/groups?type=REGIONAL|CULTURAL|PROFESSIONAL|INTEREST&scope=&country=&limit=20&cursor=` — paginated
- [ ] `GET /admin/groups/:groupId/members` — member list with joinedVia, joinedAt, role
- [ ] `POST /admin/groups/:groupId/posts/:postId/pin` — pins post (`isPinned = true`); unpins previous pinned post
- [ ] `DELETE /admin/groups/:groupId/posts/:postId/pin` — unpins post
- [ ] `DELETE /admin/groups/:groupId/posts/:postId` — moderator removes a post (audit logged)
- [ ] Requires MODERATOR minimum; archive and create require SUPERADMIN

---

### ADMIN-011 · IntroductionDrop Management ⏳
**Story:** As an admin, I approve, adjust, and monitor all introduction drops across all themes.

**Acceptance Criteria:**
- [ ] `GET /admin/introduction-drops?status=DRAFT|PENDING_APPROVAL|SCHEDULED|LIVE|EXPIRED&limit=20&cursor=` — paginated list
- [ ] `GET /admin/introduction-drops/:dropId` — detail: criteria, memberPool size, releaseAt, expiresAt, intro count, early-access stats
- [ ] `PUT /admin/introduction-drops/:dropId/approve` — `{ releaseAt?, expiresAt?, earlyAccessCost?, unlockCost? }` — sets status → SCHEDULED
- [ ] `PUT /admin/introduction-drops/:dropId/reject` — `{ reason }` — sets status back to DRAFT with admin note
- [ ] `PUT /admin/introduction-drops/:dropId/adjust-pool` — `{ addUserIds[], removeUserIds[] }` — mutates memberPool before approval
- [ ] `POST /admin/introduction-drops` — manual admin-created drop: `{ name, criteria, memberPool?, releaseAt, expiresAt, earlyAccessCost, unlockCost }`
- [ ] `GET /admin/introduction-drops/:dropId/introductions` — list all pairings in this drop with accept/decline/early-access stats
- [ ] Requires MODERATOR minimum; manual create/adjust requires SUPERADMIN

---

### ADMIN-012 · AI Proposal Dashboard ⏳
**Story:** As an admin, I review introduction drops that the AI proposed so I can approve, reject, or adjust them before they go live.

**Acceptance Criteria:**
- [ ] `GET /admin/ai-proposals?type=INTRODUCTION_DROP&status=DRAFT&limit=20` — filters `proposedByAI = true`
- [ ] Each item shows: drop name, AI-generated criteria (JSON rendered), proposed memberPool size, AI confidence indicators
- [ ] Quick approve: `PUT /admin/ai-proposals/:dropId/approve` (delegates to ADMIN-011 approve flow)
- [ ] Quick reject: `PUT /admin/ai-proposals/:dropId/reject` (delegates to ADMIN-011 reject flow)
- [ ] Drill-down: `GET /admin/ai-proposals/:dropId/sample-pairings` — shows 3 sample AI-generated pairings with compatibility notes from `ProfileEmbedding.compatibilityNotes`
- [ ] Requires MODERATOR role minimum

---

### ADMIN-013 · GroupProposal Management ⏳
**Story:** As an admin, I review member-submitted proposals for new INTEREST groups, then approve or reject them.

**Acceptance Criteria:**
- [ ] `GET /admin/group-proposals?status=PENDING|APPROVED|REJECTED&limit=20&cursor=` — paginated proposal list
- [ ] Each item: `{ proposalId, proposedBy: { userId, name }, name, description, type, country?, rationale, status, createdAt }`
- [ ] `GET /admin/group-proposals/:proposalId` — detail view with proposer profile link
- [ ] `PUT /admin/group-proposals/:proposalId/approve` — `{ name?, description? }` (admin can tweak before approval)
  - Creates new `Group` (type: INTEREST, isActive: true), proposer auto-joined with `joinedVia: AUTO`
  - Sets `GroupProposal.status = APPROVED`, stamps `reviewedByAdminId`, `reviewedAt`
  - Enqueues notification to proposer ("Your group was approved!")
- [ ] `PUT /admin/group-proposals/:proposalId/reject` — `{ reason }` — sets REJECTED, notifies proposer
- [ ] 404 if proposal not found; 409 if already actioned
- [ ] Requires MODERATOR role minimum

---

### ADMIN-014 · SystemConfig Management ⏳
**Story:** As an admin, I view and update system-wide configuration values without a deployment.

**Acceptance Criteria:**
- [ ] `GET /admin/system-config` — list all key-value pairs with descriptions
- [ ] `GET /admin/system-config/:key` — single entry
- [ ] `PUT /admin/system-config/:key` — `{ value }` — updates value; validates type where schema is known
  - Known keys with type validation: `SUGGESTED_GROUPS_MAX` (integer 1–50), `DRIP_BATCH_SIZE` (integer 1–20), `DRIP_WINDOW_HOURS` (integer 1–24), `INTRO_DROP_AI_POOL_SIZE` (integer 3–10)
- [ ] `POST /admin/system-config` — create new key (SUPERADMIN only); key must be UPPER_SNAKE_CASE
- [ ] `DELETE /admin/system-config/:key` — delete key (SUPERADMIN only); 409 if key is a known system-critical key
- [ ] All mutations write audit log and invalidate any cached read of that key
- [ ] Requires MODERATOR for reads/updates; SUPERADMIN for create/delete

---

### ADMIN-015 · Seeder Monitoring ⏳
**Story:** As an admin, I monitor the seeder service status and trigger clean flushes of seeded data during development.

**Acceptance Criteria:**
- [ ] `GET /admin/seeder/status` — returns:
  - `{ running: boolean, lastRunAt?, lastDripAt?, totalSeededUsers, totalSeededProfiles, totalSeededGroups, totalSeededPosts, totalSeededConnections, totalSeededActivities, dripQueueDepth }`
  - Counts computed via `COUNT(*) WHERE isSeeded = true` per entity
- [ ] `POST /admin/seeder/drip` — manually trigger one drip cycle (3–5 new profiles); returns `{ triggered: true, estimatedCompletionMs }`
- [ ] `POST /admin/seeder/flush` — wipes ALL records where `isSeeded = true` across: User, Profile, Group (non-system), GroupPost, GroupMembership, Connection, Introduction, HabitLog, PromptResponse, Gathering, EventAttendee, SavedProfile
  - Runs in a Prisma transaction
  - Returns `{ deleted: { users: N, profiles: N, groups: N, posts: N, ... } }`
  - 409 if seeder is currently running (prevents mid-drip flush)
- [ ] `GET /admin/seeder/logs?limit=50` — last N seeder activity log lines (from Redis list `seeder:log`)
- [ ] Requires SUPERADMIN role — flush is destructive
- [ ] Note: These endpoints call the seeder app's internal API or directly manipulate DB; flush runs in DB, no seeder-app HTTP call needed

---

### ADMIN-016 · AI / ProfileEmbedding Monitoring ⏳
**Story:** As an admin, I see which user profiles have embeddings, which are pending, and trigger re-computation when needed.

**Acceptance Criteria:**
- [ ] `GET /admin/ai/embedding-status` — returns:
  - `{ totalUsers, withEmbedding, pendingEmbedding, failedEmbedding, lastJobRunAt, bullmqQueueDepth }`
  - `withEmbedding`: COUNT of users with a `ProfileEmbedding` row
  - `pendingEmbedding`: users without embedding or with `updatedAt` older than 7 days
  - `failedEmbedding`: count from BullMQ failed jobs in `profile-intelligence` queue
- [ ] `GET /admin/ai/embeddings?status=complete|pending|stale&limit=20&cursor=` — paginated list of users + embedding metadata (no raw vectors)
  - Each item: `{ userId, name, summary?, traitTagCount, vibeScoresPresent, embeddingPresent, updatedAt }`
- [ ] `POST /admin/ai/embeddings/:userId/recompute` — enqueues a fresh profile intelligence BullMQ job for that user; returns `{ jobId, queued: true }`
- [ ] `POST /admin/ai/embeddings/recompute-all-stale` — bulk enqueues recomputation for all users with embedding older than 7 days or missing; returns `{ jobsQueued: N }` (SUPERADMIN only)
- [ ] `GET /admin/ai/queue-health` — BullMQ queue stats: `{ waiting, active, completed, failed, delayed }` for `profile-intelligence` queue
- [ ] Requires MODERATOR for reads; SUPERADMIN for recompute-all

---

### ADMIN-017 · Extended Analytics ⏳
**Story:** As an admin, I see analytics covering the new Phase 8 features — group activity, drop engagement, early access diamond spend, and AI vs admin approval ratios.

**Acceptance Criteria:**
- [ ] `GET /admin/analytics/groups?from=&to=` — returns:
  - New groups created per type (REGIONAL/CULTURAL/PROFESSIONAL/INTEREST) per period
  - Total members per group type
  - Posts + comments + likes per period
  - Group join funnel: suggested → joined (by JoinedVia source)
  - Top 10 most active groups by post count
- [ ] `GET /admin/analytics/drops?from=&to=` — returns:
  - Total drops created (by status: DRAFT/SCHEDULED/LIVE/EXPIRED)
  - AI-proposed vs admin-created ratio
  - Avg pool size, avg pairings per drop
  - Early access conversion: drops with early-access views, conversion to unlock
  - Diamond spend on `INTRO_EARLY_VIEW` + `INTRO_EARLY_UNLOCK` per period (paise)
  - Accept / decline / no-response rates per drop
- [ ] `GET /admin/analytics/ai?from=&to=` — AI pipeline health:
  - AI proposal acceptance rate (approved / (approved + rejected))
  - Avg time from AI DRAFT → admin approval
  - ProfileEmbedding coverage %
  - BullMQ profile-intelligence job success/failure rate
- [ ] `GET /admin/analytics/diamonds?from=&to=` — diamond ledger breakdown by reason:
  - PURCHASE / ADMIN_GRANT / FEATURE_UNLOCK / INTRO_EARLY_VIEW / INTRO_EARLY_UNLOCK / GROUP_CONVERSATION_INITIATION
  - Net spend vs credit per period
- [ ] All endpoints require MODERATOR or above
- [ ] Values are aggregates only — no PII

---

---

## PHASE 5b — Connections + Groups + Verification

### CONN-001 · Send Connection Request ⏳
**Story:** As a user viewing a match or introduction, I send a connection request so we can move toward a deeper conversation.

**Acceptance Criteria:**
- [ ] `POST /api/v1/connections` accepts `{ targetUserId }` with requireAuth
- [ ] Validates target user exists and is not already connected / blocked
- [ ] Max 10 open outgoing requests at a time; returns 409 if exceeded
- [ ] Creates `connection` row with status `PENDING`, publishes `connection.requested` CloudEvent
- [ ] Returns 201 `{ connectionId, status: "PENDING" }`
- [ ] 400 if self-connect; 404 if user not found; 409 if already connected

### CONN-002 · Accept Connection (Reply) ⏳
**Story:** As a user with an incoming request, I reply to accept — optionally with a first message so the conversation has immediate context.

**Acceptance Criteria:**
- [ ] `POST /api/v1/connections/:id/reply` accepts `{ message? }` with requireAuth
- [ ] Only the target (recipient) of the connection can call this
- [ ] Sets status `ACCEPTED`, creates a Firestore conversation if message provided
- [ ] Returns 200 `{ connectionId, status: "ACCEPTED", conversationId? }`
- [ ] 403 if caller is not the recipient; 404 if connection not found; 409 if already accepted

### CONN-003 · Pass (Silent Decline) ⏳
**Story:** As a user, I pass on a connection request without sending a rejection notification.

**Acceptance Criteria:**
- [ ] `POST /api/v1/connections/:id/pass` with requireAuth
- [ ] Only the recipient can pass; sets status `DECLINED`
- [ ] No notification sent to requester (silent)
- [ ] Returns 200 `{ connectionId, status: "DECLINED" }`

### CONN-004 · List Connections by State ⏳
**Story:** As a user, I see my incoming, outgoing, and accepted connections in separate tabs.

**Acceptance Criteria:**
- [ ] `GET /api/v1/connections?type=incoming|outgoing|accepted` with requireAuth
- [ ] Paginated cursor-based, default limit 20
- [ ] Each item includes: other user's name, avatar, contextLabel, timestamp
- [ ] `type` defaults to `incoming` if omitted

### GROUP-001 · Admin: Create Group ⏳
**Story:** As an admin, I create regional groups with expiry dates, member limits, credit costs, and tags.

**Acceptance Criteria:**
- [ ] `POST /admin/groups` — name, description, region, expiresAt, maxMembers, creditCost, tags[]
- [ ] `PUT /admin/groups/:id` — update any field
- [ ] `DELETE /admin/groups/:id` — closes group (sets expiresAt to now)
- [ ] Groups have status: OPEN, FULL, EXPIRED

### GROUP-002 · List Available Groups ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/groups` — all OPEN groups (not user's 2 active ones), sorted by expiresAt ASC
- [ ] Shows: name, memberCount, expiresAt countdown, creditCost, tags[]
- [ ] `GET /api/v1/groups/mine` — user's active groups (max 2)

### GROUP-003 · Join Group with Credits ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/groups/:id/join` — free join if slots available and group not expiring (within 48h)
- [ ] `POST /api/v1/groups/:id/join-early` — spends `group.creditCost` credits for expiring groups
- [ ] Enforces 2-slot limit; returns 409 if both slots full
- [ ] `GET /api/v1/groups/:id/expiry` — returns `{ expiresAt, hoursRemaining, creditCostToJoin }`

### VER-001 · Submit Identity Verification ⏳
**Story:** As a user, I submit my ID document and selfie so an admin can verify my identity.

**Acceptance Criteria:**
- [ ] `POST /api/v1/verification` — multipart: `idType` (PASSPORT|DRIVERS_LICENCE|NATIONAL_ID), `idFront`, `idBack?`, `selfie`
- [ ] Files validated: JPEG/PNG/WebP only, max 10 MB each
- [ ] Uploaded to S3 under `verification/<userId>/<type>-<uuid>.<ext>`
- [ ] Creates `verification_submission` row with status `PENDING_REVIEW`
- [ ] Returns 201 `{ submissionId, status: "PENDING_REVIEW" }`
- [ ] Rate-limit: 3 submissions per user per 24h (prevent spam)

### VER-002 · Admin Verification Queue ⏳
**Acceptance Criteria:**
- [ ] `GET /admin/verification/queue?status=pending|approved|rejected&limit=20` — paginated
- [ ] Each item: userId, idType, idFront (S3 URL), idBack?, selfie, submittedAt
- [ ] Requires MODERATOR role or above

### VER-003 · Admin Approve/Reject Verification ⏳
**Acceptance Criteria:**
- [ ] `PUT /admin/verification/:submissionId` — `{ action: "APPROVE"|"REJECT", reason? }`
- [ ] On APPROVE: sets user's verification layer `face` to verified, recalculates trust score
- [ ] On REJECT: notifies user via notification worker with reason
- [ ] Requires MODERATOR role

---

## PHASE 9 — Habits / Consistency Hub

### HABIT-001 · Habit Management CRUD ⏳
**Story:** As a user, I create and manage a list of personal habits so the app can track my daily consistency.

**Acceptance Criteria:**
- [ ] `POST /api/v1/habits` — name (max 40 chars), icon (emoji or preset key)
- [ ] `GET /api/v1/habits` — list user's habits ordered by createdAt
- [ ] `PUT /api/v1/habits/:id` — rename or change icon
- [ ] `DELETE /api/v1/habits/:id` — soft-delete (logs preserved)
- [ ] Max 10 habits per user; returns 409 if limit reached
- [ ] Requires requireAuth

### HABIT-002 · Daily Habit Logging ⏳
**Story:** As a user, I log that I completed a habit today so my streak is tracked.

**Acceptance Criteria:**
- [ ] `POST /api/v1/habits/:id/log` — body `{ completedAt?: ISO8601 }` (defaults to now)
- [ ] Idempotent — only 1 log per habit per calendar day (UTC); duplicate returns 200 not 201
- [ ] Returns 201 `{ logId, habitId, completedAt, currentStreak }`
- [ ] Streak = consecutive days with a log; broken streak resets to 0

### HABIT-003 · Streak Data & Weekly Dots ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/habits/streaks` — all habits with: currentStreak, longestStreak, thisWeekDots (7-element boolean array Mon–Sun)
- [ ] `GET /api/v1/habits/:id/history?weeks=8` — streak data for bar chart

### HABIT-004 · Weekly Reflection ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/habits/reflection` — generated weekly insight text
- [ ] Rule-based v1: "You are most consistent on [day pattern]. That pattern increases compatibility with users who prefer [style]."
- [ ] Generated once on Monday, cached in Redis for 7 days
- [ ] Includes: `{ insight, whyItMatters, weekStartDate }`

### HABIT-005 · Summary Visibility Toggle ⏳
**Acceptance Criteria:**
- [ ] `PUT /api/v1/habits/summary-visibility` — `{ visible: boolean }`
- [ ] When visible=true: habit summary (consistency score) included in profile viewed by others
- [ ] Default: private (false)

---

## PHASE 10 — Introductions (Weekly Drop)

### INTRO-001 · Weekly Intro Compute Job ⏳
**Story:** Every Sunday at 9 AM GMT, the system curates 5 best-matched profiles per user from their active groups.

**Acceptance Criteria:**
- [ ] BullMQ cron job runs Sunday 09:00 UTC
- [ ] For each active user in a group: fetches top-5 scored profiles from that group
- [ ] Applies filters: not already connected, not blocked, not previously introduced this cycle
- [ ] Stores results in `weekly_introductions` table with `weekOf` date
- [ ] Generates rule-based "Why this match?" text for each intro (top 2-3 dimensions)
- [ ] Publishes `introduction.batch_ready` CloudEvent

### INTRO-002 · Get This Week's Introductions ⏳
**Story:** As a user, I see my curated weekly introductions.

**Acceptance Criteria:**
- [ ] `GET /api/v1/introductions` — returns up to 5 intros for current week
- [ ] Each intro: profile summary, whyThisMatch text, compatibilityScore, compatibilityTags[], isUnlocked
- [ ] If Sunday hasn't happened and user hasn't paid to unlock: `isUnlocked: false`
- [ ] Returns `{ introductions[], weekOf, refreshesAt, unlockedEarlyAt? }`

### INTRO-003 · Introduction Detail ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/introductions/:id` — full match context
- [ ] Includes: compatibilityScore (0–100), dimensions[] (name + score + label), whyThisMatch, profile snapshot
- [ ] 403 if introduction belongs to different user; 404 if not found

### INTRO-004 · Unlock Early ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/introductions/unlock-early` — spends 300 credits
- [ ] Unlocks current week's batch immediately (sets `unlockedEarlyAt`)
- [ ] Idempotent — already unlocked returns 200, no double charge
- [ ] 402 if insufficient credits

### INTRO-005 · Match Context for Profile ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/profiles/:id/match-context` — returns score + dimension breakdown for any profile
- [ ] Dimension response: `[{ name: "Life abroad plan", score: 92, label: "Aligned" }, ...]`
- [ ] Cached in Redis 1 hour; invalidated on profile update

---

## PHASE 11 — Gatherings / Events

### EVENT-001 · Event Management (Admin) ⏳
**Acceptance Criteria:**
- [ ] `POST /admin/events` — title, description, scheduledAt, tags (Virtual|Moderated|FamilySafe), maxAttendees?, meetingUrl?
- [ ] `PUT /admin/events/:id` — update any field
- [ ] `DELETE /admin/events/:id` — cancel event (notifies RSVPs)
- [ ] Requires SUPERADMIN role

### EVENT-002 · List Events ⏳
**Story:** As a user, I see upcoming community gatherings with a personalised "why invited" reason.

**Acceptance Criteria:**
- [ ] `GET /api/v1/events` — upcoming events sorted by scheduledAt ASC
- [ ] Each event includes: title, scheduledAt, attendeeCount, tags[], whyInvited text, hasRsvp
- [ ] `whyInvited` generated from: user's current group region, relocation openness, profile section completeness
- [ ] Filters: `?tag=virtual` `?upcoming=true` `?limit=10`

### EVENT-003 · RSVP ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/events/:id/rsvp` — register attendance
- [ ] `DELETE /api/v1/events/:id/rsvp` — cancel
- [ ] `GET /api/v1/events/calendar` — this week's milestone dates (intro drop Sunday, prompts open, check-ins)
- [ ] RSVP capped at `maxAttendees` if set; returns 409 when full
- [ ] Post-event attendance stored; used by ALG-006 (event co-attendance boost)

---

## PHASE 12 — Weekly Prompts

### PROMPT-001 · Prompt Management (Admin) ⏳
**Acceptance Criteria:**
- [ ] `POST /admin/prompts` — text, opensAt, closesAt (default 7 days)
- [ ] `GET /admin/prompts` — list with: responseCount, resonateCount, chatStartRate
- [ ] `PUT /admin/prompts/:id` — update or reschedule
- [ ] Only one prompt active at a time; returns 409 if another is open

### PROMPT-002 · Get Current Prompt ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/prompts/current` — active prompt text, daysLeft, totalResponses, userHasResponded
- [ ] 404 if no active prompt this week

### PROMPT-003 · Submit Prompt Response ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/prompts/current/response` — `{ type: "text"|"voice", content?: string, voiceUrl?: string }`
- [ ] Voice: S3 URL from pre-signed upload (audio/mpeg or audio/mp4, max 60 seconds)
- [ ] Text: max 500 characters
- [ ] One response per user per prompt; update replaces previous
- [ ] Returns 201 `{ responseId, promptId, type, createdAt }`

### PROMPT-004 · Browse Community Responses ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/prompts/current/responses?limit=20&cursor=` — paginated community answers
- [ ] Each: responder profile summary, responseType, content/voiceUrl, resonateCount, hasResonated, canStartChat
- [ ] Ordered by: resonateCount DESC (break ties by createdAt DESC)

### PROMPT-005 · Resonate + Start Chat ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/prompts/responses/:id/resonate` — soft agreement reaction
- [ ] `DELETE /api/v1/prompts/responses/:id/resonate` — remove
- [ ] Idempotent; cannot resonate own response
- [ ] Resonate creates matching signal (ALG-003 dimension 12)
- [ ] When user taps "Start chat" on a prompt response: opens conversation with prompt answer embedded as `sharedSpark`

---

## PHASE 13 — Saved Profiles

### SAVE-001 · Save Profile ⏳
**Story:** As a user, I save a profile to my private shortlist so I can revisit and compare later.

**Acceptance Criteria:**
- [ ] `POST /api/v1/saved-profiles/:userId` — `{ label?: "HIGH_FIT"|"MAYBE" }` — default no label
- [ ] `DELETE /api/v1/saved-profiles/:userId` — remove from shortlist
- [ ] Max 50 saved profiles; returns 409 if exceeded
- [ ] Cannot save own profile; returns 400
- [ ] `savedAt` stored for "Expiring" label (computed when their group expires soon)

### SAVE-002 · List Saved Profiles ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/saved-profiles` — private list, sorted by savedAt DESC
- [ ] Each: profile snapshot, label, savedAt, groupExpiresAt (for Expiring badge), compatibilityScore
- [ ] `GET /api/v1/saved-profiles/compare?ids=a,b` — side-by-side comparison of 2 saved profiles

### SAVE-003 · Label + Notes ⏳
**Acceptance Criteria:**
- [ ] `PUT /api/v1/saved-profiles/:userId/label` — `{ label: "HIGH_FIT"|"MAYBE"|null }`
- [ ] `POST /api/v1/saved-profiles/:userId/note` — `{ note: string }` max 300 chars
- [ ] Notes are private; never included in any response to other users

---

## PHASE 14 — Signals Dashboard

### SIGNAL-001 · Profile View Logging ⏳
**Story:** As a user, knowing who viewed my profile and when drives engagement and helps me prioritise replies.

**Acceptance Criteria:**
- [ ] Every `GET /api/v1/profiles/:id` call (by a different user) appends a `profile_view` event: `{ viewerId, viewedId, viewedAt }`
- [ ] Self-views not logged; admin views not logged
- [ ] Events stored in append-only `profile_views` table; never read back to the viewer (privacy)

### SIGNAL-002 · Weekly Metrics ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/signals/week` — `{ profileViews: { count, delta }, newConnections: { count, delta }, activeChats: { count, newThisWeek }, savedProfiles: { count, delta } }`
- [ ] Delta = this week vs last week (positive/negative integer)
- [ ] Cached Redis 1 hour

### SIGNAL-003 · Action Queue ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/signals/action-queue` — ordered list of priority nudges
- [ ] Sources: unanswered incoming connections, conversations waiting on user reply, incomplete profile sections, incomplete values answers
- [ ] Each item: `{ type, title, description, cta, urgency: "now"|"today"|"this_week" }`

### SIGNAL-004 · Momentum Chart ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/signals/momentum` — `{ days: [{ date, views }] }` — last 7 days
- [ ] Used to render bar chart on Your Week screen

---

## PHASE 15 — Trust Center

### TRUST-001 · Trust Score Calculation ⏳
**Story:** As a user, I see a trust score that reflects how verified and complete my profile is.

**Acceptance Criteria:**
- [ ] Trust score (0–100) calculated from: phone (20pts), face/selfie verified (25pts), voice intro uploaded (15pts), work verification (20pts), education verification (20pts)
- [ ] Recalculated on any verification layer change
- [ ] Cached; exposed on own profile and to matched users

### TRUST-002 · Trust Center Endpoint ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/trust-center` — `{ score, layers: { phone, face, voiceIntro, work, education }, privacyControls, accessLevel }`
- [ ] Each layer: `{ verified: boolean, verifiedAt?, label }`

### TRUST-003 · Privacy Controls ⏳
**Acceptance Criteria:**
- [ ] `PUT /api/v1/profile/privacy-controls` — `{ showLastName: boolean, showWorkplace: boolean, showEducation: boolean, showFamilyDetails: boolean }`
- [ ] Settings applied before mutual connection; after mutual all fields unlock
- [ ] `GET /api/v1/profile/access-levels` — returns the 3 tier definitions (Basic/Trusted/Family-aware)

### TRUST-004 · Pause Visibility ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/profile/pause-visibility` — user stops appearing in any discover, introductions, or group
- [ ] `DELETE /api/v1/profile/pause-visibility` — resume
- [ ] Paused status stored on user row; respected by all feed/introduction queries

### TRUST-005 · Block + Report ⏳
**Acceptance Criteria:**
- [ ] `POST /api/v1/users/:id/block` — block: removes from each other's feeds, cannot message
- [ ] `DELETE /api/v1/users/:id/block` — unblock
- [ ] `GET /api/v1/users/blocked` — list blocked users
- [ ] Block is mutual-invisible: blocked user cannot see blocker's profile
- [ ] Report reuses existing `POST /api/v1/messages/:msgId/flag` pattern extended for user-level reports

---

## PHASE 16 — Algorithm v2 + Match Tuning

### ALG-001–009 · New Matching Dimensions ⏳
**Story:** As a user, my matches improve as I add habits, answer prompts, and attend events — because all those signals feed the algorithm.

**Dimension specification:**
| # | Dimension | Data source | Weight |
|---|-----------|------------|--------|
| 10 | Weekly rhythm similarity | Habit log time-of-day patterns | TBD |
| 11 | Consistency score | Habit streak + variance | TBD |
| 12 | Prompt resonance | Shared resonate events on same prompt answers | TBD |
| 13 | Settlement intent | Match Tuning Q1 answer alignment | TBD |
| 14 | Family involvement | Match Tuning Q2 answer alignment | TBD |
| 15 | Event co-attendance | Both RSVP'd same event | TBD |
| 16 | Communication style | Voice intro presence, prompt answer depth | TBD |
| 17 | Profile momentum | Profile views velocity (7-day trend) | TBD |
| 18 | Trust depth | Count of verified layers | TBD |

**Acceptance Criteria (all dimensions):**
- [ ] Each dimension returns a `{ name, score: 0–100, label: string }` tuple
- [ ] Total score = weighted sum of all 18 dimensions (weights configurable via feature flags)
- [ ] Dimension scores cached per pair, invalidated on any data change for either user
- [ ] Per-dimension output included in `GET /api/v1/profiles/:id/match-context` response

### ALG-010 · Match Tuning Endpoints ⏳
**Acceptance Criteria:**
- [ ] `GET /api/v1/profile/match-tuning` — `{ answers: { longTermLocation?, familyInvolvement? } }`
- [ ] `POST /api/v1/profile/match-tuning` — `{ longTermLocation: string, familyInvolvement: string }`
- [ ] On save: enqueues BullMQ job to re-score all pairs for this user
- [ ] `GET /api/v1/profile/match-tuning/impact` — `{ currentTopMatch, projectedTopMatch, dimensionsAffected[] }` (preview before committing)

---

## Design Decisions Log (Figma Analysis Session — 2026-05-28)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Identity verification partner | Manual admin review | No third-party SDK. User uploads to S3; admin reviews in admin panel. MVP-safe. |
| "Why this match?" text | Rule-based templates (v1) + LLM cached (v2) | Templates ship with Phase 10. LLM enhancement follows in Phase 16. |
| £2.99/year Founding Member price | TBD — placeholder in design | Final price not confirmed. Stripe price ID to be added once finalised. |
| Credits vs Diamonds | Same system — UI renamed to "Credits" | Backend `diamond_ledger` stays; display name changes to "credits" everywhere. |
| Email authentication | Required (not future) | OB7 Figma screen explicitly shows "Continue with email" as primary CTA. |
| Habits cadence | Daily logging | "Log today" CTA per habit; 7-dot weekly tracker confirms daily not weekly. |
| Voice intro storage | S3 (same adapter as photos) | Profile completion hub lists it alongside photos as a section. Audio: mpeg/mp4, max 60s. |
| Group credit cost | Admin-configurable per group | Design shows variable prices (80, 120 credits) per group — not a fixed constant. |

---

## Design Decisions Log (Seeder + AI + Groups Scope Session — 2026-05-29)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Seeder auth bypass | `SEEDER_SECRET` env var → gateway middleware sets `req.user` from token payload | Cleanest isolation — real OTP flow untouched; seeder never reaches prod (env guard) |
| Seeded data isolation | `isSeeded Boolean @default(false)` on `User` + `Profile` + `Group` + `GroupPost` | Allows clean flush of all synthetic data without affecting real users |
| Seeder profile photos | Read from S3 prefix `seeder/profile-photos/`, assign randomly | No AI image generation cost; realistic look; photos uploaded once by operator |
| Drip cadence | 3–5 profiles at a random offset within a 3–4 hour window | Organic feel — not mechanical fixed-interval; simulates real user signup patterns |
| Group model | Single `Group` model with `type` enum (`REGIONAL/CULTURAL/PROFESSIONAL/INTEREST`) | DB simplicity, type drives all behaviour differences |
| Group scope | `scope` enum (`COUNTRY/GLOBAL`); DB-provisioned for global but country-specific for now | Future-proofs global professional channels; keeps intro drops region-filtered |
| Group social feed | Phase 1: posts + flat comments + likes. No nested threads, no video uploads | Keeps moderation surface manageable; delivers value without complexity |
| Community group join | Suggested at onboarding + home feed, NOT auto-join | User agency; higher engagement quality; avoids identity imposition |
| REGIONAL country-level | Auto-join on registration | Everyone in UK benefits immediately from immigration/community news |
| Interest group creation | Member proposes → admin approves (hybrid). Phase 2: fully user-created | Quality control in early days; prevents spam groups |
| Suggested groups max | 20 (admin-configurable via `SystemConfig` table) | Enough choice without overwhelming; "View All" available from home feed |
| Group member visibility | All members visible in all group types | Openness drives engagement; conversation cost provides monetisation gate |
| Conversation from group | Costs diamonds to initiate | Monetisation touchpoint at intent-to-connect moment |
| IntroductionDrop model | `IntroductionDrop` (themed category/pool) + `Introduction` (curated 1:1 pairing per recipient) | Separates "what drop category" from "who specifically for this user" |
| Intros per user per drop | AI picks 3–5 best from pool per recipient | Personalised, manageable, not overwhelming |
| Weekly intro cap | Removed — no cap on drops per week | Multiple themed drops can be live simultaneously |
| Intro release mechanism | `IntroductionDrop.releaseAt` timestamp replaces `weekKey` gating | Flexible scheduling across any day of the week |
| Early access model | Tiered: spend diamonds to VIEW early (locked) + spend more to UNLOCK fully | Monetisation ladder with clear value steps |
| AI grouping approach | Hybrid: AI proposes DRAFT drops, admin approves → SCHEDULED. Phase 2: fully automated | Quality control initially; builds confidence in AI proposals before full automation |
| AI model selection | `gpt-4o-mini` (completions) + `text-embedding-3-small` (embeddings) + `Whisper` (voice) | Cost-efficient; gpt-4o-mini is 15× cheaper than gpt-4o with 90% of quality for this use case |
| Vector storage | pgvector extension in Supabase Postgres | Already supported by Supabase; no extra infrastructure; cosine similarity queries in SQL |
| Quiet window | 22:00–07:00 in recipient's local timezone — no push notifications | Diaspora audience spans 4 timezones; user wellbeing + notification fatigue |
| Event pre-connections | Auto-SCHEDULED drop (no admin approval) releasing 72h before event date | Low-stakes, time-bound, highly relevant — admin approval adds no value here |

---

## PHASE 8 — New Scope (Seeder + AI + Groups Revamp + IntroductionDrop)

> **Scoped:** 2026-05-29
> **Prerequisite:** DB-MIGRATION-001 must complete before any story in this phase begins.
> **Implementation order:** DB-MIGRATION-001 → Phase 8a → Phase 8b → Phase 8c → Phase 8d → Phase 8e

---

### DB-MIGRATION-001 · Foundation Schema Migration ✅

**Story:** As a platform, I need all new database models and columns in place before any Phase 8 feature can be built.

**Completed:** 2026-05-29 | **Tests:** 1,146 passed, 0 failed (81 suites)

**Acceptance Criteria:**
- [x] `User.isSeeded Boolean @default(false)` — marks synthetic test users
- [x] `Profile.isSeeded Boolean @default(false)` — marks synthetic test profiles
- [x] `Profile.voiceIntroTranscript String?` — stores Whisper-transcribed voice intro text
- [x] `GroupType` enum: `REGIONAL | CULTURAL | PROFESSIONAL | INTEREST`
- [x] `GroupScope` enum: `COUNTRY | GLOBAL`
- [x] `Group` model revamped: `type`, `scope`, `parentGroupId?`, `country?`, `city?`, `professionTag?`, `culturalTag?`, `memberCount Int @default(0)`, `isSeeded Boolean @default(false)`, `coverImageUrl?`, `isActive Boolean @default(true)`
- [x] `JoinedVia` enum: `AUTO | ONBOARDING | HOME_FEED | SEARCH | MANUAL`
- [x] `GroupMember.joinedVia JoinedVia` field added
- [x] `GroupPost` model: `id, groupId, authorId, text?, imageUrl?, linkUrl?, linkTitle?, linkPreview?, isPinned, likesCount, commentsCount, isSeeded, createdAt, updatedAt`
- [x] `GroupPostComment` model: `id, postId, authorId, text, createdAt`
- [x] `GroupPostLike` model: composite PK `[postId, userId]`
- [x] `GroupProposal` model: `id, proposedByUserId, name, description, type, country?, rationale, status (PENDING|APPROVED|REJECTED), reviewedByAdminId?, reviewedAt?, createdAt`
- [x] `IntroductionDrop` model: `id, name, criteria (Json), memberPool (String[]), releaseAt, expiresAt, status (DRAFT|PENDING_APPROVAL|SCHEDULED|LIVE|EXPIRED), proposedByAI, approvedByAdminId?, approvedAt?, weekKey?, earlyAccessCost Int @default(10), unlockCost Int @default(25), isSeeded, createdAt, updatedAt`
- [x] `Introduction.dropId String?` FK to `IntroductionDrop` — nullable for backward compat
- [x] `Introduction.viewedEarlyAt DateTime?` — stamped when user spends diamonds to VIEW
- [x] `Introduction.unlockedEarlyAt DateTime?` — stamped when user spends diamonds to UNLOCK
- [x] `ProfileEmbedding` model: `userId String @id (FK User)`, `summary Text`, `traitTags String[]`, `vibeScores Json`, `compatibilityNotes Text?`, `embedding Unsupported("vector(1536)")?`, `recommendedContactWindow Json?`, `updatedAt`
- [x] `SystemConfig` model: `key String @id`, `value String`, `description String?`, `updatedAt`
- [x] Prisma client re-generated after migration
- [ ] Migration run locally via `npx prisma db push` (cloud runner cannot reach Supabase — USER must run)
- [x] All existing tests still pass after schema changes

**Implementation Subtasks:**
- [ ] Enable pgvector extension in Supabase: `CREATE EXTENSION IF NOT EXISTS vector;` (run once in Supabase SQL editor — USER action)
- [x] Add `previewFeatures = ["postgresqlExtensions"]` to Prisma schema generator
- [x] Write all new models in `libs/db/prisma/schema.prisma`
- [ ] Run `npx prisma db push` locally — USER must run on local machine
- [x] Run `npx prisma generate` — client regenerated ✓
- [x] Verify all existing test suites still pass: 1,146 tests, 81 suites ✓

**Decision Log:**
- `Introduction.weekKey` made optional (was required) — allows drop-based introductions with no weekKey
- Old `@@unique([weekKey, userAId, userBId])` constraint removed — service layer enforces uniqueness
- `Introduction.groupId` made optional — drops are platform-wide, not group-specific
- `ProfileEmbedding` uses `userId @id` (not a separate UUID) — enforces strict one-to-one with User
- `DiamondReason` extended with `INTRO_EARLY_VIEW`, `INTRO_EARLY_UNLOCK`, `GROUP_CONVERSATION_INITIATION`
- UUID test fixture bug found and fixed: `p` and `r` are not hex chars — `pppp...` and `rrrr...` UUIDs fail Zod validation. Fixed to `aaaa...` and `bbbb...`

---

### SEED-001 · Seeder App Scaffold ✅

**Story:** As a developer, I need a standalone seeder app that runs independently of the gateway, has its own BullMQ scheduler, and exposes an HTTP control API — but can never run in production.

**Acceptance Criteria:**
- [x] `apps/seeder` NX project created with TypeScript + ts-node
- [x] Express HTTP server on configurable port (default 3100)
- [x] BullMQ worker wired to same Redis instance as gateway
- [x] Hard env guard: if `NODE_ENV === 'production'` → process exits with error immediately
- [x] `apps/seeder/src/app.ts` — Express setup; `server.ts` — lifecycle (start/stop)
- [x] `apps/seeder/.env.example` — documents `SEEDER_SECRET`, `GATEWAY_URL`, `SEEDER_PORT`, `SEEDER_PHOTO_S3_PREFIX`
- [x] Graceful shutdown on SIGTERM

**Implementation Subtasks:**
- [x] Create `apps/seeder/package.json` (`@abroad-matrimony/seeder`)
- [x] Create `apps/seeder/tsconfig.json`
- [x] Create `apps/seeder/jest.config.ts`
- [x] Create `apps/seeder/src/server.ts`, `app.ts`
- [x] Add production env guard in `server.ts`
- [x] Wire to root NX workspace

---

### SEED-002 · Profile Factory ✅

**Story:** As a developer, I need a factory that generates realistic, diverse Indian-diaspora profiles across 5 countries, 10 profession umbrellas, varied cultural backgrounds, and full real-life question answers.

**Acceptance Criteria:**
- [x] Generates 500 profiles on first run (configurable via `SEEDER_INITIAL_COUNT`)
- [x] Country distribution: UK 35%, Germany 20%, Australia 20%, Canada 15%, India (NRI) 10%
- [x] City distribution per country: major diaspora cities (London, Manchester, Birmingham / Berlin, Munich / Sydney, Melbourne / Toronto, Vancouver / Mumbai, Delhi)
- [x] Profession umbrellas: Medical & Healthcare, Engineering & Technology, Finance & Business, Education & Research, Legal & Public Sector, Creative & Media, Hospitality & Retail, Life Sciences & Pharma, Students & Early Career, Other Professionals
- [x] Cultural background tags: Gujarati, Tamil, Punjabi, Malayali, Bengali, Marathi, Telugu, Rajasthani, Kannadiga, Hyderabadi, Goan, Anglo-Indian
- [x] Real-life answers (all 12 questions) — realistic, varied, readable text
- [x] Story prompt answers (all 3 prompts) — 50-200 words each
- [x] Age distribution: 23–38, weighted towards 26–33
- [x] Gender: 50% male, 50% female (±5%)
- [x] All profiles have `isSeeded: true`

**Implementation Subtasks:**
- [x] Create `apps/seeder/src/factories/profile.factory.ts`
- [x] Create `apps/seeder/src/data/names.data.ts` — culturally appropriate name lists per background
- [x] Create `apps/seeder/src/data/real-life-answers.data.ts` — answer bank per question per persona type
- [x] Create `apps/seeder/src/data/story-prompts.data.ts` — prompt answer bank
- [x] Profile factory calls gateway API with `SEEDER_SECRET` auth header
- [x] Each profile creation: direct DB user create → profile via gateway → real-life answers → story prompts → photo assignment

---

### SEED-003 · S3 Photo Assignment ✅

**Story:** As a developer, I need seeded profiles to have realistic profile photos pulled from a curated S3 folder so the UI looks real during testing.

**Acceptance Criteria:**
- [x] On seeder startup, lists all objects at `s3://<BUCKET>/<SEEDER_PHOTO_S3_PREFIX>/` and caches the key list
- [x] Photo keys split by gender subfolder: `seeder/profile-photos/male/` and `seeder/profile-photos/female/`
- [x] On profile creation, picks random photo key matching profile gender
- [x] Assigns via direct DB insert for speed (avoids S3 presigned upload round-trip)
- [x] Falls back to no photo if S3 prefix is empty (seeder still works without photos)

---

### SEED-004 · SEEDER_SECRET Gateway Middleware ✅

**Story:** As a developer, I need the gateway to accept a special seeder token that bypasses OTP/device auth, so the seeder can perform actions as any synthetic user without going through real auth flows.

**Acceptance Criteria:**
- [x] New middleware `apps/gateway/src/middleware/seeder-auth.middleware.ts`
- [x] Token format: `<SEEDER_SECRET>.<base64url-JSON-payload>` — avoids simple string equality attacks
- [x] Reads `Authorization: Bearer <token>` header; decodes payload `{ userId, role }` and sets `req.user`
- [x] If `NODE_ENV === 'production'` → middleware is a strict no-op
- [x] `SEEDER_SECRET` added to `libs/config/src/env.ts` as `z.string().optional()`
- [x] `SEEDER_SECRET` documented in `.env.example`
- [x] Middleware mounted in gateway `app.ts` BEFORE `requireAuth`; non-seeder tokens fall through to JWT auth
- [x] `buildSeederToken()` helper exported for use by seeder lib
- [x] 11 unit tests: valid token, production no-op, missing secret, invalid payload, etc.

---

### SEED-005 · Group Auto-Join for Seeder Profiles ✅

**Story:** As a developer, I need seeded profiles to automatically join their country REGIONAL group and be suggested/joined to relevant cultural and professional groups, so the group system has realistic membership data.

**Acceptance Criteria:**
- [x] On profile creation, seeder joins the matching country REGIONAL group (`joinedVia: AUTO`)
- [x] Seeder joins 1–2 cultural groups matching profile's `culturalTag` (`joinedVia: ONBOARDING`)
- [x] Seeder joins matching professional group for profile's profession (`joinedVia: ONBOARDING`)
- [x] Seeder randomly joins 0–2 INTEREST groups from available pool (`joinedVia: MANUAL`)
- [x] Group `memberCount` denormalized counter updated on each join (Prisma transaction)
- [x] Duplicate membership handled gracefully (upsert-safe)

---

### SEED-006 · Activity Simulator ✅

**Story:** As a developer, I need existing seeded profiles to perform realistic user actions over time — so the platform has live-feeling data for connections, introductions, events, prompts, and habits.

**Acceptance Criteria:**
- [x] Simulator runs on a BullMQ cron (every 2 hours)
- [x] Per run: picks 10–20 random seeded profiles to "be active"
- [x] Each active profile randomly performs 1–4 actions from: log_habit, post_in_group, send_connection, respond_to_intro, save_profile, rsvp_event
- [x] Actions use SEEDER_SECRET auth to call gateway endpoints
- [x] No action is taken that would fail validation (duplicate check before each action)

---

### SEED-007 · Drip Scheduler ✅

**Story:** As a developer, I need new profiles to appear continuously every 3–4 hours with a random count (3–5) so the platform always feels alive with new joiners.

**Acceptance Criteria:**
- [x] BullMQ repeatable job: fires every `SEEDER_DRIP_INTERVAL_HOURS` hours (default 3)
- [x] On each fire: waits a random delay (0–60 minutes) before executing — organic arrival feel
- [x] Creates `SEEDER_DRIP_MIN`–`SEEDER_DRIP_MAX` new profiles (default 3–5)
- [x] New profiles go through full factory flow: register → profile → answers → photo → group joins
- [x] Job logs: how many profiles created
- [x] Drip can be paused/resumed via seeder control API

---

### SEED-008 · Seeder Control API ✅

**Story:** As a developer, I need HTTP endpoints to manually control the seeder during testing — trigger a batch, check status, or flush all seeded data cleanly.

**Acceptance Criteria:**
- [x] `GET /seed/status` → `{ running, dripPaused, lastRunAt, lastDripAt, totalSeededUsers, totalSeededProfiles, totalSeededGroups, totalSeededPosts, totalSeededConnections }`
- [x] `POST /seed/run` → triggers an immediate drip batch, returns job ID; 409 if already running
- [x] `POST /seed/flush` → requires `{ confirm: "FLUSH_ALL_SEEDED_DATA" }` in body; deletes all seeded records in dep order; returns counts
- [x] `POST /seed/pause` / `POST /seed/resume` → pauses/resumes the drip scheduler
- [x] All endpoints require `X-Seeder-Key: <SEEDER_SECRET>` header; 401 without it
- [x] Flush is a hard delete — 17 entity types, Prisma transaction, leaves real users untouched
- [x] 13 controller tests covering all endpoints + auth + error cases

---

### SEED-009 · Matching Re-Run Trigger ✅

**Story:** As a developer, I need match scores computed for new seeded profiles so the discovery feed and AI drop proposals have meaningful score data to work with.

**Acceptance Criteria:**
- [x] After each drip batch completes, seeder enqueues a `RECOMPUTE_SCORES` BullMQ job targeting new profile IDs
- [x] Job calls `libs/matching` `batchComputeScoresForUsers()` for each new profile
- [x] Failures are non-fatal — warning logged, next drip retries
- [x] Seeder status API includes `lastMatchRecomputeAt` timestamp

---

### AI-001 · `libs/ai` Scaffold ✅

**Story:** As a platform, I need an AI library that wraps OpenAI's APIs (completions, embeddings, Whisper) with proper error handling, retry logic, and environment-based fallbacks.

**Acceptance Criteria:**
- [x] `libs/ai/package.json` (`@abroad-matrimony/ai`, depends on `openai` npm package)
- [x] `libs/ai/src/client.ts` — OpenAI singleton, lazy-initialised, `isAiConfigured()` check (graceful fallback if no API key)
- [x] `libs/ai/src/index.ts` — barrel exports
- [x] Env vars: `OPENAI_API_KEY`, `AI_MODEL` (default `gpt-4o-mini`), `EMBEDDING_MODEL` (default `text-embedding-3-small`)
- [x] All 3 env vars added to `libs/config/src/env.ts` as optional strings
- [x] All 3 added to `.env.example` with comments
- [x] `AiNotConfiguredError` — thrown when API key absent and non-mock path is called
- [x] `libs/ai/jest.config.ts` — test config using `jest.preset.js`
- [x] Unit tests: configured → returns singleton; not configured → `isAiConfigured()` returns false; error classes instantiate correctly

---

### AI-002 · Profile Intelligence Service ✅

**Story:** As a platform, I want AI to generate a semantic personality summary, trait tags, vibe scores, and a vector embedding for every profile — so matching and group formation can go beyond simple demographic fields.

**Acceptance Criteria:**
- [x] `libs/ai/src/profile-intelligence.service.ts` — `generateProfileIntelligence(userId: string): Promise<ProfileEmbeddingDto>`
- [x] Aggregates: demographics, all real-life answers, story prompts, habits, event attendance, groups joined, voice intro transcript
- [x] GPT call returns: `summary`, `traitTags` (8–12), `vibeScores` (5 dims 1–10), `compatibilityNotes`, `recommendedContactWindow`
- [x] Embedding call: generates 1536-dim vector from summary text
- [x] Upserts `ProfileEmbedding` record in DB
- [x] If `isAiConfigured()` is false → logs info, returns null (no-op)
- [x] Unit tests: 8 tests covering happy path, no-op, missing profile, invalid GPT JSON, default scores

---

### AI-003 · Voice Intro Transcription ✅

**Story:** As a platform, I want voice introductions automatically transcribed so the text can feed the profile intelligence AI and improve semantic matching based on how someone actually speaks.

**Acceptance Criteria:**
- [x] `libs/ai/src/whisper.service.ts` — `transcribeVoiceIntro(userId: string, s3Key: string): Promise<string>`
- [x] Downloads audio from S3 using `GetObjectCommand` from AWS SDK directly (StorageAdapter has no download method)
- [x] Calls OpenAI Whisper API (`whisper-1` model) with audio buffer via `toFile()` helper
- [x] Returns transcript string (empty string on any failure — non-fatal)
- [x] Stores transcript in `Profile.voiceIntroTranscript` via `prisma.profile.updateMany`
- [x] Triggers profile intelligence BullMQ job via `enqueueProfileIntelligence()` after successful transcription
- [x] `libs/profile/src/extensions.service.ts` — `saveVoiceIntro()` fires `transcribeVoiceIntro()` as void (non-blocking) after saving S3 key
- [x] If `isAiConfigured()` is false → returns `''` immediately, no API calls made
- [x] Unit tests: 7 tests covering happy path, no-op when AI not configured, S3 error, whisper error, empty content

**Decision Log:**
- Used `GetObjectCommand` from `@aws-sdk/client-s3` directly for S3 download since `StorageAdapter` interface only exposes upload + presigned URL operations. Avoids polluting the shared interface with a download method needed only by AI.
- Signature changed from `transcribeVoiceIntro(s3Key)` to `transcribeVoiceIntro(userId, s3Key)` to enable `prisma.profile.updateMany({ where: { userId } })` — profile is identified by user ID.
- `saveVoiceIntro()` in `libs/profile` fires transcription as `void` (fire-and-forget) so the endpoint does not block on Whisper latency; failures are logged as warn but do not surface to caller.

---

### AI-004 · Intro Drop Proposal ✅

**Story:** As an admin, I want the AI to automatically propose introduction drop batches by analysing profile embeddings and grouping compatible people, so I only need to review and approve rather than manually curate.

**Acceptance Criteria:**
- [x] `libs/ai/src/intro-grouping.service.ts` — `proposeIntroductionDrops(region: string): Promise<IntroductionDropDraftDto[]>`
- [x] Fetches eligible users via `prisma.user.findMany` with `profile: { currentCountry: { contains: region } }` filter
- [x] Excludes users without `profileEmbedding`; requires minimum 10 eligible profiles (returns `[]` otherwise)
- [x] GPT call: sends anonymised summaries + trait tags; asks for groups with name, rationale, memberIds, releaseRecommendation; `response_format: json_object`, temperature 0.5
- [x] Handles GPT response both as top-level array and wrapped in `{ groups: [...] }` key
- [x] Creates `IntroductionDrop` records with `status: DRAFT`, `proposedByAI: true`, `releaseAt` from AI recommendation
- [x] Skips groups with fewer than 2 memberIds
- [x] Returns `[]` when AI not configured, or on invalid JSON from GPT
- [x] Unit tests: 7 tests covering happy path, DRAFT status, not enough profiles, too-small groups, bad JSON, `groups` key wrapping

**Decision Log:**
- Queries `prisma.user` (not `prisma.profile`) with region filter on nested `profile.currentCountry`. All relation data needed (profileEmbedding, introductionsAsA) hangs off User, not Profile.
- `currentCountry` is the correct Prisma field name (not `country`). `culturalBackground` does not exist in schema.
- Minimum threshold 10 profiles (not 8) to ensure meaningful group diversity; GPT asked for min 2 members per group, enforced after parse.
- pgvector centroid refinement deferred to Phase 8d/8e (nice-to-have); current implementation relies solely on GPT semantic grouping which is sufficient for MVP.

---

### AI-005 · Event Pre-Connections ✅

**Story:** As a platform, I want to automatically create introduction drops for event attendees who have high match scores — connecting them before the physical event.

**Acceptance Criteria:**
- [x] `libs/ai/src/event-preconnect.service.ts` — `generateEventPreConnections(eventId: string): Promise<void>`
- [x] Fetches event via `prisma.event.findUnique`; exits silently if not found
- [x] Fetches attendees via `prisma.eventRsvp.findMany` (NOT `eventAttendee` — correct Prisma model name)
- [x] Exits silently if fewer than 4 attendees
- [x] Finds pairs with `matchScore.totalScore >= 70` (MIN_MATCH_SCORE), different gender, not in existing introductions, not blocked
- [x] Blocked pairs checked via `prisma.userBlock.findMany` (NOT `prisma.block`)
- [x] Creates `IntroductionDrop`: `name: "Meet someone attending [event.title]"`, `releaseAt: startAt - 72h`, `status: SCHEDULED`, `proposedByAI: true`
- [x] Creates `Introduction` rows via `prisma.introduction.createMany` in both directions (2 rows per pair)
- [x] Does NOT create drop if fewer than MIN_PAIRS_REQUIRED (4) qualifying pairs
- [x] Unit tests: 8 tests covering drop creation, bidirectional intros, releaseAt timing, no event, too few attendees, too few pairs, excluded introduced/blocked pairs

**Decision Log:**
- Correct Prisma model names discovered during implementation: `eventRsvp` (not `eventAttendee`), `userBlock` (not `block`), `event.title` (not `event.name`), `event.startAt` (not `event.date`).
- PRE_CONNECT_HOURS = 72: `releaseAt = new Date(event.startAt.getTime() - 72 * 60 * 60 * 1000)`
- IntroductionDrop.name stored as `name` field (maps to display label for the drop batch).
- Both-direction Introduction rows required so each user's inbox shows the introduction from their own perspective.

---

### AI-006 · Quiet Window + Timezone-Aware Delivery ✅

**Story:** As a user, I never want push notifications or intro release alerts between 22:00 and 07:00 in my local time — the platform respects my timezone.

**Acceptance Criteria:**
- [x] `ProfileEmbedding.recommendedContactWindow Json?` stores `{ startHour: 8, endHour: 22, timezone: "Europe/London" }`
- [x] AI generates this as part of `generateProfileIntelligence()` (AI-002) based on user's city/country → timezone
- [x] `libs/ai/src/quiet-window.ts` — `getContactWindow(userId)`, `isWithinWindow(window, now)`, `msUntilWindowOpens(window, now)`
- [x] `getContactWindow()` reads `ProfileEmbedding.recommendedContactWindow`; falls back to `{ 8, 22, UTC }` if absent or DB error
- [x] `isWithinWindow()` uses `Intl.DateTimeFormat` to get local hour in recipient's timezone; returns `true` for unknown timezone (safe default)
- [x] `msUntilWindowOpens()` returns ms to wait; falls back to 1h for invalid timezone
- [x] Notification worker in `libs/notification` checks quiet window before delivering PUSH notifications
- [x] If outside window → throws sentinel `{ message: 'QUIET_WINDOW_DEFER', delayMs }` — worker re-queues job with computed delay (not failed, not dropped)
- [x] Non-PUSH notifications (EMAIL, SMS) bypass quiet window check
- [x] For users without `ProfileEmbedding`: defaults to 08:00–22:00 UTC
- [x] Unit tests: 10 tests covering stored window, default fallback, DB error fallback, isWithinWindow boundaries, timezone edge cases, msUntilWindowOpens before/after/invalid

**Decision Log:**
- Circular dependency avoidance: `libs/notification` → `libs/ai` → (potentially back to notification). Resolved by using `await import('@abroad-matrimony/ai')` (dynamic import) inside the notification worker's quiet window check function. At module resolution time there is no static cycle.
- Quiet window check uses `endHour: 22` (exclusive upper bound) matching `isWithinWindow` boundary test: 22:00 → outside window.
- Re-queue strategy: notification worker catches the QUIET_WINDOW_DEFER sentinel and calls `queue.add(...)` with `delay: delayMs` rather than `throw`. Job counted as processed successfully; no false failure metrics.
- `isWithinWindow()` returns `true` (allow delivery) for unknown/invalid timezone — fail-open is intentional to avoid silently dropping notifications for users with misconfigured timezone.

---

### AI-007 · BullMQ Job Wiring ✅

**Story:** As a platform, I want profile intelligence to regenerate automatically whenever a user makes meaningful updates — without the user or any admin having to trigger it manually.

**Acceptance Criteria:**
- [x] `PROFILE_INTELLIGENCE` added to `QUEUE_NAMES` in `libs/shared/src/constants/index.ts`
- [x] `JOB_TYPES.PROFILE_INTELLIGENCE_UPDATE` constant added to `libs/shared/src/constants/index.ts`
- [x] `libs/ai/src/enqueue-intelligence.ts` — `enqueueProfileIntelligence(userId, redisUrl)` with 60s debounce
- [x] Debounce: stable `jobId: 'pi:${userId}'`; existing waiting/delayed job removed before re-add to reset 60s timer
- [x] `libs/ai/src/ai.worker.ts` — `createAiWorker(redisUrl)` BullMQ worker, concurrency 2 (conservative for OpenAI rate limits)
- [x] `processProfileIntelligence(data)` processes job — calls `generateProfileIntelligence(userId)`
- [x] `triggerProfileIntelligenceNow(userId, redisUrl)` — utility for immediate trigger (no debounce)
- [x] Worker started in `apps/gateway/src/server.ts` lifecycle only when `isAiConfigured()` returns true
- [x] Graceful shutdown: `aiWorker.close()` called in shutdown sequence
- [x] Voice intro trigger: `saveVoiceIntro()` in `libs/profile` fires `transcribeVoiceIntro()` non-blocking; Whisper service enqueues intelligence job after successful transcription
- [x] `@abroad-matrimony/ai` added to `jest.preset.js` moduleNameMapper; path alias added to `tsconfig.base.json`

**Decision Log:**
- Concurrency set to 2 (not higher) because `gpt-4o-mini` + embeddings API calls are I/O-bound but OpenAI has per-minute token rate limits. 2 concurrent workers gives throughput without triggering 429s on burst activity.
- AI worker conditional startup: if `OPENAI_API_KEY` absent, worker is not created and `logger.warn` is emitted. This ensures the worker doesn't poll an empty queue or emit errors in dev environments without API keys.
- `enqueueProfileIntelligence` is also exported from `libs/ai/src/index.ts` so Whisper service can import it from the same lib without circular deps.
- Job enqueue triggers not yet wired into profile/habit/prompt service update paths (planned for Phase 8e/admin integration) — currently triggered via voice intro and direct calls. Full wiring is Phase 8d scope.

---

### GRP-R-001 · `libs/groups` Revamp — Core Service ⏳

**Story:** As a platform, I need the groups service rebuilt to support the four group types with type-specific auto-join rules, member count management, and suggested group logic.

**Acceptance Criteria:**
- [ ] `libs/groups/src/index.ts` fully refactored with new model
- [ ] `joinGroup(userId, groupId, joinedVia)` — validates not already joined, increments `memberCount`
- [ ] `leaveGroup(userId, groupId)` — decrements `memberCount`, removes membership
- [ ] `autoJoinRegionalCountryGroup(userId, country)` — called on profile creation, uses `joinedVia: AUTO`
- [ ] `listSuggestedGroups(userId, limit)` — returns groups user is not in, ranked by: (1) profile field match, (2) member count, (3) activity (most recent post), filtered by `isActive: true`
- [ ] `getSuggestedGroupsForOnboarding(userId)` — wrapper of above, limit from `SystemConfig.SUGGESTED_GROUPS_MAX` (default 20)
- [ ] `getGroupMembers(groupId, page, limit)` — paginated member list
- [ ] `GroupNotFoundError`, `AlreadyInGroupError`, `NotInGroupError` error classes
- [ ] All existing unit tests updated + new tests for new functions

---

### GRP-R-002 · Group Social Feed Service ⏳

**Story:** As a group member, I can post community news, share links, and upload photos to my group's feed so diaspora members have a shared information space.

**Acceptance Criteria:**
- [ ] `createPost(userId, groupId, data)` — validates user is group member; creates `GroupPost`
- [ ] `listPosts(groupId, page, limit)` — ordered by isPinned DESC, createdAt DESC
- [ ] `deletePost(userId, postId)` — only author or admin can delete
- [ ] `likePost(userId, postId)` / `unlikePost(userId, postId)` — idempotent, updates `likesCount`
- [ ] `addComment(userId, postId, text)` — validates user is group member; creates `GroupPostComment`, increments `commentsCount`
- [ ] `listComments(postId, page, limit)` — ordered by `createdAt ASC` (flat, no nesting)
- [ ] `pinPost(adminId, postId)` / `unpinPost(adminId, postId)` — admin only
- [ ] `PostNotFoundError`, `NotGroupMemberError`, `PostForbiddenError` error classes
- [ ] Unit tests for all service functions

---

### GRP-R-003 · Interest Group Proposal Flow ⏳

**Story:** As a verified user, I can propose a new interest group which an admin reviews and approves — so organic community groups form around real shared interests.

**Acceptance Criteria:**
- [ ] `proposeGroup(userId, { name, description, country, rationale })` — creates `GroupProposal` with `status: PENDING`
- [ ] User must have a verified profile and `isSeeded: false` to propose
- [ ] `getGroupProposals(status)` — admin: list by status
- [ ] `approveGroupProposal(adminId, proposalId)` — creates `Group` (type: INTEREST, status: SCHEDULED), proposer auto-joined, `GroupProposal.status → APPROVED`
- [ ] `rejectGroupProposal(adminId, proposalId, reason)` — `GroupProposal.status → REJECTED`
- [ ] Notification sent to proposer on approval/rejection
- [ ] `GroupProposalNotFoundError`, `AlreadyProposedError` error classes

---

### GRP-R-004 · Gateway Group Endpoints ⏳

**Story:** As a user, I can interact with groups through REST API endpoints — see suggestions, join, browse members, and engage with the feed.

**Acceptance Criteria:**
- [ ] `GET /api/v1/groups/suggested` — returns `listSuggestedGroups()` for current user
- [ ] `GET /api/v1/groups/onboarding-suggestions` — returns `getSuggestedGroupsForOnboarding()` (called after profile creation)
- [ ] `POST /api/v1/groups/:groupId/join` — join a group
- [ ] `DELETE /api/v1/groups/:groupId/leave` — leave a group
- [ ] `GET /api/v1/groups/:groupId/members` — paginated member list
- [ ] `GET /api/v1/groups/:groupId/feed` — paginated group posts
- [ ] `POST /api/v1/groups/:groupId/posts` — create post
- [ ] `DELETE /api/v1/groups/:groupId/posts/:postId` — delete own post
- [ ] `POST /api/v1/groups/:groupId/posts/:postId/like` — like
- [ ] `DELETE /api/v1/groups/:groupId/posts/:postId/like` — unlike
- [ ] `POST /api/v1/groups/:groupId/posts/:postId/comments` — add comment
- [ ] `GET /api/v1/groups/:groupId/posts/:postId/comments` — list comments
- [ ] `POST /api/v1/groups/proposals` — propose interest group
- [ ] All endpoints: `requireAuth`, UUID param validation, appropriate constants files, STANDARDS.md
- [ ] Controller tests covering happy path + all error cases

---

### IDROP-001 · `libs/introductions` Refactor ⏳

**Story:** As a user, I see multiple themed introduction drops in the coming week — each with 3–5 people AI-curated specifically for me — not just one intro per week.

**Acceptance Criteria:**
- [ ] `listDropsForUser(userId)` — returns all `IntroductionDrop` records with `status: LIVE` where the user has curated `Introduction` pairings; includes pairing details
- [ ] Weekly weekKey cap logic REMOVED entirely
- [ ] `getDropDetail(dropId, userId)` — returns drop info + user's curated pairings in that drop
- [ ] `earlyAccessDrop(userId, dropId)` — validates diamond balance ≥ `drop.earlyAccessCost`; spends diamonds; stamps `Introduction.viewedEarlyAt`; returns pairings (profile cards only — no contact info until `releaseAt`)
- [ ] `unlockDropEarly(userId, dropId)` — validates balance ≥ `drop.unlockCost - earlyAccessCost` (incremental); spends diamonds; stamps `Introduction.unlockedEarlyAt`; returns full profile
- [ ] `acceptIntroduction()` + `declineIntroduction()` unchanged in signature — work on individual `Introduction` records
- [ ] All error classes updated: `IntroductionDropNotFoundError`, `DropNotLiveError`, `InsufficientDiamondsForDropError`, `AlreadyUnlockedError`

---

### IDROP-002 · Drop Pairing Generation ⏳

**Story:** As an admin, when I approve an introduction drop, the system automatically generates personalised 1:1 introduction pairings for each eligible recipient from the drop's member pool.

**Acceptance Criteria:**
- [ ] `generatePairingsForDrop(dropId)` — called on admin approval
- [ ] For each profile in `drop.memberPool`: calls `libs/ai` to pick 3–5 best matches from the pool (excluding same gender, already introduced, blocked)
- [ ] Uses pgvector cosine similarity on `ProfileEmbedding` vectors + match scores to rank candidates
- [ ] Creates `Introduction` records: `dropId`, `userId` (recipient), `targetUserId` (match), `status: PENDING`
- [ ] Pairings are asymmetric — Sibin gets 4 intros from the drop; each intro target may or may not have Sibin in their curated list
- [ ] If `isAiConfigured()` is false → falls back to top-N by `match_scores.totalScore`
- [ ] `IntroductionDrop.status` updates to `SCHEDULED` after pairings generated

---

### IDROP-003 · Gateway IntroductionDrop Endpoints ⏳

**Story:** As a user, I can browse my upcoming introduction drops, spend diamonds to access them early, and accept or decline individual introductions.

**Acceptance Criteria:**
- [ ] `GET /api/v1/introductions/drops` — all LIVE + upcoming drops for current user with curated intro count per drop
- [ ] `GET /api/v1/introductions/drops/:dropId` — drop detail + user's curated pairings (locked or unlocked based on status)
- [ ] `POST /api/v1/introductions/drops/:dropId/early-access` — spend `earlyAccessCost` diamonds; view intro cards early (profile photo, name, profession only)
- [ ] `POST /api/v1/introductions/drops/:dropId/unlock` — spend `unlockCost` diamonds; full profile access before `releaseAt`
- [ ] `POST /api/v1/introductions/:introId/accept` — unchanged
- [ ] `POST /api/v1/introductions/:introId/decline` — unchanged
- [ ] All endpoints: `requireAuth`, Zod UUID validation, constants files, STANDARDS.md
- [ ] Controller tests for all endpoints + all error cases

---

### IDROP-004 · Admin IntroductionDrop Endpoints ⏳

**Story:** As an admin, I can review AI-proposed drops, adjust member lists, approve drops for scheduling, and manually trigger new AI proposals.

**Acceptance Criteria:**
- [ ] `GET /admin/introductions/drops` — list all drops with status filter (`DRAFT|PENDING_APPROVAL|SCHEDULED|LIVE|EXPIRED`)
- [ ] `GET /admin/introductions/drops/:dropId` — drop detail including full member pool and proposal rationale
- [ ] `PATCH /admin/introductions/drops/:dropId/approve` — approves drop, triggers pairing generation
- [ ] `PATCH /admin/introductions/drops/:dropId/members` — body: `{ addUserIds, removeUserIds }` — adjust member pool before approval
- [ ] `PATCH /admin/introductions/drops/:dropId/schedule` — body: `{ releaseAt }` — adjust release time
- [ ] `POST /admin/introductions/drops/propose` — manually triggers `proposeIntroductionDrops(region)` AI call
- [ ] All endpoints: `requireAdminRole`, appropriate admin constants, audit log entry on approve/adjust

---

### IDROP-005 · Diamond Integration for Early Access ⏳

**Story:** As a user, I spend diamonds to access introduction drops early — and the ledger records every spend with a clear reason code.

**Acceptance Criteria:**
- [ ] `DiamondLedgerReason` enum in `libs/shared/src/enums/index.ts` gains: `INTRO_EARLY_VIEW`, `INTRO_EARLY_UNLOCK`
- [ ] `earlyAccessDrop()` calls `spendDiamonds(userId, cost, 'INTRO_EARLY_VIEW')` — fails with `InsufficientDiamondsError` if balance low
- [ ] `unlockDropEarly()` calls `spendDiamonds(userId, incrementalCost, 'INTRO_EARLY_UNLOCK')`
- [ ] `GROUP_CONVERSATION_INITIATION` also added as a ledger reason (spend diamonds to start a conversation from a group member list)
- [ ] All new reasons documented in `.env.example` comments and `libs/shared/src/constants/index.ts`
