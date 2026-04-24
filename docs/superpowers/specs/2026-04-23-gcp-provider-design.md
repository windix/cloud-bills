# GCP Provider — Multi-Account Cost Support

**Date:** 2026-04-23
**Scope:** Add GCP cost provider using BigQuery billing export, following the existing YAML-based multi-account pattern.

---

## Overview

Add a GCP provider that reads per-account credentials from `gcp.yaml`, queries a BigQuery billing export table for current-month net spend, and returns a `CostResult` per account. No changes to the core router or shared types.

---

## Architecture

```
cloud-bills/
├── src/
│   └── providers/
│       ├── gcp.ts              new — mirrors aws.ts structure
│       └── gcp.test.ts         new — unit tests
├── gcp.yaml.example            new — credential template
├── docs/
│   └── gcp-setup.md            new — BigQuery export + least-privilege SA guide
└── src/index.ts                updated — register gcp provider
```

---

## `gcp.yaml` Config Format

```yaml
# Copy to gcp.yaml and fill in values. gcp.yaml is gitignored.
default: main

main:
  key_file: ./keys/main-billing-sa.json
  project_id: my-gcp-project
  dataset: billing_export
  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"

# secondary:
#   key_file: ./keys/secondary-billing-sa.json
#   project_id: another-gcp-project
#   dataset: billing_export
#   billing_account_id: "DDDDDD-EEEEEE-FFFFFF"
```

`billing_account_id` is the GCP billing account ID (format `XXXXXX-XXXXXX-XXXXXX`). It is used to derive the BigQuery table name by replacing `-` with `_`: `gcp_billing_export_v1_<id>`.

---

## GCP Provider (`src/providers/gcp.ts`)

**Interface:**
```ts
export interface GcpAccountConfig {
  key_file: string;
  project_id: string;
  dataset: string;
  billing_account_id: string;
}
```

**`createGcpProvider(name, config): ProviderFn`**
1. Derive table suffix: `config.billing_account_id.replace(/-/g, "_")`
2. Construct full table ref: `` `${project_id}.${dataset}.gcp_billing_export_v1_${suffix}` ``
3. Instantiate `BigQuery` client with `{ projectId: config.project_id, keyFilename: config.key_file }`
4. Run query:
   ```sql
   SELECT SUM(cost) AS total_cost, currency
   FROM `<table_ref>`
   WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
   GROUP BY currency
   ```
5. Sum rows (there may be multiple currencies; use the first currency and its total — same pattern as OCI/AWS which assume a single billing currency per account)
6. Return `CostResult` with `provider: "gcp"`, `account: name`, rounded total, currency, ISO timestamp

**`loadGcpConfig(path = "gcp.yaml"): ProviderConfig`**
Same ENOENT-tolerant YAML parse as `loadAwsConfig`: if `gcp.yaml` is missing return `{ default: "", accounts: {} }`; otherwise iterate keys, skip `"default"`, build accounts map.

**Dependency:** `@google-cloud/bigquery`

---

## `src/index.ts` Change

```ts
import { loadGcpConfig } from "./providers/gcp";

const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
  azure: loadAzureConfig(),
  gcp: loadGcpConfig(),
};
```

OpenAPI description string updated to include GCP.

---

## Tests (`src/providers/gcp.test.ts`)

| Test | What it verifies |
|---|---|
| `loadGcpConfig` — missing file | Returns empty config `{ default: "", accounts: {} }` |
| `loadGcpConfig` — valid YAML | Correct `default` and accounts map |
| `createGcpProvider` — success | Mocked BigQuery returns rows → correct `CostResult` |
| `createGcpProvider` — empty result | No rows → `totalCost: 0`, currency defaults to `"USD"` |
| `createGcpProvider` — BigQuery throws | Error propagates (caught by router) |

---

## `docs/gcp-setup.md` Coverage

### 1. Enable Cloud Billing Export
- GCP Console → Billing → Billing export → BigQuery export → Enable

### 2. Create BigQuery Dataset
- Choose a GCP project to host the dataset
- Create dataset (e.g. `billing_export`) in a region close to your workload
- Note the project ID and dataset name

### 3. Configure Billing Export
- Point the export at the project + dataset created above
- Use **Standard usage cost** export (not Detailed or Pricing)
- Note the auto-created table name: `gcp_billing_export_v1_<BILLING_ACCOUNT_ID_WITH_UNDERSCORES>`
- Data appears within 24 hours; subsequent updates are a few hours delayed

### 4. Create Least-Privilege Service Account
Step-by-step least-privilege setup:

**a. Create the service account**
- IAM & Admin → Service Accounts → Create service account
- Name: `billing-reader` (or similar)
- No project-level role at creation time

**b. Grant `BigQuery Job User` on the project**
- This allows the SA to run query jobs
- IAM & Admin → IAM → Grant Access → `roles/bigquery.jobUser` scoped to the hosting project
- This is the minimum project-level role needed; it grants no data access on its own

**c. Grant `BigQuery Data Viewer` on the dataset only**
- BigQuery → select the billing dataset → Sharing → Permissions → Add principal
- Add the SA email with role `roles/bigquery.dataViewer`
- This is dataset-scoped, not project-wide — the SA cannot read any other BigQuery data

**d. No other roles needed** — explicitly: do not grant `BigQuery Admin`, `BigQuery User` (project-wide), or any Billing Account roles

### 5. Download JSON Key
- Service Accounts → select `billing-reader` → Keys → Add Key → JSON
- Save to a path outside the repo (e.g. `./keys/main-billing-sa.json`)
- `keys/` is gitignored; never commit key files

### 6. Configure `gcp.yaml`
- Copy `gcp.yaml.example` to `gcp.yaml`
- Fill in `key_file`, `project_id`, `dataset`, `billing_account_id`
- `gcp.yaml` is gitignored — never commit real credentials

---

## Error Handling

Follows existing pattern:
- Missing `gcp.yaml` → empty provider config (no accounts registered, not an error)
- Missing/invalid `key_file` → BigQuery client throws on query; caught by router, returned as `{ provider, account, error }` with HTTP 500
- BigQuery table not found (export not yet set up) → BigQuery throws; same HTTP 500 path
- Unknown provider or account → existing 404 handling in router (no change)

---

## Out of Scope

- Detailed billing export (standard export is sufficient for total cost)
- Per-service or per-SKU cost breakdown
- Workload Identity Federation / ADC credential chain
- BigQuery slot reservations or cost controls on the query itself
