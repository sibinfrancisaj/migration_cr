# Notion Project Setup — Abroad Matrimony Backend

## Database: Tasks

Create a **Database** in Notion named `AM Tasks` with the following properties:

| Property | Type | Options / Notes |
|----------|------|----------------|
| **Task ID** | Text | Manual — use format `DOMAIN-NNN` (e.g. `AUTH-001`) |
| **Title** | Title | Short description of the task |
| **Description** | Text | Full context, acceptance criteria |
| **Domain** | Select | `AUTH`, `MATCH`, `NOTIF`, `PAY`, `PROF`, `GROUP`, `MSG`, `ADMIN`, `INFRA`, `LOG`, `FLAG` |
| **Status** | Select | `Backlog`, `In Progress`, `In Review`, `Done`, `Blocked` |
| **Priority** | Select | `Critical`, `High`, `Medium`, `Low` |
| **Epic** | Select | `Phase 1 – Foundation`, `Phase 2 – Core Features`, `Phase 3 – Community`, `Phase 4 – Monetisation`, `Phase 5 – Analytics & Ops` |
| **Branch** | Text | e.g. `feat/AUTH-001-phone-otp-flow` |
| **PR Link** | URL | GitHub PR URL |
| **Commit IDs** | Text | Space-separated short SHAs |
| **Assignee** | Person | — |
| **Created** | Created time | Auto |
| **Updated** | Last edited time | Auto |
| **Notes** | Text | Implementation notes, blockers, decisions |

---

## Views to create

1. **Board view** — grouped by `Status` — the sprint board
2. **Table view** — filtered by `Domain` — per-service backlog
3. **Gallery view** — filtered by `Priority = Critical` — hot items
4. **Timeline view** — ordered by `Created` — progress timeline

---

## Initial Sprint 1 Tasks (Phase 1 – Foundation)

Import or create these tasks:

| Task ID | Title | Domain | Priority | Epic |
|---------|-------|--------|----------|------|
| INFRA-001 | NX monorepo setup + root config | INFRA | Critical | Phase 1 |
| INFRA-002 | Docker Compose (Redis + Postgres local dev) | INFRA | Critical | Phase 1 |
| INFRA-003 | GitHub Actions CI pipeline | INFRA | High | Phase 1 |
| INFRA-004 | CodeRabbit + PR template | INFRA | High | Phase 1 |
| INFRA-005 | .env.example + Zod env validation | INFRA | Critical | Phase 1 |
| DB-001 | Full Prisma schema — all tables | INFRA | Critical | Phase 1 |
| DB-002 | Supabase migration (initial) | INFRA | Critical | Phase 1 |
| LOG-001 | Winston structured logging (libs/logger) | LOG | High | Phase 1 |
| LOG-002 | OpenTelemetry setup | LOG | Medium | Phase 1 |
| INFRA-006 | libs/cache — Redis client + helpers | INFRA | High | Phase 1 |
| INFRA-007 | libs/event-bus — CloudEvents + WAL publisher | INFRA | High | Phase 1 |
| AUTH-001 | OTP request endpoint (Twilio Verify) | AUTH | Critical | Phase 1 |
| AUTH-002 | OTP verify + JWT issue (access + refresh) | AUTH | Critical | Phase 1 |
| AUTH-003 | Refresh token rotation | AUTH | Critical | Phase 1 |
| AUTH-004 | Logout (single device + all devices) | AUTH | High | Phase 1 |
| AUTH-005 | JWT middleware (gateway protect routes) | AUTH | Critical | Phase 1 |
| AUTH-006 | Admin auth (email + password + TOTP) | AUTH | High | Phase 1 |
| AUTH-007 | RBAC middleware (user roles) | AUTH | Critical | Phase 1 |
| AUTH-008 | Admin RBAC middleware | AUTH | High | Phase 1 |
| PROF-001 | Create profile after OTP verification | PROF | Critical | Phase 1 |
| PROF-002 | Real Life answers API (all 12 questions) | PROF | Critical | Phase 1 |
| PROF-003 | Story prompt answers API | PROF | High | Phase 1 |
| PROF-004 | Photo upload (S3 + metadata) | PROF | High | Phase 1 |
| PROF-005 | Profile completion score calculation | PROF | Medium | Phase 1 |
| PROF-006 | Get my profile + Get user profile | PROF | Critical | Phase 1 |

---

## Sprint 2 Tasks (Phase 2 – Core Features)

| Task ID | Title | Domain | Priority | Epic |
|---------|-------|--------|----------|------|
| MATCH-001 | Weighted scoring algorithm v1 | MATCH | Critical | Phase 2 |
| MATCH-002 | Batch score job (worker-matching) | MATCH | Critical | Phase 2 |
| MATCH-003 | On-demand score lookup (Redis-cached) | MATCH | High | Phase 2 |
| MATCH-004 | Browse/discover feed endpoint | MATCH | Critical | Phase 2 |
| MATCH-005 | Feature flag gate for algorithm v2 | MATCH | Medium | Phase 2 |
| GROUP-001 | Create group + assign members | GROUP | Critical | Phase 2 |
| GROUP-002 | Weekly intro drop job | GROUP | Critical | Phase 2 |
| GROUP-003 | Group listing + member list | GROUP | High | Phase 2 |
| CONN-001 | Send connect request | MSG | Critical | Phase 2 |
| CONN-002 | Respond to connect (accept/decline) | MSG | Critical | Phase 2 |
| CONN-003 | Mutual match creation on accept | MSG | Critical | Phase 2 |
| MSG-001 | Create conversation on match | MSG | Critical | Phase 2 |
| MSG-002 | Send message (REST) | MSG | Critical | Phase 2 |
| MSG-003 | Real-time messaging (WebSocket) | MSG | High | Phase 2 |
| MSG-004 | Read receipts (symmetric) | MSG | Medium | Phase 2 |
| VER-001 | Submit verification request (ID + selfie) | AUTH | High | Phase 2 |
| VER-002 | Admin verification review queue | ADMIN | High | Phase 2 |
| VER-003 | Approve/reject verification + badge | ADMIN | High | Phase 2 |
| NOTIF-001 | Notification service — Brevo email adapter | NOTIF | High | Phase 2 |
| NOTIF-002 | Notification service — Twilio SMS adapter | NOTIF | High | Phase 2 |
| NOTIF-003 | Notification service — Firebase push adapter | NOTIF | High | Phase 2 |
| NOTIF-004 | Notification worker (BullMQ processor) | NOTIF | High | Phase 2 |

---

## Sprint 3 Tasks (Phase 3 – Community + Engagement)

| Task ID | Title | Domain | Priority | Epic |
|---------|-------|--------|----------|------|
| CHECK-001 | Sunday check-in submit endpoint | PROF | High | Phase 3 |
| CHECK-002 | Check-in reminder (Sunday push/email) | NOTIF | High | Phase 3 |
| EVENT-001 | Create/edit/cancel events (admin) | GROUP | Medium | Phase 3 |
| EVENT-002 | Event listing + RSVP | GROUP | Medium | Phase 3 |
| FLAG-001 | Report user / flag content | ADMIN | High | Phase 3 |
| FLAG-002 | Admin moderation queue | ADMIN | High | Phase 3 |

---

## Sprint 4 Tasks (Phase 4 – Monetisation)

| Task ID | Title | Domain | Priority | Epic |
|---------|-------|--------|----------|------|
| PAY-001 | Stripe — Founding Member checkout | PAY | Critical | Phase 4 |
| PAY-002 | Stripe webhook handler | PAY | Critical | Phase 4 |
| PAY-003 | Razorpay — India payment | PAY | Critical | Phase 4 |
| PAY-004 | Razorpay webhook handler | PAY | Critical | Phase 4 |
| PAY-005 | Membership activation on payment | PAY | Critical | Phase 4 |
| PAY-006 | Diamond ledger — purchase | PAY | High | Phase 4 |
| PAY-007 | Diamond ledger — feature unlock | PAY | High | Phase 4 |
| PAY-008 | Subscription expiry job | PAY | High | Phase 4 |

---

## Sprint 5 Tasks (Phase 5 – Admin + Analytics)

| Task ID | Title | Domain | Priority | Epic |
|---------|-------|--------|----------|------|
| ADMIN-001 | Admin UI scaffold (React + Ant Design + Vite) | ADMIN | High | Phase 5 |
| ADMIN-002 | Admin dashboard KPIs | ADMIN | High | Phase 5 |
| ADMIN-003 | User management (search, view, suspend) | ADMIN | Critical | Phase 5 |
| ADMIN-004 | Feature flag management UI | FLAG | High | Phase 5 |
| ADMIN-005 | Audit log viewer | ADMIN | Medium | Phase 5 |
| ADMIN-006 | Analytics — verified rate, RL completion | ADMIN | High | Phase 5 |
| ADMIN-007 | Analytics — check-in rate, conversation rate | ADMIN | High | Phase 5 |
| LOG-003 | Grafana + Prometheus dashboard | LOG | Medium | Phase 5 |
| LOG-004 | Sentry error tracking integration | LOG | Medium | Phase 5 |

---

## How to use Task IDs in commits

Every commit referencing a task must include the ticket ID in the commit message:

```
feat(AUTH-001): implement OTP request endpoint

- POST /api/v1/auth/otp/request
- Rate limited: 3 per phone per hour (Redis)
- Twilio Verify integration

TICKET: AUTH-001
```

Branch naming:
```
feat/AUTH-001-phone-otp-request
fix/MATCH-042-null-score-crash
chore/INFRA-003-ci-pipeline
```
