# OpenAPI Support Design

**Date:** 2026-04-22
**Goal:** Add a browsable Swagger UI at `/docs` with a spec that stays automatically in sync with the code.

## Approach

Use `@hono/zod-openapi` (Hono's official OpenAPI package) and `@hono/swagger-ui`. The existing `Hono` instance is replaced with `OpenAPIHono`, and routes are registered via `createRoute()` with Zod schemas. The spec is derived from those schemas at runtime — nothing gets out of sync.

## Architecture

- `OpenAPIHono` replaces `new Hono()` as the app instance.
- Each route is registered with `app.openapi(createRoute({...}), handler)` instead of `app.get(...)`.
- `app.doc('/openapi.json', metadata)` exposes the auto-generated OpenAPI 3.1 spec.
- `swaggerUI({ url: '/openapi.json' })` is mounted at `/docs` to serve the Swagger UI.
- Existing handler logic is unchanged; only the route registration wrapper changes.

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `zod`, `@hono/zod-openapi`, `@hono/swagger-ui` |
| `src/schemas.ts` | New file — Zod schemas mirroring existing TS types |
| `src/index.ts` | Swap to `OpenAPIHono`, rewrite route registrations, add `/openapi.json` and `/docs` |

`src/providers/types.ts` is unchanged — providers still return plain `CostResult` objects.

## Schemas (`src/schemas.ts`)

- `CostResultSchema` — mirrors `CostResult`: `provider`, `account`, `totalCost`, `currency`, `lastUpdated`
- `ErrorSchema` — `{ error: string }`
- `ProviderParam` — path param `provider` (string, required)
- `AccountParam` — path param `account` (string, optional)

## Routes

| Route | Path params | `200` response | Error responses |
|-------|-------------|----------------|-----------------|
| `GET /balance` | none | `CostResult[]` (errors embedded inline per provider) | — |
| `GET /:provider/:account?` | `provider` (required), `account` (optional) | `CostResult` | `404` provider/account not found; `500` fetch error |

## Dependencies Added

```
zod
@hono/zod-openapi
@hono/swagger-ui
```

## Out of Scope

- Request body validation (no POST routes exist)
- Authentication/API key documentation
- Client code generation
- Separate docs server/port
