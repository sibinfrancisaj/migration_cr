# Pending Operator Tasks

> Created: 2026-08-18  
> These are tasks that **cannot be done by Claude** — they require your local machine (Supabase access, secret setup, etc.).  
> Check off each item as you complete it.

---

## 1. Database Migrations (run on local machine)

All of the following require:
```bash
npx prisma db push --schema=libs/db/prisma/schema.prisma
```

Run this **once** — it applies all pending schema changes in one shot (Prisma db push is idempotent).

| Schema change | Added in | Status |
|---|---|---|
| `Profile.habitSummaryVisible Boolean @default(false)` | Phase 9 | ⏳ |
| `ProfileView` model (new — phase 14 signals dashboard) | Phase 14 | ⏳ |
| `Profile.privacySettings Json?` | Phase 15 | ⏳ |
| `MatchScore.implicitBoost Float @default(0)` | Phase 20 RAG-013 | ⏳ |
| `RealLifeAnswer.importance Int @default(3)` | Phase 20 RAG-013 | ⏳ |
| `ProfileEmbedding.storyEmbedding Unsupported("vector(1536)")?` | Phase C (multi-vector) | ⏳ |
| `ProfileEmbedding.habitsEmbedding Unsupported("vector(1536)")?` | Phase C (multi-vector) | ⏳ |

After pushing: regenerate the Prisma client:
```bash
npx prisma generate --schema=libs/db/prisma/schema.prisma
```

---

## 2. HNSW Vector Indexes (run against Supabase)

After `prisma db push`, run this SQL in the Supabase SQL editor (or via `psql`):

```bash
# File already generated:
cat docs/migrations/001_hnsw_indexes.sql
```

Or paste directly into **Supabase Dashboard → SQL Editor**:

```sql
-- From docs/migrations/001_hnsw_indexes.sql
-- Creates 3 HNSW indexes on profile_embeddings for fast ANN queries
```

This enables the pgvector ANN cold-start (RAG-004) and RRF fusion (RAG-003) to run at query time instead of falling back to random candidates.

| Index | Column | Status |
|---|---|---|
| `idx_profile_embeddings_personality_hnsw` | `personality_embedding` | ⏳ |
| `idx_profile_embeddings_story_hnsw` | `story_embedding` | ⏳ |
| `idx_profile_embeddings_habits_hnsw` | `habits_embedding` | ⏳ |

---

## 3. Env Vars — add to `.env` (local) and production secrets

These vars are defined in `libs/config/src/env.ts` and `.env.example` but need real values set:

| Var | Where needed | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `libs/ai` | Required for profile intelligence, embeddings, Whisper, intro grouping. All AI paths are no-ops if absent. |
| `GOOGLE_VISION_API_KEY` | `libs/moderation` | Required for photo SafeSearch moderation. Upload still works without it (fail-open). |
| `SEEDER_SECRET` | `apps/seeder` + `apps/gateway` | Random secret — generate with `openssl rand -hex 32`. Used for seeder-auth gateway bypass. |
| `STRIPE_FOUNDING_MEMBER_PRICE_ID` | `libs/payment` | Stripe dashboard → Products → Founding Member price ID. |
| `STRIPE_WEBHOOK_SECRET` | `libs/payment` | `stripe listen --forward-to localhost:3000/api/v1/payment/stripe/webhook` to get local secret. |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | `libs/payment` | Razorpay dashboard → Settings → API Keys. |
| `RAZORPAY_WEBHOOK_SECRET` | `libs/payment` | Razorpay dashboard → Webhooks → secret. |
| `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | `libs/firebase` | Service account JSON from Firebase console → Project settings → Service accounts. |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` + `AWS_S3_BUCKET` | `libs/storage` | IAM user with S3 + CloudFront permissions. |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_VERIFY_SERVICE_SID` + `TWILIO_PHONE_NUMBER` | `libs/notification` | Twilio console. |
| `BREVO_API_KEY` | `libs/notification` | Brevo (Sendinblue) dashboard → SMTP & API → API Keys. |

---

## 4. Stripe Diamond Price IDs — hardcode check

The diamond packages in `libs/payment/src/diamond.service.ts` have Stripe `priceId` values embedded in code. Before going live, verify these match your Stripe dashboard's **test** and **live** price IDs, or move them to env vars.

---

## 5. Firestore Security Rules — deploy

The security rules doc is at `docs/firestore-security-rules.md`.  
Copy the rules from that file and deploy them in **Firebase Console → Firestore → Rules**.

---

## 6. S3 Seeder Photos — upload

The seeder picks profile photos from S3 at prefix `seeder/profile-photos/male/` and `seeder/profile-photos/female/`.  
You need to upload a batch of face photos (CC-licensed or your own) to that S3 prefix before running the seeder.

```bash
aws s3 sync ./local-photos/male   s3://<bucket>/seeder/profile-photos/male/
aws s3 sync ./local-photos/female s3://<bucket>/seeder/profile-photos/female/
```

---

## 7. OpenAPI Spec Gaps (code fix — moderate priority)

These are spec-only issues found in the 2026-08-18 audit. No backend code change needed.

| Gap | File | Fix needed |
|---|---|---|
| `PUT /connections/{id}/pass` in spec — route is `PUT /decline` | `docs/api/openapi.yaml` | Rename path + update description |
| `DELETE /connections/{id}` (withdraw) missing from spec | `docs/api/openapi.yaml` | Add path block |
| Verification spec has `/id-document` + `/selfie` as separate POSTs — actual is single `POST /verification` | `docs/api/openapi.yaml` | Rewrite verification paths |
| `GET /verification/upload-url` missing from spec | `docs/api/openapi.yaml` | Add path block |
| `GET /verification/trust-score` missing from spec | `docs/api/openapi.yaml` | Add path block |

---

## 8. Phase 17 — Vector Search Enhancements (not started)

These tasks require code changes and were deferred. Partial Phase 20 work covers VEC-001 and VEC-004:

| Task | Description | Status |
|---|---|---|
| VEC-001 | ANN cold-start in discovery | ✅ Done (RAG-004) |
| VEC-002 | Group description embeddings — new `GroupEmbedding` Prisma model | ⏳ Not started |
| VEC-003 | `listSuggestedGroups()` using ANN group-vs-user embedding similarity | ⏳ Not started |
| VEC-004 | `generateWhyThisMatchLLM()` richer cards | ✅ Done (INTRO-006) |
| VEC-005 | Admin `GET /admin/users/:id/similar` — top-N similar users by embedding | ⏳ Not started |

---

## 9. E2E Test Scaffold

`apps/e2e/` exists as an untracked directory (empty scaffold from Phase 8+ planning).  
No E2E tests have been written. When you're ready to add them:
- Framework: TBD (Playwright or k6 recommended for API-heavy flows)
- Critical journeys to cover: registration → OTP → profile → discover → connect → message

---

## 10. SonarCloud Token

`SONAR_TOKEN` must be set in GitHub Secrets for CI quality gate to run.  
Dashboard: https://sonarcloud.io — connect the `sibinfrancisaj/migration_cr` repo.
