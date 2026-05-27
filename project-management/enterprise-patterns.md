# Enterprise Patterns Reference — Abroad Matrimony Backend

> **Source:** mikesparr/enterprise-api-starter-nodejs (adapted for our NX/Prisma/TypeScript stack)
> **Goal:** Production quality at 1M+ users. Every pattern here exists for a reason — do not skip.
> **Last updated:** 2026-05-27

---

## 1. Layered Architecture (Non-Negotiable)

Every HTTP request travels through exactly these layers in order. No skipping, no mixing.

```
Request
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  MIDDLEWARE CHAIN (apps/gateway/src/middleware/)         │
│  1. authenticate   — verify JWT, attach req.user        │
│  2. validateParams — path/query params (fast fail)      │
│  3. authorize      — RBAC permission check              │
│  4. validateBody   — Zod schema on request body         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  ROUTE  (apps/gateway/src/routes/)                       │
│  Defines path + method + middleware chain only.          │
│  Zero business logic. Calls controller.                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  CONTROLLER  (apps/gateway/src/controllers/)             │
│  - Parse validated req into service call args           │
│  - Call service function(s)                             │
│  - Format ApiResponse<T> and send HTTP response         │
│  - catch(next) for error propagation                    │
│  Zero business logic. Zero direct DB calls.             │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  SERVICE  (libs/<domain>/src/)                           │
│  - All business logic lives here                        │
│  - Calls Prisma (via libs/db), Redis (via libs/cache)   │
│  - Publishes events (via libs/event-bus)                │
│  - Uses adapters for external services                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  DATA LAYER  (libs/db — Prisma)                          │
│  - All DB queries go through Prisma client              │
│  - No raw SQL unless absolutely necessary               │
│  - No Prisma imports in controllers or routes           │
└─────────────────────────────────────────────────────────┘
```

### Layer rules (violations are bugs, not style issues)
- **Routes** — only: `router.post('/path', ...middlewares, controller.method)`
- **Controllers** — only: parse req → call service → send response. If you're writing `if/else` business logic here, it belongs in the service.
- **Services** — business logic, no Express types (`req`, `res`, `next`). Fully testable without HTTP.
- **Data layer** — only Prisma. No raw queries unless Prisma genuinely can't do it.

---

## 2. Directory Structure Per App

```
apps/gateway/src/
├── routes/
│   ├── index.ts              ← mounts all routers
│   ├── auth/
│   │   ├── index.ts          ← auth router (path + middleware chain)
│   │   └── STANDARDS.md      ← route standards for this domain
│   └── profile/
│       ├── index.ts
│       └── STANDARDS.md
│
├── controllers/
│   ├── auth/
│   │   ├── otp.controller.ts
│   │   └── STANDARDS.md
│   └── profile/
│       └── STANDARDS.md
│
├── middleware/
│   ├── auth.middleware.ts    ← authenticate (requireAuth)
│   ├── rbac.middleware.ts    ← authorize (requireRole, requireAdminRole)
│   ├── validate.middleware.ts← validateBody(schema) factory
│   ├── request-id.middleware.ts ← X-Request-ID propagation
│   ├── error.middleware.ts   ← global error handler
│   ├── not-found.middleware.ts
│   └── STANDARDS.md
│
├── schemas/                  ← Zod schemas (shared across routes)
│   └── auth/
│       └── otp-request.schema.ts
│
└── constants/
    └── index.ts              ← HTTP_STATUS, ERROR_CODES (expand per domain)
```

---

## 3. STANDARDS.md Requirement

Every directory under `routes/`, `controllers/`, `middleware/` **must** have a `STANDARDS.md` file.
It must contain: purpose, conventions, example, anti-patterns.
Keep it short (< 50 lines) but complete enough to onboard a new engineer in 5 minutes.

Template:
```markdown
# {Directory} Standards

## Purpose
One sentence.

## Conventions
- Convention 1
- Convention 2

## Example
(minimal code snippet)

## Anti-patterns
- What NOT to do and why
```

---

## 4. Cloud-Agnostic Adapter Pattern

Every external service integration (OTP, email, push, storage, payments) must follow this pattern.
This allows swapping providers without touching business logic — critical for 1M+ user scale.

```
libs/<domain>/src/adapters/
├── base.<service>.adapter.ts    ← abstract interface (TypeScript abstract class or interface)
├── twilio.<service>.adapter.ts  ← Twilio implementation
├── mock.<service>.adapter.ts    ← Mock implementation (dev/test)
└── index.ts                     ← factory: returns correct adapter from env config
```

### Example: OTP adapter

```typescript
// base.otp.adapter.ts
export interface OtpAdapter {
  send(phone: string): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
}

// twilio.otp.adapter.ts
export class TwilioOtpAdapter implements OtpAdapter { ... }

// mock.otp.adapter.ts — used in dev and tests
export class MockOtpAdapter implements OtpAdapter {
  async send(phone: string) { logger.info('[MOCK OTP]', { phone }); }
  async verify(_phone: string, code: string) { return code === '000000'; }
}

// index.ts — factory
export function createOtpAdapter(): OtpAdapter {
  return env.TWILIO_ACCOUNT_SID
    ? new TwilioOtpAdapter(env)
    : new MockOtpAdapter();
}
```

### Adapters by domain

| Domain | Adapters |
|--------|---------|
| `libs/auth` | `OtpAdapter` (Twilio / Mock) |
| `libs/notification` | `EmailAdapter` (Brevo / Mock), `SmsAdapter` (Twilio / Mock), `PushAdapter` (Firebase / Mock) |
| `libs/storage` | `StorageAdapter` (S3 / Local / Mock) |
| `libs/payment` | `PaymentAdapter` (Stripe / Razorpay / Mock) |

---

## 5. No Magic Strings

**Rule:** Never compare against a hardcoded string. Never return a hardcoded error message inline.
Everything goes into constants.

```typescript
// ❌ WRONG
if (user.role === 'SUSPENDED') { ... }
throw new Error('User not found');
res.status(429).json({ error: 'Too many requests' });

// ✅ CORRECT
if (user.role === UserRole.SUSPENDED) { ... }
throw new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, AUTH_ERRORS.USER_NOT_FOUND);
```

### Constant files

```
apps/gateway/src/constants/
├── index.ts           ← HTTP_STATUS, ERROR_CODES (existing)
├── auth.constants.ts  ← AUTH_ERRORS, AUTH_MESSAGES
├── profile.constants.ts
└── ...
```

Add domain-specific constants as each Phase is built.

---

## 6. Request Tracing

Every request must get a unique `X-Request-ID` header. It must be:
- Set by the middleware if not provided by client
- Attached to every log entry for that request
- Returned in the response header
- Included in every `AppError` response body

```typescript
// middleware/request-id.middleware.ts
app.use((req, res, next) => {
  const id = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
});
```

The `requestId` must flow through to all child loggers: `createChildLogger({ module: 'auth:otp', requestId })`.

---

## 7. Response Compression

Add `compression` middleware to the gateway before routes. This alone gives 60–80% payload reduction at scale.

```bash
npm install compression @types/compression
```

```typescript
import compression from 'compression';
app.use(compression());
```

Add this to `apps/gateway/src/app.ts` after body parser, before routes.

---

## 8. OpenAPI 3.0 Documentation

Every endpoint must have an OpenAPI spec entry. This is both documentation AND contract.

```
apps/gateway/
└── api-docs/
    ├── index.yaml             ← root, references all paths + schemas
    ├── paths/
    │   ├── auth.yaml
    │   ├── profile.yaml
    │   └── ...
    └── schemas/
        ├── common.yaml        ← ApiResponse, Error, Pagination
        ├── auth.yaml          ← OtpRequest, OtpVerify, TokenPair
        └── ...
```

Serve via Swagger UI in dev: `GET /api-docs`.
Start this from Phase 2 so we don't accumulate OpenAPI debt.

---

## 9. Event Logging — Every API Interaction

Based on W3C Activity Streams + CloudEvents 1.0.2. Every state-changing API call must emit an event.

```
actor (who did it) + verb (what happened) + object (what was affected)
```

Examples:
```
user.+918000000001 REQUESTED_OTP phone:+918000000001
user.abc123        VERIFIED_PHONE user:abc123
user.abc123        UPDATED_PROFILE profile:xyz456
admin.admin123     SUSPENDED_USER user:victim456
```

The `event_logs` table (already in our schema) stores every event for audit trails.
The BullMQ event bus publishes them asynchronously — callers never block.

---

## 10. Pagination Standards

| Table size | Strategy | Implementation |
|-----------|----------|----------------|
| < 100k rows | Offset (`limit` + `offset`) | Simple, fine for admin views |
| 100k – 10M rows | Cursor (opaque `cursor` token) | Required for user-facing feeds |
| 10M+ rows | Cursor + denormalization | Score cache, pre-computed feeds |

**Default:** cursor-based for all user-facing endpoints.
Cursor = base64-encoded `{ id, createdAt }` of last item.
Never expose raw DB IDs or timestamps as cursor values.

---

## 11. Security Checklist Per Endpoint

Before marking any endpoint Done, verify:

- [ ] Input validated with Zod before any processing
- [ ] Rate-limited (global + domain-specific where needed)
- [ ] Auth middleware applied (requireAuth on all non-public routes)
- [ ] RBAC middleware applied (requireRole / requireAdminRole where needed)
- [ ] 404 returned before 403 (check resource exists before checking permission)
- [ ] No PII in log messages (phone masked, no tokens/passwords)
- [ ] Error responses use `AppError` with `ERROR_CODES` constants (no inline strings)
- [ ] Request ID included in error response for traceability

---

## 12. File Size Discipline

- **Target:** < 300 lines per file
- **Hard limit:** 500 lines — if you exceed this, split the file
- **How to split:** extract helper functions, sub-services, or adapter implementations

Large files are a code smell that usually means mixed concerns.

---

## 13. Testing Checklist Per Endpoint

Based on the reference project's critical-path test suite model:

**Unit tests (in libs/):**
- [ ] Service function — happy path
- [ ] Service function — each validation/business rule error
- [ ] Service function — external adapter failure (simulated)
- [ ] Adapter — each provider implementation (mock + real)

**Integration tests (in apps/gateway/):**
- [ ] 200/201 — happy path with correct response shape
- [ ] 400 — each invalid field (separate test per field)
- [ ] 401 — missing/invalid token
- [ ] 403 — insufficient role
- [ ] 404 — resource not found (before 403 check)
- [ ] 409 — conflict (duplicate resource)
- [ ] 429 — rate limit exceeded
- [ ] 500 — simulated downstream failure

**Test file discipline:**
- One `describe` per function/endpoint
- One `it` per behaviour (name describes expected outcome)
- AAA pattern: Arrange → Act → Assert
- `afterEach` / `afterAll` clean up any created test data
- Never share mutable state between tests

---

## 14. Middleware Order of Operations

This order is **fixed**. Deviating causes security holes or confusing errors.

```
1. request-id         ← attach X-Request-ID before anything else
2. helmet             ← security headers
3. cors               ← CORS policy
4. compression        ← compress responses
5. express.json()     ← parse body
6. global rate-limit  ← coarse IP/global throttle
7. authenticate       ← verify JWT (sets req.user)  [route-level]
8. validateParams     ← path + query params         [route-level]
9. authorize          ← RBAC check                  [route-level]
10. validateBody      ← Zod body schema             [route-level]
11. controller        ← execute handler
12. error middleware  ← catch all
13. not-found         ← 404 fallback
```

---

## 15. Admin vs User Endpoint Separation

| Concern | User API | Admin API |
|---------|----------|-----------|
| Prefix | `/api/v1/` | `/admin/` |
| Auth | `requireAuth` (UserRole JWT) | `requireAdminRole` (AdminRole JWT) |
| JWT secret | `JWT_ACCESS_SECRET` | `ADMIN_JWT_SECRET` |
| Rate limit | Per-user + global | Per-admin + global |
| Audit log | CloudEvent only | CloudEvent + `audit_logs` table write |
| File prefix | `auth.controller.ts` | `admin.auth.controller.ts` |

---

## 16. Impersonation (Phase 8)

Admin impersonation must be scope-limited and fully auditable.
- Admin → any user (system impersonation)
- Manager → sub-group members only (hierarchy-based)
- Cannot impersonate: self, peers, superiors
- Every impersonated action carries full impersonation chain in event actor field
- JWT re-issued with impersonation context; original identity preserved

---

## Adoption Priority

| Pattern | When to adopt | Status |
|---------|--------------|--------|
| Layered arch (Route/Controller/Service) | AUTH-001 onwards | 🔄 Adopting now |
| STANDARDS.md files | AUTH-001 onwards | 🔄 Adopting now |
| No magic strings | AUTH-001 onwards | 🔄 Adopting now |
| Request tracing ID | AUTH-001 onwards | 🔄 Adopting now |
| Compression middleware | AUTH-001 (gateway) | 🔄 Adopting now |
| Cloud-agnostic adapters | AUTH-001 (OTP adapter) | 🔄 Adopting now |
| Security checklist per endpoint | AUTH-001 onwards | 🔄 Adopting now |
| OpenAPI 3.0 docs | Phase 2 complete (batch) | ⏳ Phase 2 end |
| Cursor pagination | MATCH-004 (discover feed) | ⏳ Phase 4 |
| Impersonation | ADMIN-002 | ⏳ Phase 8 |
