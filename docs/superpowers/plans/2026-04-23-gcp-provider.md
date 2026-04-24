# GCP Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GCP cost provider that queries BigQuery billing export for current-month spend, supporting multiple accounts via `gcp.yaml`.

**Architecture:** A new `src/providers/gcp.ts` mirrors the shape of `aws.ts` — `createGcpProvider` builds an async `ProviderFn` that queries BigQuery using a service account JSON key; `loadGcpConfig` parses `gcp.yaml` and wires up the accounts map. Registered in `src/index.ts` alongside existing providers.

**Tech Stack:** `@google-cloud/bigquery`, `yaml` (already installed), `bun test` with `mock.module` for BigQuery

---

### Task 1: Update `.gitignore` and install dependency

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`, `bun.lock`

- [ ] **Step 1: Add `gcp.yaml` and `keys/` to `.gitignore`**

Append to `.gitignore`:

```
gcp.yaml
keys/
```

- [ ] **Step 2: Install `@google-cloud/bigquery`**

```bash
bun add @google-cloud/bigquery
```

Expected: package added to `package.json` and `bun.lock` updated.

- [ ] **Step 3: Run existing tests to confirm baseline is green**

```bash
bun test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json bun.lock
git commit -m "chore: gitignore gcp.yaml and keys/, add @google-cloud/bigquery"
```

---

### Task 2: Write failing tests for `gcp.ts`

**Files:**
- Create: `src/providers/gcp.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/providers/gcp.test.ts`:

```ts
import { test, expect, mock } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";

// Mock must be declared before importing the module under test.
const mockQuery = mock(() =>
  Promise.resolve([[{ total_cost: 12.5, currency: "AUD" }]])
);

mock.module("@google-cloud/bigquery", () => ({
  BigQuery: class {
    query = mockQuery;
  },
}));

const { createGcpProvider, loadGcpConfig } = await import("./gcp");

test("loadGcpConfig returns empty config when file does not exist", () => {
  const config = loadGcpConfig("/nonexistent/path/gcp.yaml");
  expect(config.default).toBe("");
  expect(config.accounts).toEqual({});
});

test("loadGcpConfig parses YAML into ProviderConfig", () => {
  const tmpPath = "/tmp/gcp-test.yaml";
  writeFileSync(
    tmpPath,
    `default: main\nmain:\n  key_file: ./keys/sa.json\n  project_id: my-project\n  dataset: billing_export\n  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"\n`
  );
  const config = loadGcpConfig(tmpPath);
  unlinkSync(tmpPath);

  expect(config.default).toBe("main");
  expect(typeof config.accounts.main).toBe("function");
  expect(config.accounts["default"]).toBeUndefined();
});

test("createGcpProvider returns correct CostResult from BigQuery rows", async () => {
  const provider = createGcpProvider("main", {
    key_file: "./keys/sa.json",
    project_id: "my-project",
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.provider).toBe("gcp");
  expect(result.account).toBe("main");
  expect(result.totalCost).toBe(12.5);
  expect(result.currency).toBe("AUD");
  expect(typeof result.lastUpdated).toBe("string");
});

test("createGcpProvider returns 0 cost and USD when rows are empty", async () => {
  mockQuery.mockImplementationOnce(() => Promise.resolve([[]]));
  const provider = createGcpProvider("main", {
    key_file: "./keys/sa.json",
    project_id: "my-project",
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.totalCost).toBe(0);
  expect(result.currency).toBe("USD");
});

test("createGcpProvider propagates BigQuery errors", async () => {
  mockQuery.mockImplementationOnce(() =>
    Promise.reject(new Error("BigQuery error"))
  );
  const provider = createGcpProvider("main", {
    key_file: "./keys/sa.json",
    project_id: "my-project",
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  await expect(provider()).rejects.toThrow("BigQuery error");
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
bun test src/providers/gcp.test.ts
```

Expected: error — `Cannot find module './gcp'`.

- [ ] **Step 3: Commit the test file**

```bash
git add src/providers/gcp.test.ts
git commit -m "test: add failing tests for GCP provider"
```

---

### Task 3: Implement `src/providers/gcp.ts`

**Files:**
- Create: `src/providers/gcp.ts`

- [ ] **Step 1: Write the implementation**

Create `src/providers/gcp.ts`:

```ts
import { BigQuery } from "@google-cloud/bigquery";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, ProviderFn, ProviderConfig } from "./types";

export interface GcpAccountConfig {
  key_file: string;
  project_id: string;
  dataset: string;
  billing_account_id: string;
}

interface GcpYaml {
  default: string;
  [account: string]: GcpAccountConfig | string;
}

export function createGcpProvider(name: string, config: GcpAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const client = new BigQuery({
      projectId: config.project_id,
      keyFilename: config.key_file,
    });

    const tableSuffix = config.billing_account_id.replace(/-/g, "_");
    const tableRef = `${config.project_id}.${config.dataset}.gcp_billing_export_v1_${tableSuffix}`;

    const query = `
      SELECT SUM(cost) AS total_cost, currency
      FROM \`${tableRef}\`
      WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
      GROUP BY currency
    `;

    const [rows] = await client.query(query);

    let totalCost = 0;
    let currency = "USD";

    if (rows.length > 0) {
      totalCost = rows[0].total_cost;
      currency = rows[0].currency;
    }

    return {
      provider: "gcp",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  };
}

export function loadGcpConfig(path = "gcp.yaml"): ProviderConfig {
  let raw: GcpYaml;
  try {
    raw = parse(readFileSync(path, "utf8")) as GcpYaml;
  } catch (err: any) {
    if (err.code === "ENOENT") return { default: "", accounts: {} };
    throw err;
  }
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createGcpProvider(key, val as GcpAccountConfig);
  }

  return { default: raw.default, accounts };
}
```

- [ ] **Step 2: Run GCP tests to verify all 5 pass**

```bash
bun test src/providers/gcp.test.ts
```

Expected: 5 passing.

- [ ] **Step 3: Run the full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/providers/gcp.ts
git commit -m "feat: implement GCP provider using BigQuery billing export"
```

---

### Task 4: Register GCP in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add import**

In `src/index.ts`, add after the existing provider imports (around line 6):

```ts
import { loadGcpConfig } from "./providers/gcp";
```

- [ ] **Step 2: Add to `providerConfigs`**

Update the `providerConfigs` object (around line 10–14) to:

```ts
const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
  azure: loadAzureConfig(),
  gcp: loadGcpConfig(),
};
```

- [ ] **Step 3: Update the OpenAPI description string**

Change (around line 27):
```ts
description: "Fetch cloud cost data across OCI, AWS, and Azure accounts.",
```
to:
```ts
description: "Fetch cloud cost data across OCI, AWS, Azure, and GCP accounts.",
```

- [ ] **Step 4: Run the full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: register GCP provider in router"
```

---

### Task 5: Add `gcp.yaml.example`

**Files:**
- Create: `gcp.yaml.example`

- [ ] **Step 1: Write the example file**

Create `gcp.yaml.example`:

```yaml
# GCP billing account configuration
# Copy this file to gcp.yaml and fill in your values.
# gcp.yaml is gitignored — never commit real credentials.

# Name of the account to use when no account is specified in the API path.
default: main

main:
  # Path to your service account JSON key file (relative to repo root).
  key_file: ./keys/main-billing-sa.json
  # GCP project that hosts the BigQuery billing export dataset.
  project_id: my-gcp-project
  # BigQuery dataset name where billing export lives.
  dataset: billing_export
  # Your GCP billing account ID (format: XXXXXX-XXXXXX-XXXXXX).
  # Used to derive the BigQuery table name automatically.
  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"

# Add more accounts by repeating the block with a different name.
# secondary:
#   key_file: ./keys/secondary-billing-sa.json
#   project_id: another-gcp-project
#   dataset: billing_export
#   billing_account_id: "DDDDDD-EEEEEE-FFFFFF"
```

- [ ] **Step 2: Commit**

```bash
git add gcp.yaml.example
git commit -m "chore: add gcp.yaml.example"
```

---

### Task 6: Write `docs/gcp-setup.md`

**Files:**
- Create: `docs/gcp-setup.md`

- [ ] **Step 1: Write the setup guide**

Create `docs/gcp-setup.md`:

```markdown
# GCP Setup Guide

This guide walks you through enabling GCP Cloud Billing export to BigQuery and creating a least-privilege service account so cloud-bills can query your current-month spend.

## Prerequisites

- A GCP account with at least one billing account
- Owner or Billing Account Administrator access to the billing account
- Owner or Editor access to a GCP project where BigQuery will live

---

## 1. Create a BigQuery Dataset

1. Open [BigQuery](https://console.cloud.google.com/bigquery) in the GCP Console.
2. In the Explorer panel, click your project name → **Create dataset**.
3. Set **Dataset ID** to `billing_export` (or any name you prefer — note it for later).
4. Choose a **Location** near your workload.
5. Click **Create dataset**.

Note the **Project ID** (shown at the top of the console) and the **Dataset ID** — you'll need both in `gcp.yaml`.

---

## 2. Enable Cloud Billing Export to BigQuery

1. Open [Billing](https://console.cloud.google.com/billing) in the GCP Console.
2. Select your billing account.
3. In the left menu, click **Billing export**.
4. Click the **BigQuery export** tab.
5. Click **Edit settings** next to **Standard usage cost**.
6. Set **Project** to the project where you created the dataset above.
7. Set **Dataset** to `billing_export` (or the name you chose).
8. Click **Save**.

GCP creates the export table automatically. The table name format is:

```
gcp_billing_export_v1_<BILLING_ACCOUNT_ID_WITH_UNDERSCORES>
```

For example, billing account `AAAAAA-BBBBBB-CCCCCC` produces table `gcp_billing_export_v1_AAAAAA_BBBBBB_CCCCCC`. cloud-bills derives this name from `billing_account_id` in your `gcp.yaml` — you do not need to enter the table name manually.

> **Note:** Initial data can take up to 48 hours to appear. Daily updates typically arrive within a few hours.

---

## 3. Find Your Billing Account ID

1. Open [Billing](https://console.cloud.google.com/billing).
2. Select your billing account.
3. Click **Account management** in the left menu.
4. The **Billing account ID** is shown at the top — format `XXXXXX-XXXXXX-XXXXXX`.

---

## 4. Create a Least-Privilege Service Account

The service account needs exactly two permissions — nothing more:

| Permission | Scope | Purpose |
|---|---|---|
| `roles/bigquery.jobUser` | Project | Allows submitting query jobs |
| `roles/bigquery.dataViewer` | Dataset only | Allows reading rows from the billing dataset |

The SA cannot read other datasets, access the Billing API, manage IAM, or perform any write operations.

### a. Create the service account

1. Open [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Make sure the correct project (the one hosting BigQuery) is selected.
3. Click **Create service account**.
4. Set **Service account name** to `billing-reader`.
5. Click **Create and continue**.
6. **Skip** the "Grant this service account access to project" step — do not assign any role here.
7. Click **Done**.

The SA email will be `billing-reader@<project-id>.iam.gserviceaccount.com`.

### b. Grant `BigQuery Job User` on the project

1. Open [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam).
2. Click **Grant access**.
3. In **New principals**, paste the SA email (`billing-reader@<project-id>.iam.gserviceaccount.com`).
4. In **Role**, search for and select **BigQuery Job User** (`roles/bigquery.jobUser`).
5. Click **Save**.

### c. Grant `BigQuery Data Viewer` on the dataset only

This step scopes data access to the billing dataset exclusively.

1. Open [BigQuery](https://console.cloud.google.com/bigquery).
2. In the Explorer panel, click the `billing_export` dataset (not a table — the dataset itself).
3. Click **Sharing** → **Permissions** → **Add principal**.
4. In **New principals**, paste the SA email.
5. In **Role**, search for and select **BigQuery Data Viewer** (`roles/bigquery.dataViewer`).
6. Click **Save**.

> Do **not** grant BigQuery Data Viewer at the project level — that would allow the SA to read all datasets in the project.

---

## 5. Download the JSON Key

1. Open [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Click `billing-reader@<project-id>.iam.gserviceaccount.com`.
3. Go to the **Keys** tab → **Add key** → **Create new key**.
4. Select **JSON** → **Create**.
5. The key file downloads automatically — store it somewhere safe.
6. Move it into a `keys/` directory inside the repo root (e.g. `keys/main-billing-sa.json`). The `keys/` directory is gitignored — never commit key files.

---

## 6. Configure `gcp.yaml`

1. Copy `gcp.yaml.example` to `gcp.yaml`.
2. Fill in the values:

```yaml
default: main

main:
  key_file: ./keys/main-billing-sa.json        # path from repo root to the JSON key
  project_id: my-gcp-project                   # project hosting the BigQuery dataset
  dataset: billing_export                       # dataset ID from Step 1
  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"   # billing account ID from Step 3
```

3. Start the server:

```bash
bun run src/index.ts
```

4. Verify the endpoint:

```bash
curl http://localhost:3000/gcp
```

Expected response:

```json
{
  "provider": "gcp",
  "account": "main",
  "totalCost": 12.34,
  "currency": "USD",
  "lastUpdated": "2026-04-23T10:00:00.000Z"
}
```

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Not found: Table ... gcp_billing_export_v1_...` | Export not yet populated or wrong billing account ID | Wait 24–48h after enabling export; double-check `billing_account_id` |
| `Permission denied on dataset` | SA missing `BigQuery Data Viewer` on the dataset | Repeat Step 4c |
| `Permission denied on project` | SA missing `BigQuery Job User` | Repeat Step 4b |
| `Could not load the key file` | Wrong `key_file` path | Verify path is relative to repo root |
| `Dataset not found` | Wrong `project_id` or `dataset` | Check values match BigQuery console |
```

- [ ] **Step 2: Run the full test suite one final time**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add docs/gcp-setup.md
git commit -m "docs: add GCP setup guide with BigQuery billing export and least-privilege SA instructions"
```
