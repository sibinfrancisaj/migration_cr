## Summary

<!-- Brief description of what this PR does -->

**Ticket:** <!-- e.g. AUTH-001, MATCH-042 -->
**Type:** <!-- feat | fix | chore | refactor | test | docs -->
**Branch:** <!-- e.g. feat/AUTH-001-phone-otp-flow -->

---

## Changes

-
-

---

## Test plan

- [ ] `yarn nx test <project>` — all tests pass
- [ ] `yarn nx lint <project>` — no lint errors
- [ ] `yarn nx typecheck <project>` — TypeScript clean
- [ ] Tested locally against Docker Redis + Supabase

---

## Notes for reviewer

<!-- Anything non-obvious the reviewer should know -->

---

## Checklist

- [ ] No hardcoded secrets, passwords, or API keys
- [ ] No `console.log` left in production code (use `logger`)
- [ ] Zod validation added for all new request inputs
- [ ] New env vars added to `.env.example`
- [ ] Error responses use structured `ApiError` format
- [ ] New CloudEvents follow the schema in `libs/event-bus`
- [ ] Feature-flag gated if experimental
