# Abroad Matrimony — Bug & Issue Tracker

> **Status:** 🔴 Open · 🟡 In Progress · 🟢 Fixed · ⚪ Won't Fix · 🔵 Decision / Design Change

---

## Active Issues

| ID      | Type       | Phase | Task    | Title                                              | Status  | Reported    |
|---------|------------|-------|---------|----------------------------------------------------|---------|-------------|
| BUG-001 | Design     | P2    | AUTH-001| USER_REGISTERED event fired before user exists in DB | 🟢 Fixed | 2026-05-27 |
| BUG-002 | Config     | P1    | DB-002  | .env DATABASE_URL / DIRECT_URL password truncated  | 🟢 Fixed | 2026-05-27 |
| BUG-003 | Dependency | P1    | INFRA   | OpenTelemetry peer conflict blocks npm install      | 🟢 Fixed | 2026-05-27 |

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

## Template for new issues

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
