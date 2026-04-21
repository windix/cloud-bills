# Cloud Bills — Unified Cloud Cost API

**Date:** 2026-04-21
**Stack:** Bun + Hono + TypeScript
**Scope:** Personal/local REST API to query current-month cloud spend across multiple providers, starting with OCI.

---

## Overview

A lightweight local HTTP server that exposes a unified REST API for querying current-month cloud costs. Each cloud provider is implemented as a plugin module with a shared interface. Adding a new provider requires only a new file — no changes to the core router.

---

## Architecture

```
cloud-bills/
├── src/
│   ├── index.ts              # Hono app entry point, route registration
│   ├── providers/
│   │   ├── types.ts          # Shared CostResult interface
│   │   └── oci.ts            # OCI provider implementation
├── .env                      # Credentials (gitignored)
├── .env.example              # Template listing all required vars
├── README.md                 # Setup instructions including how to get credentials
├── package.json
└── tsconfig.json
```

---

## Shared Interface

Every provider module exports a default async function matching this signature:

```ts
// src/providers/types.ts
export interface CostResult {
  provider: string;
  totalCost: number;
  currency: string;
  lastUpdated: string; // ISO 8601
}

export type ProviderFn = () => Promise<CostResult>;
```

---

## API Endpoints

### `GET /balance/:provider`
Query a specific provider by name (e.g. `/balance/oci`).

**Success response (200):**
```json
{
  "provider": "oci",
  "totalCost": 2.47,
  "currency": "AUD",
  "lastUpdated": "2026-04-21T10:00:00.000Z"
}
```

**Provider not found (404):**
```json
{ "error": "Provider 'xyz' not found" }
```

**Credentials missing or API error (500):**
```json
{ "provider": "oci", "error": "OCI credentials not configured" }
```

### `GET /balance`
Query all registered providers. Returns an array, including any per-provider errors inline.

**Response (200):**
```json
[
  { "provider": "oci", "totalCost": 2.47, "currency": "AUD", "lastUpdated": "..." }
]
```

---

## OCI Provider

**Package:** `oci-usageapi`, `oci-common`

**Method:** `UsageapiClient.requestSummarizedUsages` with:
- `timeUsageStarted`: first day of the current month (UTC)
- `timeUsageEnded`: now (UTC)
- `granularity`: `MONTHLY`
- `tenantId`: from `OCI_TENANCY_ID`

Sums all returned cost items to produce `totalCost`. Currency is taken from the first result item; falls back to `"USD"` if the response is empty.

**Required `.env` variables:**

| Variable | Description |
|---|---|
| `OCI_TENANCY_ID` | Your tenancy OCID |
| `OCI_USER_ID` | Your user OCID |
| `OCI_FINGERPRINT` | API key fingerprint |
| `OCI_PRIVATE_KEY` | PEM private key (single line, `\n` for newlines) |
| `OCI_REGION` | e.g. `ap-sydney-1` |

---

## README Coverage

The README will include step-by-step instructions for obtaining each OCI credential:
1. How to find your Tenancy OCID (Console → Profile → Tenancy)
2. How to find your User OCID (Console → Profile → User Settings)
3. How to generate an API signing key pair and register the public key
4. How to get the fingerprint after uploading the public key
5. How to set `OCI_PRIVATE_KEY` from the downloaded `.pem` file
6. How to run the server locally with Bun

---

## Error Handling

- Missing env vars: provider throws with message `"<PROVIDER> credentials not configured"`, caught by router, returned as `{ provider, error }` with HTTP 500.
- OCI API errors: caught and returned the same way.
- Unknown provider in `GET /balance/:provider`: HTTP 404.

---

## Out of Scope (for now)

- Authentication on the API endpoints
- AWS, Azure, GCP providers (same plugin pattern, added later)
- Caching / rate limiting
- Deployment / containerization
