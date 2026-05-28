# STANDARDS — routes/discover

## Purpose
GET /api/v1/discover — returns a paginated, score-sorted list of compatible profiles
for the authenticated user.

## Conventions
- `requireAuth` is mandatory — feed is always user-scoped
- `validateQuery(discoverQuerySchema)` sanitises and coerces cursor + limit
- Controller reads `req.user!.id` (guaranteed by requireAuth)
- Controller checks the `matching_algorithm_v2` feature flag (MATCH-005) before
  calling the service; passes the resolved `algorithmVersion` downstream
- All pagination state is in the opaque `cursor` string (base64url JSON); clients
  must not construct cursors — only pass back values received in responses

## Example
```
GET /api/v1/discover?limit=20
GET /api/v1/discover?cursor=eyJzY29yZSI6MC45LCJpZCI6InNjb3JlLTEifQ&limit=20
```

## Anti-patterns
- Do NOT hard-code `algorithmV: 'v1'` in the controller — always use `ALGORITHM_VERSION`
  from `@abroad-matrimony/matching` so a v2 rollout only requires flipping a flag
- Do NOT parse/interpret cursor bytes in the controller — that is the service's concern
- Do NOT add filtering business logic to the route or controller; it lives in
  `libs/matching/src/discover.service.ts`
