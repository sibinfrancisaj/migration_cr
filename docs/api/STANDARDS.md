# API Documentation Standards

## Purpose

This directory contains the canonical API documentation for the Abroad Matrimony backend.
Every developer and Claude session must keep these files in sync with the implementation.

---

## Files

| File | Format | Purpose |
|------|--------|---------|
| `openapi.yaml` | OpenAPI 3.1.0 | Machine-readable API contract; used for validation, code generation, and Swagger UI |
| `postman-collection.json` | Postman Collection v2.1 | Developer testing tool with example requests and auto-save test scripts |
| `postman-environment.json` | Postman Environment | Variable set for local development (base URLs, placeholder tokens) |
| `STANDARDS.md` | Markdown | This file — maintenance rules |

---

## When You MUST Update These Files

Update `openapi.yaml` **and** `postman-collection.json` whenever any of the following changes:

| Change | What to update |
|--------|---------------|
| New endpoint added | Add path to `openapi.yaml`; add request to the correct folder in `postman-collection.json` |
| Endpoint removed | Remove from both files |
| Route path changes (e.g. `/v1/foo` → `/v1/bar`) | Update path in both files |
| Request body field added, removed, or renamed | Update the `requestBody` schema in `openapi.yaml`; update example JSON in `postman-collection.json` |
| Response body field added, removed, or renamed | Update the response schema in `openapi.yaml` |
| New enum value added | Update the enum schema in `openapi.yaml` components |
| Enum value removed | Remove from `openapi.yaml`; note as breaking change |
| New error code or HTTP status | Add to `openapi.yaml` responses for the affected endpoint |
| Auth requirement changes | Update `security` array in `openapi.yaml`; update auth in `postman-collection.json` request |
| New required env var affecting an endpoint | Document in the relevant endpoint description |

**Rule:** Documentation is part of the task. A task is not complete until both files are updated.

---

## How to Update

### openapi.yaml

1. **Add a new path:** Copy the nearest similar path block. Update method, tags, summary, description, parameters, requestBody, responses.
2. **Add a new schema:** Add to `components/schemas`. Use `$ref` in paths.
3. **Add a new enum:** Add to `components/schemas` as a string enum. Reference with `$ref` in every place that enum is used.
4. **Add a reusable parameter:** Add to `components/parameters`. Reference with `$ref`.
5. **Validate:** Run the validation command below before committing.

### postman-collection.json

1. **Add a new request:** Insert it into the correct `item` array (folder matches the OpenAPI tag).
2. **Folder order** must match the OpenAPI `tags` order.
3. **Auth:** User endpoints use `"bearer": [{ "key": "token", "value": "{{access_token}}" }]`. Admin endpoints use `{{admin_token}}`. Public endpoints have no auth block.
4. **Example bodies:** Keep `raw` JSON realistic — use plausible field values, not `"string"` placeholders.
5. **Test scripts:** Add auto-save scripts on any endpoint that returns a token (see Verify OTP for the pattern).
6. **Variable references:** Path variables use `:name` in the `raw` URL string and a matching entry in `variable[]`. Collection-level variables use `{{name}}`.

---

## Validation

```bash
# Install the OpenAPI linter (one-time)
npm install -g @redocly/cli

# Validate the spec
npx @redocly/cli lint docs/api/openapi.yaml

# Preview in Swagger UI (requires Docker)
docker run -p 8090:8080 -e SWAGGER_JSON=/api/openapi.yaml -v $(pwd)/docs/api:/api swaggerapi/swagger-ui
# Open: http://localhost:8090
```

---

## Naming Conventions

### openapi.yaml

- **operationId:** `camelCase`, `<verb><Resource>`, e.g. `requestOtp`, `createProfile`, `getDiscoveryFeed`, `processRefund`
- **Tag names:** Title case with em-dash for sub-groups: `Payment — Stripe`, `Admin — Moderation`
- **Schema names:** `PascalCase` noun or noun phrase: `ProfileDto`, `MembershipDto`, `ApiError`
- **Parameter names:** `camelCase` in path/query; match the Zod schema field name exactly
- **Description:** One sentence summary (imperative mood) + detail paragraph. Always mention rate limits and error conditions.

### postman-collection.json

- **Request names:** `Verb Object` format matching the operationId: `Create Stripe Checkout`, `Get Diamond Balance`
- **Folder names:** Match the OpenAPI tag exactly
- **Variable names:** `snake_case` for collection variables

---

## Adding a New Phase of Endpoints

When a new backend phase (Phase 8+) adds a batch of endpoints:

1. Add all new paths to `openapi.yaml` — group under an appropriate tag, create new tag in the `tags` array if needed.
2. Add all new requests to `postman-collection.json` — create a new folder if the tag is new.
3. Run `npx @redocly/cli lint docs/api/openapi.yaml` and fix all errors.
4. Commit both files in the same commit as the route implementation.

Commit message format:
```
docs(api): add Phase 8 Admin API endpoints to openapi.yaml + postman-collection

- ADMIN-001: POST /admin/users/list
- ADMIN-002: ...
```

---

## Anti-Patterns

- ❌ Never describe an endpoint only in code comments — it must be in `openapi.yaml`
- ❌ Never leave `REPLACE_WITH_*` placeholders in the spec (environment values are fine in Postman)
- ❌ Never mix admin and user JWT security on the same endpoint
- ❌ Never use float types for money fields — always `integer` with a description noting the unit (paise, cents)
- ❌ Never mark a task Done without updating both documentation files

---

## Ownership

These files are maintained as part of the implementation process — not as a separate documentation step.
The developer (or Claude session) implementing the endpoint is responsible for updating the docs in the same work session.

The `openapi.yaml` and `postman-collection.json` in this directory are the **source of truth** for the API contract.
If the code and the spec disagree, the code is wrong.
