# Abroad Matrimony — Future Plans & Additions

> Ideas, improvements, and work not yet scoped into the main phases.
> Each item has a rough priority and the phase it would slot into.

---

## Architecture & Infrastructure

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-001 | Redis Cluster / Redis Cloud for production         | High     | Currently using single local Redis; needs HA setup before prod |
| F-002 | Migrate from session pooler to Supabase direct URL | Medium   | DIRECT_URL currently on pooler (IPv4 constraint); upgrade when IPv6 available |
| F-003 | Rate limiter using Lua script (atomic INCR+EXPIRE) | Medium   | Current Redis rate limiter has minor TOCTOU window; Lua script closes it |
| F-004 | Distributed tracing across workers                | Low      | OTel spans currently gateway-only; extend to BullMQ workers |
| F-005 | Health check endpoint v2 (deep health)            | Low      | Current `/health` is shallow; add Redis, DB, and queue ping |
| F-006 | Kubernetes / Helm charts                          | Low      | Post-MVP; Docker Compose sufficient for now |

---

## Auth & Security

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-007 | Email OTP / magic link as fallback                | Medium   | Some users may not have a working phone for SMS |
| F-008 | IP-based rate limiting on OTP endpoint             | High     | Current limit is per-phone; add per-IP limit to prevent SIM enumeration |
| F-009 | Refresh token family invalidation (full tree)     | Medium   | ADR-005 covers reuse detection; full family tree is an enhancement |
| F-010 | TOTP setup flow for regular users (2FA)           | Low      | Currently only admin TOTP; could extend to power users |
| F-011 | Device trust elevation (trusted device flow)      | Low      | `devices.isTrusted` field exists; trust grant flow not yet designed |

---

## Profile & Matching

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-012 | Scoring algorithm v2 (ML-based or feedback-tuned) | Medium   | Feature-flagged in MATCH-005; design to follow after v1 data |
| F-013 | Profile "boost" feature (temporary visibility bump)| Low     | Requires diamond spend; design with PAY team |
| F-014 | Partner preference filters (age range, city, etc.)| High     | Discovery feed currently score-only; filters needed for UX |
| F-015 | Profile photo ordering / reordering               | Medium   | `media.order` field exists; drag-and-drop reorder API needed |
| F-016 | Voice intro / video intro playback                | Low      | `MediaType.VOICE_INTRO` and `VIDEO_INTRO` exist in schema |

---

## Groups & Engagement

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-017 | Check-in streak tracking + rewards                | Medium   | Sunday check-ins exist; streak bonus on scoring is a future hook |
| F-018 | Group chat (broadcast from admin)                 | Low      | Not the same as 1-1 messaging; admin → group member notifications |
| F-019 | Event RSVP reminders (push + email)               | Medium   | `EventRsvp` model exists; reminder job not yet designed |

---

## Notifications

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-020 | Notification preferences per user                 | Medium   | Currently no user-level channel opt-out; needs preferences table |
| F-021 | Email unsubscribe link + one-click opt-out         | High     | Legal / CAN-SPAM requirement before sending marketing emails |
| F-022 | In-app notification bell / badge count             | Medium   | `NotificationChannel.IN_APP` exists; read/unread API needed |

---

## Payments

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-023 | Subscription renewal reminders (3d / 1d before)  | High     | BullMQ job triggered on `expiresAt` |
| F-024 | Promo codes / discount system                     | Low      | Stripe coupons or custom code table |
| F-025 | Revenue analytics (MRR, churn, LTV)               | Medium   | Admin dashboard ADMIN-007 will include; needs aggregation queries |

---

## Admin & Ops

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-026 | Admin panel frontend (React)                      | Medium   | Backend API (Phase 8) must be done first |
| F-027 | Automated DB backups + point-in-time restore      | High     | Supabase has this; verify it's enabled on project |
| F-028 | Canary deployments via feature flags              | Low      | `allowedEnvironments` in FeatureFlag already supports this pattern |
| F-029 | GDPR data export + account deletion flow          | High     | Legal requirement; `deletedAt` soft-delete field exists in `users` |

---

## Technical Debt

| ID    | Title                                              | Priority | Notes |
|-------|----------------------------------------------------|----------|-------|
| F-030 | Add `project.json` NX configs per lib/app         | Low      | Currently NX infers from package.json; explicit configs give more control |
| F-031 | Replace `yarn.lock` leftover with npm-only setup  | Low      | `yarn.lock` still in repo alongside `package-lock.json` after conversion |
| F-032 | Per-package jest configs (vs single root config)  | Low      | Root jest.config works; per-package configs enable `nx affected` for tests |
