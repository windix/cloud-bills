# OpenAPI Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Swagger UI at `/docs` and auto-generated OpenAPI 3.1 spec at `/openapi.json`, derived from Zod route schemas.

**Architecture:** Replace `new Hono()` with `new OpenAPIHono()` from `@hono/zod-openapi`. Each route is registered via `createRoute()` with Zod schemas for path params and responses. `app.doc("/openapi.json", ...)` generates the spec at runtime; `swaggerUI({ url: "/openapi.json" })` serves the UI at `/docs`. Shared `resolveAccount()` logic is called from both provider route handlers.

**Tech Stack:** Bun, Hono 4.x, `@hono/zod-openapi`, `@hono/swagger-ui`, Zod

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add 3 new deps |
| `src/schemas.ts` | Create | Zod schemas: CostResult, Error, BalanceItem (union for /balance response) |
| `src/schemas.test.ts` | Create | Unit tests for schema parse/reject behavior |
| `src/index.ts` | Modify | Swap to `OpenAPIHono`, rewrite route registrations, add `/openapi.json` + `/docs` |
| `src/index.test.ts` | Create | Tests verifying `/openapi.json` shape and `/docs` response |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install packages**

```bash
bun add zod @hono/zod-openapi @hono/swagger-ui
```

Expected: `package.json` gains `zod`, `@hono/zod-openapi`, `@hono/swagger-ui` under `dependencies`.

- [ ] **Step 2: Verify existing tests still pass**

```bash
bun test
```

Expected: all existing tests pass (aws.test.ts + oci.test.ts), zero failures.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add zod, @hono/zod-openapi, @hono/swagger-ui"
```

---

### Task 2: Create Zod schemas

**Files:**
- Create: `src/schemas.ts`
- Create: `src/schemas.test.ts`

Note: `@hono/zod-openapi` re-exports `z` with an added `.openapi()` method — always import `z` from `"@hono/zod-openapi"`, not from `"zod"`. The `/balance` endpoint can return either a full `CostResult` or a `{ provider, account, error }` error object when a provider fails — `BalanceItemSchema` is a union that documents both shapes.

- [ ] **Step 1: Write failing tests**

Create `src/schemas.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { CostResultSchema, ErrorSchema, BalanceItemSchema } from "./schemas";

describe("CostResultSchema", () => {
  test("accepts a valid CostResult", () => {
    const result = CostResultSchema.safeParse({
      provider: "aws",
      account: "production",
      totalCost: 123.45,
      currency: "USD",
      lastUpdated: "2026-04-22T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing totalCost", () => {
    const result = CostResultSchema.safeParse({
      provider: "aws",
      account: "production",
      currency: "USD",
      lastUpdated: "2026-04-22T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("ErrorSchema", () => {
  test("accepts valid error object", () => {
    expect(ErrorSchema.safeParse({ error: "not found" }).success).toBe(true);
  });
});

describe("BalanceItemSchema", () => {
  test("accepts a CostResult (fulfilled provider)", () => {
    const result = BalanceItemSchema.safeParse({
      provider: "aws",
      account: "prod",
      totalCost: 50,
      currency: "USD",
      lastUpdated: "2026-04-22T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a provider error object (failed provider)", () => {
    const result = BalanceItemSchema.safeParse({
      provider: "oci",
      account: "tenancy",
      error: "auth failed",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/schemas.test.ts
```

Expected: FAIL — `Cannot find module './schemas'`

- [ ] **Step 3: Create `src/schemas.ts`**

```ts
import { z } from "@hono/zod-openapi";

export const CostResultSchema = z
  .object({
    provider: z.string().openapi({ example: "aws" }),
    account: z.string().openapi({ example: "production" }),
    totalCost: z.number().openapi({ example: 123.45 }),
    currency: z.string().openapi({ example: "USD" }),
    lastUpdated: z
      .string()
      .openapi({ example: "2026-04-22T00:00:00Z", description: "ISO 8601 datetime" }),
  })
  .openapi("CostResult");

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Provider 'xyz' not found" }),
  })
  .openapi("Error");

export const BalanceItemSchema = z
  .union([
    CostResultSchema,
    z
      .object({
        provider: z.string(),
        account: z.string(),
        error: z.string(),
      })
      .openapi("BalanceError"),
  ])
  .openapi("BalanceItem");

export type BalanceItem = z.infer<typeof BalanceItemSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/schemas.test.ts
```

Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/schemas.ts src/schemas.test.ts
git commit -m "feat: add Zod schemas for OpenAPI spec generation"
```

---

### Task 3: Rewrite `src/index.ts` with OpenAPIHono

**Files:**
- Modify: `src/index.ts`
- Create: `src/index.test.ts`

Note on path params: OpenAPI 3.x requires all path parameters to be required. The current `/:provider/:account?` route (optional `account`) is split into two documented routes — `GET /{provider}` (uses provider default account) and `GET /{provider}/{account}` (explicit account). Both call the shared `resolveAccount()` helper.

The `app` instance is exported as a named export (`export const app`) so the test file can call `app.request()`. The Bun server entrypoint is preserved via the default export `{ port, fetch }`.

- [ ] **Step 1: Write failing tests**

Create `src/index.test.ts`:

```ts
import { test, expect } from "bun:test";
import { app } from "./index";

test("GET /openapi.json returns OpenAPI 3.1 spec with expected paths", async () => {
  const res = await app.request("/openapi.json");
  expect(res.status).toBe(200);
  const body = await res.json() as Record<string, unknown>;
  expect(body.openapi).toBe("3.1.0");
  const paths = body.paths as Record<string, unknown>;
  expect(paths["/balance"]).toBeDefined();
  expect(paths["/{provider}"]).toBeDefined();
  expect(paths["/{provider}/{account}"]).toBeDefined();
});

test("GET /docs returns HTML with Swagger UI", async () => {
  const res = await app.request("/docs");
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text.toLowerCase()).toContain("swagger");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/index.test.ts
```

Expected: FAIL — `app` is not exported / `app.request` is not a function.

- [ ] **Step 3: Rewrite `src/index.ts`**

```ts
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { z } from "@hono/zod-openapi";
import { loadOciConfig } from "./providers/oci";
import { loadAwsConfig } from "./providers/aws";
import type { ProviderConfig, CostResult } from "./providers/types";
import { CostResultSchema, ErrorSchema, BalanceItemSchema, type BalanceItem } from "./schemas";

const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
};

export const app = new OpenAPIHono();

// /balance

const balanceRoute = createRoute({
  method: "get",
  path: "/balance",
  summary: "All account balances",
  description:
    "Returns cost data for every configured account across all providers. " +
    "If a provider fetch fails its entry contains an `error` field instead of cost fields.",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(BalanceItemSchema) } },
      description: "Balance for every account (provider errors embedded inline)",
    },
  },
});

app.openapi(balanceRoute, async (c) => {
  const calls = Object.values(providerConfigs).flatMap((cfg) =>
    Object.values(cfg.accounts).map((fn) => fn())
  );
  const results = await Promise.allSettled(calls);

  let accountIdx = 0;
  const response: BalanceItem[] = Object.entries(providerConfigs).flatMap(
    ([providerName, cfg]) =>
      Object.keys(cfg.accounts).map((accountName) => {
        const result = results[accountIdx++];
        if (result!.status === "fulfilled") return result!.value as CostResult;
        const message =
          result!.reason instanceof Error ? result!.reason.message : String(result!.reason);
        return { provider: providerName, account: accountName, error: message };
      })
  );

  return c.json(response, 200);
});

// shared resolver

async function resolveAccount(
  providerName: string,
  accountParam: string | undefined
): Promise<{ ok: true; data: CostResult } | { ok: false; status: 404 | 500; error: string }> {
  const cfg = providerConfigs[providerName];
  if (!cfg) return { ok: false, status: 404, error: `Provider '${providerName}' not found` };

  const accountName = accountParam ?? cfg.default;
  const fn = cfg.accounts[accountName];
  if (!fn) return { ok: false, status: 404, error: `Account '${accountName}' not found` };

  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, error: message };
  }
}

// /{provider}

const providerRoute = createRoute({
  method: "get",
  path: "/{provider}",
  summary: "Default account balance for a provider",
  request: {
    params: z.object({
      provider: z.string().openapi({ example: "aws", description: "Cloud provider name" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: CostResultSchema } },
      description: "Account balance",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider fetch error",
    },
  },
});

app.openapi(providerRoute, async (c) => {
  const { provider } = c.req.valid("param");
  const result = await resolveAccount(provider, undefined);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.data, 200);
});

// /{provider}/{account}

const providerAccountRoute = createRoute({
  method: "get",
  path: "/{provider}/{account}",
  summary: "Specific account balance",
  request: {
    params: z.object({
      provider: z.string().openapi({ example: "aws", description: "Cloud provider name" }),
      account: z.string().openapi({ example: "production", description: "Account name" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: CostResultSchema } },
      description: "Account balance",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider or account not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider fetch error",
    },
  },
});

app.openapi(providerAccountRoute, async (c) => {
  const { provider, account } = c.req.valid("param");
  const result = await resolveAccount(provider, account);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.data, 200);
});

// spec + UI

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Cloud Bills API",
    version: "1.0.0",
    description: "Fetch cloud cost data across OCI and AWS accounts.",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

- [ ] **Step 4: Run index tests**

```bash
bun test src/index.test.ts
```

Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests pass across all 4 test files (aws, oci, schemas, index), zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: add OpenAPI spec generation and Swagger UI at /docs"
```
