# OCI Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the OCI cost response with available credit info — a `credits` array (amount + currency + expiresAt per entry) and a root-level `totalCredits` sum.

**Architecture:** A second parallel `CREDIT` queryType call is added inside `createOciProvider` alongside the existing `COST` call. Both calls run concurrently via `Promise.all`. Credit items are mapped to `CreditEntry` objects, filtered for non-zero amounts, and attached to the returned `CostResult`. The types, Zod schemas, and OpenAPI spec are updated to reflect the new optional fields.

**Tech Stack:** Bun, TypeScript, Hono + `@hono/zod-openapi`, `oci-usageapi` SDK, `bun test`

---

### Task 1: Add `CreditEntry` type and extend `CostResult`

**Files:**
- Modify: `src/providers/types.ts`

- [ ] **Step 1: Update `src/providers/types.ts`**

Replace the entire file with:

```typescript
export interface CreditEntry {
  amount: number;
  currency: string;
  expiresAt: string; // ISO 8601
}

export interface CostResult {
  provider: string;
  account: string;
  totalCost: number;
  currency: string;
  lastUpdated: string; // ISO 8601
  totalCredits?: number;
  credits?: CreditEntry[];
}

export type ProviderFn = () => Promise<CostResult>;

export interface ProviderConfig {
  default: string;
  accounts: Record<string, ProviderFn>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/providers/types.ts
git commit -m "feat: add CreditEntry type and extend CostResult with credits fields"
```

---

### Task 2: Update Zod schemas

**Files:**
- Modify: `src/schemas.ts`

- [ ] **Step 1: Write a failing test that imports `CreditEntrySchema`**

Append to `src/schemas.test.ts` — add these `describe` blocks after the existing ones. The existing file already imports `CostResultSchema`; add `CreditEntrySchema` to that import line:

```typescript
// update existing import to:
import { CostResultSchema, ErrorSchema, BalanceItemSchema, CreditEntrySchema } from "./schemas";

// append:
describe("CreditEntrySchema", () => {
  test("accepts a valid credit entry", () => {
    const result = CreditEntrySchema.safeParse({
      amount: 400,
      currency: "AUD",
      expiresAt: "2026-05-22T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("CostResultSchema credits extension", () => {
  test("accepts totalCredits and credits array", () => {
    const result = CostResultSchema.safeParse({
      provider: "oci",
      account: "windizjp",
      totalCost: 12.34,
      currency: "AUD",
      lastUpdated: "2026-04-26T00:00:00.000Z",
      totalCredits: 400,
      credits: [{ amount: 400, currency: "AUD", expiresAt: "2026-05-22T00:00:00.000Z" }],
    });
    expect(result.success).toBe(true);
  });

  test("accepts response without credits fields (non-OCI providers)", () => {
    const result = CostResultSchema.safeParse({
      provider: "aws",
      account: "prod",
      totalCost: 99.99,
      currency: "USD",
      lastUpdated: "2026-04-26T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/schemas.test.ts
```

Expected: FAIL — `CreditEntrySchema` not exported from `./schemas`

- [ ] **Step 3: Update `src/schemas.ts`**

Replace the entire file with:

```typescript
import { z } from "@hono/zod-openapi";

export const CreditEntrySchema = z
  .object({
    amount: z.number().openapi({ example: 400.0 }),
    currency: z.string().openapi({ example: "AUD" }),
    expiresAt: z
      .string()
      .openapi({ example: "2026-05-22T00:00:00.000Z", description: "ISO 8601 datetime" }),
  })
  .openapi("CreditEntry");

export const CostResultSchema = z
  .object({
    provider: z.string().openapi({ example: "aws" }),
    account: z.string().openapi({ example: "production" }),
    totalCost: z.number().openapi({ example: 123.45 }),
    currency: z.string().openapi({ example: "USD" }),
    lastUpdated: z
      .string()
      .openapi({ example: "2026-04-22T00:00:00Z", description: "ISO 8601 datetime" }),
    totalCredits: z.number().optional().openapi({ example: 400.0 }),
    credits: z.array(CreditEntrySchema).optional(),
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/schemas.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/schemas.ts src/schemas.test.ts
git commit -m "feat: add CreditEntrySchema and extend CostResultSchema with optional credits fields"
```

---

### Task 3: Fetch credits in OCI provider

**Files:**
- Modify: `src/providers/oci.ts`
- Modify: `src/providers/oci.test.ts`

- [ ] **Step 1: Update the test to assert credits fields are absent when no credits returned**

The existing test in `src/providers/oci.test.ts` only checks `loadOciConfig`. Add a note: the credit-fetch path is covered by the integration (live OCI calls) — the unit test scope stays as-is. No changes needed to the test file for this task.

- [ ] **Step 2: Update `src/providers/oci.ts`**

Replace the entire file with:

```typescript
import * as usageapi from "oci-usageapi";
import * as common from "oci-common";
import { startOfMonth, addDays, startOfDay, subYears, addYears } from "date-fns";
import { utc } from "@date-fns/utc";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, CreditEntry, ProviderFn, ProviderConfig } from "./types";

export interface OciAccountConfig {
  tenancy_id: string;
  user_id: string;
  fingerprint: string;
  private_key: string;
  region: string;
}

interface OciYaml {
  default: string;
  [account: string]: OciAccountConfig | string;
}

export function createOciProvider(name: string, config: OciAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const auth = new common.SimpleAuthenticationDetailsProvider(
      config.tenancy_id,
      config.user_id,
      config.fingerprint,
      config.private_key,
      null,
      common.Region.fromRegionId(config.region)
    );

    const client = new usageapi.UsageapiClient({ authenticationDetailsProvider: auth });

    const now = new Date();

    // Cost query: current month to date
    const costStart = startOfMonth(now, { in: utc });
    const costEnd = startOfDay(addDays(now, 1, { in: utc }), { in: utc });

    // Credit query: wide window to capture all active credits
    const creditStart = subYears(now, 2);
    const creditEnd = addYears(now, 1);

    const [costResponse, creditResponse] = await Promise.all([
      client.requestSummarizedUsages({
        requestSummarizedUsagesDetails: {
          timeUsageStarted: costStart,
          timeUsageEnded: costEnd,
          granularity: usageapi.models.RequestSummarizedUsagesDetails.Granularity.Monthly,
          tenantId: config.tenancy_id,
        },
      }),
      client.requestSummarizedUsages({
        requestSummarizedUsagesDetails: {
          timeUsageStarted: creditStart,
          timeUsageEnded: creditEnd,
          granularity: usageapi.models.RequestSummarizedUsagesDetails.Granularity.Monthly,
          queryType: usageapi.models.RequestSummarizedUsagesDetails.QueryType.Credit,
          tenantId: config.tenancy_id,
        },
      }),
    ]);

    const costItems = costResponse.usageAggregation?.items ?? [];
    const totalCost = costItems.reduce((sum, item) => sum + (item.computedAmount ?? 0), 0);
    const currency = costItems[0]?.currency ?? "USD";

    const creditItems = (creditResponse.usageAggregation?.items ?? []).filter(
      (item) => (item.computedAmount ?? 0) !== 0
    );

    const credits: CreditEntry[] = creditItems.map((item) => ({
      amount: Math.round((item.computedAmount ?? 0) * 100) / 100,
      currency: item.currency ?? currency,
      expiresAt: item.timeUsageEnded.toISOString(),
    }));

    const totalCredits =
      credits.length > 0
        ? Math.round(credits.reduce((sum, c) => sum + c.amount, 0) * 100) / 100
        : undefined;

    return {
      provider: "oci",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
      ...(credits.length > 0 && { totalCredits, credits }),
    };
  };
}

export function loadOciConfig(path = "config/oci.yaml"): ProviderConfig {
  let raw: OciYaml;
  try {
    raw = parse(readFileSync(path, "utf8")) as OciYaml;
  } catch (err: any) {
    if (err.code === "ENOENT") return { default: "", accounts: {} };
    throw err;
  }
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createOciProvider(key, val as OciAccountConfig);
  }

  return { default: raw.default, accounts };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
bun test
```

Expected: all existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/providers/oci.ts
git commit -m "feat: fetch OCI credits in parallel with cost, attach to CostResult"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

```bash
bun test
```

Expected: all tests pass, no failures

- [ ] **Step 2: Check TypeScript**

```bash
bun run tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Verify the server starts**

```bash
bun run src/index.ts &
sleep 2
curl -s http://localhost:3000/openapi.json | grep -i credit
kill %1
```

Expected: `CreditEntry` and `credits` appear in the OpenAPI JSON

