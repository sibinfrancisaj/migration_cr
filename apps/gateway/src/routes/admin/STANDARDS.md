# Admin Routes — Standards

## Purpose
Define the `/admin/*` route tree.  Path definitions + middleware chain only — zero logic.

## Conventions
- All routes must declare their middleware chain explicitly (validate, requireAdminRole, etc.)
- Protected admin routes use `requireAdminRole(AdminRole.SUPERADMIN)` or the minimum role needed
- Public admin routes (login) need no auth middleware

## Route layout
```
/admin
  /auth
    POST /login          ← public, body validation only
  /users                 ← future (AUTH-008 / ADMIN-002)
  /flags                 ← future (ADMIN-006)
```

## Anti-patterns
- ❌ Any logic, DB calls, or imports beyond router wiring
- ❌ Mounting sensitive mutation routes without `requireAdminRole`
