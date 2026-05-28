# STANDARDS — controllers/discover

## Purpose
Houses the `discoverController.getFeed` handler for `GET /api/v1/discover`.
Returns a paginated, score-sorted list of compatible profiles for the authenticated user.

## Conventions
- Controller reads `req.user!.id` (guaranteed by `requireAuth`) and validated query
  params via `req.query as DiscoverQuery` (coerced by `validateQuery` middleware)
- Feature-flag check (`MATCH-005`) happens here, not in the route or service
- `FeatureFlagService` is a lazy singleton (`_ffService`) to ensure Jest mocks are
  in place before the constructor runs
- Pagination meta (`cursor`, `hasMore`) lives in `ApiResponse.meta`
- Always `next(err)` on unhandled exceptions — never swallow errors

## Example response shape
```json
{
  "success": true,
  "data": [{ "userId": "...", "name": "Alice", "totalScore": 0.91, ... }],
  "meta": { "cursor": "eyJzY29yZSI6MC45...", "hasMore": true },
  "requestId": "abc-123"
}
```

## Anti-patterns
- Do NOT add filtering or ranking logic here — that lives in `libs/matching/src/discover.service.ts`
- Do NOT construct cursors — only forward the opaque string from the service response
- Do NOT hard-code `'v1'` — always use `ALGORITHM_VERSION` from `@abroad-matrimony/matching`
- Do NOT instantiate `FeatureFlagService` at module load time (breaks Jest mocks)
