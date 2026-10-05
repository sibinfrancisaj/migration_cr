# E2E Journey Tests

API journey tests for the Abroad Matrimony gateway. These hit a **real running gateway** — they are not unit tests.

## Prerequisites

1. Gateway running: `cd apps/gateway && npm run dev` (port 3000)
2. Redis running: `npm run docker:up`
3. Seeder has been run to create test users: `POST http://localhost:3100/seed/run`
4. `.env` has `SEEDER_SECRET` set

## Running

```bash
# From the monorepo root
E2E_ENABLED=true E2E_SEEDER_SECRET=<your-secret> npx jest --projects apps/e2e --runInBand

# Or via the e2e app script
cd apps/e2e
E2E_ENABLED=true E2E_SEEDER_SECRET=<your-secret> npm test
```

## Environment Variables

| Variable            | Required | Default                   | Description                                      |
|---------------------|----------|---------------------------|--------------------------------------------------|
| `E2E_ENABLED`       | yes      | —                         | Must be `true` to run (prevents accidental runs) |
| `E2E_SEEDER_SECRET` | yes      | —                         | Must match gateway `SEEDER_SECRET`               |
| `E2E_GATEWAY_URL`   | no       | `http://localhost:3000`   | Gateway base URL                                 |
| `E2E_USER_A_ID`     | no       | auto-discovered from DB   | UUID of seeded MEMBER user A                     |
| `E2E_USER_B_ID`     | no       | auto-discovered from DB   | UUID of seeded MEMBER user B                     |
| `E2E_ADMIN_USER_ID` | no       | auto-discovered from DB   | UUID of SUPERADMIN user                          |

## Journeys

| File                              | What it tests                                         |
|-----------------------------------|-------------------------------------------------------|
| `01-health.test.ts`               | `/health`, public 404/401 behaviour                   |
| `02-profile.test.ts`              | Read own profile, read others, match tuning           |
| `03-discovery.test.ts`            | Feed shape, score order, cursor pagination            |
| `04-notifications.test.ts`        | Get/update notification preferences                   |
| `05-groups.test.ts`               | List groups, get group, members                       |
| `06-habits.test.ts`               | Log habit, streak, weekly reflection                  |
| `07-payment.test.ts`              | Membership status, diamond balance (read-only)        |
| `08-admin.test.ts`                | Queue health, analytics KPI, AI status, user listing  |
| `09-partner-preferences.test.ts`  | Set partner prefs, signals week + momentum            |

## Architecture

- **Auth**: Tests authenticate as seeder-created users via the `SEEDER_SECRET` bypass (ADR-014). No OTP required.
- **Admin tests**: Authenticate as SUPERADMIN using the same bypass.
- **Isolation**: Tests use `Promise.allSettled` patterns — one failing journey doesn't abort others.
- **Idempotent**: Safe to run multiple times. Habit log tests accept 409 (already logged today).
