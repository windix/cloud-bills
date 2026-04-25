# OCI Credits — Design Spec
Date: 2026-04-26

## Goal

Extend the existing OCI cost response to include available credit information (amount + expiry date per credit entry, plus a root-level total). Credits are OCI-only; other providers are unaffected.

## Response Shape

`CostResult` gains two new optional fields:

```json
{
  "provider": "oci",
  "account": "windizjp",
  "totalCost": 12.34,
  "currency": "AUD",
  "lastUpdated": "2026-04-26T00:00:00.000Z",
  "totalCredits": 400.00,
  "credits": [
    { "amount": 400.00, "currency": "AUD", "expiresAt": "2026-05-22T00:00:00.000Z" }
  ]
}
```

- `totalCredits` — sum of all `credits[].amount` values, rounded to 2 decimal places
- `credits` — array of individual credit entries; omitted entirely (not `null`, not `[]`) when no credits exist or on non-OCI providers
- `expiresAt` — ISO 8601 string derived from `timeUsageEnded` of each OCI `UsageSummary` item

## Data Source

OCI's `requestSummarizedUsages` endpoint supports a `queryType` parameter. The existing call uses `COST`; credits require a second call with `queryType: CREDIT`.

- Both calls run in parallel (`Promise.all`) to avoid adding latency
- Time range: 2 years back → 1 year forward, to capture active credits regardless of billing cycle
- `expiresAt` from `UsageSummary.timeUsageEnded`
- `amount` from `UsageSummary.computedAmount`
- Items with zero or null `computedAmount` are filtered out

## Code Changes

### `src/providers/types.ts`
- Add `CreditEntry` interface: `{ amount: number; currency: string; expiresAt: string }`
- Extend `CostResult` with optional `totalCredits?: number` and `credits?: CreditEntry[]`

### `src/providers/oci.ts`
- In `createOciProvider`, run two parallel API calls: existing `COST` query + new `CREDIT` query
- Map credit items to `CreditEntry[]`, filter zero amounts, compute `totalCredits`
- Attach to returned `CostResult` only when credits array is non-empty

### `src/schemas.ts`
- Add `CreditEntrySchema` with `amount`, `currency`, `expiresAt`
- Update `CostResultSchema` with `.extend({ totalCredits: z.number().optional(), credits: z.array(CreditEntrySchema).optional() })`

### `src/providers/oci.test.ts`
- Existing test (missing config → empty) remains valid; no new live-call tests

## Non-Goals

- No credits support for AWS, Azure, GCP in this iteration
- No caching of credit results
- No `/credits` standalone endpoint
