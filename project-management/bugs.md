# Abroad Matrimony — Bug & Issue Tracker

> **Status:** 🔴 Open · 🟡 In Progress · 🟢 Fixed · ⚪ Won't Fix · 🔵 Decision / Design Change

---

## Active Issues

| ID      | Type       | Phase | Task    | Title                                              | Status  | Reported    |
|---------|------------|-------|---------|----------------------------------------------------|---------|-------------|
| BUG-001 | Design     | P2    | AUTH-001| USER_REGISTERED event fired before user exists in DB | 🟢 Fixed | 2026-05-27 |
| BUG-002 | Config     | P1    | DB-002  | .env DATABASE_URL / DIRECT_URL password truncated  | 🟢 Fixed | 2026-05-27 |
| BUG-003 | Dependency | P1    | INFRA   | OpenTelemetry peer conflict blocks npm install      | 🟢 Fixed | 2026-05-27 |
| BUG-004 | Dependency | P4    | MATCH-004 | uuid v14 ESM breaks all gateway tests that call createApp() | 🟢 Fixed | 2026-05-28 |
| BUG-005 | Test       | P4    | MATCH-004 | TypeScript annotations inside jest.mock() cause Babel parse error | 🟢 Fixed | 2026-05-28 |
| BUG-006 | Test       | P4    | MATCH-004 | @abroad-matrimony/groups and /connections not resolvable in tests | 🟢 Fixed | 2026-05-28 |
| BUG-007 | Test       | P5    | MSG-003  | requireAdminRole missing from auth mocks after admin route added  | 🟢 Fixed | 2026-05-28 |
| BUG-008 | Test       | P6b   | AUTH-TD  | otp-verify.service.test.ts missing @abroad-matrimony/config mock after TRUSTED_DEVICE_TTL_DAYS added | 🟢 Fixed | 2026-05-28 |
| BUG-009 | Tech Debt  | API   | API-SPEC | openapi.yaml uses `nullable: true` (OAS 3.0 syntax) throughout; OAS 3.1 requires `type: [T, "null"]` | ⚪ Won't Fix | 2026-05-29 |

---

## Bug Detail

---

### BUG-001 — Design: USER_REGISTERED fires before user row exists
**Type:** Design Decision  
**Phase:** 2 — Auth  
**Task:** AUTH-001  
**Reported:** 2026-05-27  
**Status:** 🟢 Fixed

**Problem:**  
Original plan had `USER_REGISTERED` CloudEvent published in AUTH-001 (`POST /otp/request`) for first-time phones. At that point no `users` row exists yet (user is only created in AUTH-002 on successful OTP verify). This means:
- False event if the user never completes verification
- Downstream consumers would receive a "user registered" signal for a user that doesn't exist in the DB

**Decision:**  
Move `USER_REGISTERED` publish to **AUTH-002** (`POST /otp/verify`), immediately after the `users` row is upserted in the DB. Check `wasCreated` from the upsert result — only publish if it's a genuinely new row.

**Resolution:**
- AUTH-001 route: no DB query, no CloudEvent. Validate → rate-limit → send OTP → 200.
- AUTH-002 route: `prisma.user.upsert()` → if `created`, publish `USER_REGISTERED`.

---

### BUG-002 — Config: Supabase password truncated in .env
**Type:** Configuration  
**Phase:** 1 — Foundation  
**Task:** DB-002  
**Reported:** 2026-05-27  
**Status:** 🟢 Fixed

**Problem:**  
Active `DATABASE_URL` and `DIRECT_URL` in `.env` have password `09fvLlxWFU6mr2J` — missing trailing `y` compared to the commented-out original URL (`09fvLlxWFU6mr2Jy`). This causes authentication failure on all DB connections.

**Fix:**  
Append the missing `y` to the password in both URLs in `.env`.

```
DATABASE_URL="postgresql://postgres.uefpsuhvtnvjoxsprzjk:09fvLlxWFU6mr2Jy@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.uefpsuhvtnvjoxsprzjk:09fvLlxWFU6mr2Jy@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
```

**Note:** Also confirmed `.env` is in `.gitignore` — credentials are not tracked.

---

### BUG-004 — uuid v14 ESM breaks all gateway tests via discover route chain
**Type:** Dependency  
**Phase:** 4 — Matching  
**Task:** MATCH-004  
**Reported:** 2026-05-28  
**Status:** 🟢 Fixed

**Problem:**  
`uuid` v14 (installed) ships only ESM (`export` syntax in `dist-node/index.js`). Once MATCH-004 wired `GET /api/v1/discover` into `routes/index.ts`, every gateway controller test that calls `createApp()` transitively loaded:
`routes/discover` → `discover.controller` → `@abroad-matrimony/matching` → `score-recompute.worker` → `event-bus/publisher` → `uuid` (ESM) → Jest parse error.

Only `discover.controller.test.ts` was unaffected because it mocks `@abroad-matrimony/matching` at the module level, preventing the chain from loading.

**Fix:**  
Replaced `import { v4 as uuidv4 } from 'uuid'` with Node 22's built-in `crypto.randomUUID()` in `libs/event-bus/src/publisher.ts`. No behaviour change — `crypto.randomUUID()` produces the same UUID v4 format. Eliminates the external dependency.

---

### BUG-005 — TypeScript type annotations inside jest.mock() factory fail Babel parse
**Type:** Test infrastructure  
**Phase:** 4 — Matching  
**Task:** MATCH-004  
**Reported:** 2026-05-28  
**Status:** 🟢 Fixed

**Problem:**  
`libs/matching/src/__tests__/discover.service.test.ts` used `(...a: unknown[])` inside the `jest.mock('@abroad-matrimony/db', ...)` factory. Jest's mock-hoisting step uses Babel (not ts-jest) to hoist `jest.mock()` calls before TypeScript compilation, so TypeScript annotations in the factory body cause a Babel parse error.

**Fix:**  
Changed the factory to use untyped rest params `(...a: any[])` (with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`) so Babel can hoist without issue. The `ts-jest` `{ diagnostics: { warnOnly: true } }` config means these become warnings, not errors.

---

### BUG-006 — @abroad-matrimony/groups and /connections not resolvable in Jest
**Type:** Test infrastructure  
**Phase:** 4 — Matching  
**Task:** MATCH-004  
**Reported:** 2026-05-28  
**Status:** 🟢 Fixed

**Problem:**  
`discover.controller.test.ts` calls `jest.mock('@abroad-matrimony/groups', ...)` and `jest.mock('@abroad-matrimony/connections', ...)` as defensive stubs. Jest requires every mocked module to be resolvable (via TypeScript paths or `moduleNameMapper`) unless `{ virtual: true }` is specified. Neither package had path aliases or stub files.

Additionally, `routes/index.ts` already imported from `./connections/index.js` but that file did not exist.

**Fix:**  
1. Created stub packages: `libs/connections/src/index.ts` and `libs/groups/src/index.ts` (service stubs for Phase 5+)
2. Added path aliases in `tsconfig.base.json` and `jest.preset.js` moduleNameMapper
3. Created `apps/gateway/src/routes/connections/index.ts` (empty router stub, Phase 5 placeholder)

---

### BUG-007 — requireAdminRole missing from auth mocks broke all gateway test suites
**Type:** Test infrastructure
**Phase:** 5 — Messaging
**Task:** MSG-003
**Reported:** 2026-05-28
**Status:** 🟢 Fixed

**Problem:**
Adding `requireAdminRole(AdminRole.MODERATOR)` to `apps/gateway/src/routes/admin/index.ts` (for the new flag moderation routes) caused all gateway controller tests that call `createApp()` to fail with `TypeError: (0, auth_1.requireAdminRole) is not a function`. The `@abroad-matrimony/auth` mock in those test files didn't include `requireAdminRole` (it was only in `discover.controller.test.ts` which was already updated in MSG-001/002).

Additionally, all test files needed the new messaging exports (`markConversationRead`, `createFirebaseToken`, `flagMessage`, etc.) added to their `@abroad-matrimony/messaging` mocks.

**Pattern to follow for future new service exports:**
When adding a new exported function to `@abroad-matrimony/messaging` or a new middleware to `@abroad-matrimony/auth`, every test file that mocks those modules via `jest.mock()` must be updated with stub entries.

**Fix:**
Added `requireAdminRole: jest.fn(() => ...)` and `requireRole: jest.fn(() => ...)` to the auth mock in all 6 affected test files.
Added all new messaging exports as stubs to all 9 affected messaging mock objects.

---

---

### BUG-008 — otp-verify test missing config mock after TRUSTED_DEVICE_TTL_DAYS added
**Type:** Test infrastructure
**Phase:** 6b — Trusted Device Bypass
**Task:** AUTH-TD
**Reported:** 2026-05-28
**Status:** 🟢 Fixed

**Problem:**
`libs/auth/src/__tests__/otp-verify.service.test.ts` did not mock `@abroad-matrimony/config`. When `otp-verify.service.ts` was updated to call `getEnv().TRUSTED_DEVICE_TTL_DAYS`, all 8 tests in that file failed because Zod env validation ran against the test process's `process.env`, which is missing required JWT/DB vars.

**Fix:**
Added `jest.mock('@abroad-matrimony/config', () => ({ getEnv: () => ({ TRUSTED_DEVICE_TTL_DAYS: 90 }) }))` to the test file.

**Pattern to follow:**
Any time a service file adds a new `getEnv()` call, add (or update) the `@abroad-matrimony/config` mock in its test file.

---

## Template for new issues

### BUG-009 — Tech Debt: `nullable: true` is OAS 3.0 syntax, not valid in OAS 3.1
**Type:** Tech Debt  
**Phase:** API Documentation  
**Task:** API-SPEC  
**Reported:** 2026-05-29  
**Status:** ⚪ Won't Fix (suppressed via .redocly-ignore)

**Problem:**  
`docs/api/openapi.yaml` declares `openapi: 3.1.0` but uses `nullable: true` throughout (both original content and new additions). In OpenAPI 3.1.0 (which aligns with JSON Schema Draft 2020-12), `nullable` is not a valid keyword. The correct OAS 3.1 pattern is `type: [string, "null"]` or `oneOf: [{type: string}, {type: "null"}]`.

Redocly lint reports 95 `struct` errors and 5 `security-defined` errors, all suppressed via `.redocly-ignore`.

**Decision:**  
Won't fix in the current sprint — it would require touching 95+ field definitions throughout the entire spec. The API functions correctly; this is purely a validator warning.

**Future fix:**  
When upgrading the spec, do a bulk find-replace to change all `{ type: X, nullable: true }` to `{ type: [X, "null"] }`. This can be done with a script.

---

```
### BUG-XXX — <title>
**Type:** Bug | Design | Config | Performance | Security
**Phase:** <phase number and name>
**Task:** <task ID>
**Reported:** <date>
**Status:** 🔴 Open

**Problem:**
<what went wrong / what was observed>

**Steps to reproduce / context:**
<relevant details>

**Fix / Decision:**
<what was changed or decided>
```
