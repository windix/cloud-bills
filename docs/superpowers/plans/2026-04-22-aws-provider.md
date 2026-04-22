# AWS Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AWS Cost Explorer provider that reads per-account credentials from `aws.yaml`, queries current-month spend per account, and registers alongside the existing OCI provider; reorganise setup docs.

**Architecture:** Follow the OCI provider pattern exactly — `createAwsProvider(name, config)` returns a `ProviderFn`, `loadAwsConfig(path)` parses `aws.yaml` into a `ProviderConfig`. Documentation is split into per-provider files so README stays provider-agnostic.

**Tech Stack:** Bun, TypeScript, `@aws-sdk/client-cost-explorer`, `yaml` (already installed), `date-fns` + `@date-fns/utc` (already installed), `bun:test`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/providers/aws.ts` | AWS provider: config interface, `createAwsProvider`, `loadAwsConfig` |
| Create | `src/providers/aws.test.ts` | Tests for `loadAwsConfig` and `createAwsProvider` |
| Create | `aws.yaml.example` | Credential template (committed) |
| Modify | `.gitignore` | Add `aws.yaml` |
| Modify | `src/index.ts` | Register `aws: loadAwsConfig()` in `providerConfigs` |
| Create | `docs/oci-setup.md` | OCI credential instructions moved from README |
| Create | `docs/aws-setup.md` | AWS IAM + Cost Explorer setup guide |
| Modify | `README.md` | Trim to overview + links to provider setup docs |

---

### Task 1: Install AWS SDK dependency and update .gitignore

**Files:**
- Modify: `package.json` (via bun install)
- Modify: `.gitignore`

- [ ] **Step 1: Install the Cost Explorer SDK package**

```bash
bun add @aws-sdk/client-cost-explorer
```

Expected: `bun.lock` updated, `@aws-sdk/client-cost-explorer` appears in `package.json` dependencies.

- [ ] **Step 2: Add `aws.yaml` to .gitignore**

In `.gitignore`, add a line after `oci.yaml`:

```
oci.yaml
aws.yaml
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock .gitignore
git commit -m "chore: add @aws-sdk/client-cost-explorer, gitignore aws.yaml"
```

---

### Task 2: Write failing tests for the AWS provider

**Files:**
- Create: `src/providers/aws.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/providers/aws.test.ts`:

```ts
import { test, expect, mock } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";

// Mock must be declared before importing the module under test.
const mockSend = mock(() =>
  Promise.resolve({
    ResultsByTime: [
      {
        Total: {
          UnblendedCost: { Amount: "12.50", Unit: "USD" },
        },
      },
      {
        Total: {
          UnblendedCost: { Amount: "7.30", Unit: "USD" },
        },
      },
    ],
  })
);

mock.module("@aws-sdk/client-cost-explorer", () => ({
  CostExplorerClient: class {
    send = mockSend;
  },
  GetCostAndUsageCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { createAwsProvider, loadAwsConfig } = await import("./aws");

test("createAwsProvider sums costs across ResultsByTime periods", async () => {
  const provider = createAwsProvider("prod", {
    access_key_id: "AKIATEST",
    secret_access_key: "secret",
  });
  const result = await provider();
  expect(result.provider).toBe("aws");
  expect(result.account).toBe("prod");
  expect(result.totalCost).toBe(19.80);
  expect(result.currency).toBe("USD");
  expect(typeof result.lastUpdated).toBe("string");
});

test("createAwsProvider returns 0 cost and USD when ResultsByTime is empty", async () => {
  mockSend.mockImplementationOnce(() =>
    Promise.resolve({ ResultsByTime: [] })
  );
  const provider = createAwsProvider("dev", {
    access_key_id: "AKIATEST",
    secret_access_key: "secret",
  });
  const result = await provider();
  expect(result.totalCost).toBe(0);
  expect(result.currency).toBe("USD");
});

test("loadAwsConfig parses YAML into ProviderConfig", () => {
  const tmpPath = "/tmp/aws-test.yaml";
  writeFileSync(
    tmpPath,
    `default: prod\nprod:\n  access_key_id: AKIA1\n  secret_access_key: s1\ndev:\n  access_key_id: AKIA2\n  secret_access_key: s2\n`
  );
  const config = loadAwsConfig(tmpPath);
  unlinkSync(tmpPath);

  expect(config.default).toBe("prod");
  expect(typeof config.accounts.prod).toBe("function");
  expect(typeof config.accounts.dev).toBe("function");
  expect(config.accounts["default"]).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
bun test src/providers/aws.test.ts
```

Expected: error — `Cannot find module './aws'`

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/providers/aws.test.ts
git commit -m "test: add failing tests for AWS provider"
```

---

### Task 3: Implement the AWS provider

**Files:**
- Create: `src/providers/aws.ts`

- [ ] **Step 1: Create the provider implementation**

Create `src/providers/aws.ts`:

```ts
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { format, startOfMonth, addDays, startOfDay } from "date-fns";
import { utc } from "@date-fns/utc";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, ProviderFn, ProviderConfig } from "./types";

export interface AwsAccountConfig {
  access_key_id: string;
  secret_access_key: string;
}

interface AwsYaml {
  default: string;
  [account: string]: AwsAccountConfig | string;
}

export function createAwsProvider(name: string, config: AwsAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const client = new CostExplorerClient({
      region: "us-east-1",
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
    });

    const now = new Date();
    const start = format(startOfMonth(now, { in: utc }), "yyyy-MM-dd");
    const end = format(addDays(startOfDay(now, { in: utc }), 1), "yyyy-MM-dd");

    const response = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      })
    );

    const results = response.ResultsByTime ?? [];
    let totalCost = 0;
    let currency = "USD";

    for (const period of results) {
      const amount = period.Total?.UnblendedCost?.Amount;
      const unit = period.Total?.UnblendedCost?.Unit;
      if (amount) totalCost += parseFloat(amount);
      if (unit) currency = unit;
    }

    return {
      provider: "aws",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  };
}

export function loadAwsConfig(path = "aws.yaml"): ProviderConfig {
  const raw = parse(readFileSync(path, "utf8")) as AwsYaml;
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createAwsProvider(key, val as AwsAccountConfig);
  }

  return { default: raw.default, accounts };
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
bun test src/providers/aws.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/providers/aws.ts
git commit -m "feat: add AWS Cost Explorer provider"
```

---

### Task 4: Create aws.yaml.example

**Files:**
- Create: `aws.yaml.example`

- [ ] **Step 1: Create the example config file**

Create `aws.yaml.example`:

```yaml
# AWS account configuration
# Copy this file to aws.yaml and fill in your credentials.
# aws.yaml is gitignored — never commit real credentials.

# Name of the account to use when no account is specified in the API path.
default: prod

prod:
  access_key_id: AKIAIOSFODNN7EXAMPLE
  secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Add more accounts by repeating the block with a different name.
# dev:
#   access_key_id: AKIAI...
#   secret_access_key: ...
```

- [ ] **Step 2: Commit**

```bash
git add aws.yaml.example
git commit -m "chore: add aws.yaml.example credential template"
```

---

### Task 5: Register AWS provider in index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add the AWS import and registration**

In `src/index.ts`, add the import after the OCI import on line 3:

```ts
import { loadOciConfig } from "./providers/oci";
import { loadAwsConfig } from "./providers/aws";
```

Update the `providerConfigs` object on lines 6–8:

```ts
const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run --bun tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register AWS provider in server"
```

---

### Task 6: Create docs/oci-setup.md

**Files:**
- Create: `docs/oci-setup.md`

- [ ] **Step 1: Create the OCI setup doc**

Create `docs/oci-setup.md` with the OCI credential instructions currently in README (the full "OCI credential setup" section):

```markdown
# OCI Credential Setup

Open `oci.yaml` (copy from `oci.yaml.example`). The file is a map of named accounts. Each account block requires five fields.

## `tenancy_id`

1. Log in to the [OCI Console](https://cloud.oracle.com)
2. Click your **profile icon** (top right) → **Tenancy: `<your-tenancy-name>`**
3. Copy the **OCID** shown on the Tenancy detail page

The value starts with `ocid1.tenancy.oc1..`

---

## `user_id`

1. Click your **profile icon** (top right) → **User Settings** (or **My Profile**)
2. Copy the **User OCID** shown at the top of the page

The value starts with `ocid1.user.oc1..`

---

## `fingerprint` and `private_key`

These are generated together when you add an API key.

1. Go to **Profile icon** → **User Settings** → **Tokens and keys** → **Add API Key**
2. Choose **Generate API Key Pair**
3. Click **Download Private Key** to save the `.pem` file somewhere safe
4. Click **Add** — the confirmation dialog shows the **fingerprint** (format: `xx:xx:xx:xx:...`)
5. Set `fingerprint` to that value

For `private_key`, paste the PEM file contents directly using a YAML block scalar (`|`) — no `\n` escaping needed:

```yaml
private_key: |
  -----BEGIN RSA PRIVATE KEY-----
  MIIEowIBAAKCAQEA...
  -----END RSA PRIVATE KEY-----
```

---

## `region`

Common values:

| Region | Identifier |
|--------|-----------|
| US East (Ashburn) | `us-ashburn-1` |
| US West (Phoenix) | `us-phoenix-1` |
| EU Frankfurt | `eu-frankfurt-1` |
| AP Sydney | `ap-sydney-1` |
| AP Melbourne | `ap-melbourne-1` |
| AP Tokyo | `ap-tokyo-1` |

---

## Multiple accounts

Add as many named blocks as you like. Set `default:` to the account name used when no account is specified in the URL:

```yaml
default: prod

prod:
  tenancy_id: ocid1.tenancy.oc1..aaaaaaaa...
  # ...

dev:
  tenancy_id: ocid1.tenancy.oc1..bbbbbbbb...
  # ...
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/oci-setup.md
git commit -m "docs: move OCI setup instructions to docs/oci-setup.md"
```

---

### Task 7: Create docs/aws-setup.md

**Files:**
- Create: `docs/aws-setup.md`

- [ ] **Step 1: Create the AWS setup doc**

Create `docs/aws-setup.md`:

```markdown
# AWS Credential Setup

## Prerequisites

### Enable Cost Explorer

Cost Explorer must be activated before the API can be used. It is free for up to 1 million API requests per month.

1. Log in to the [AWS Console](https://console.aws.amazon.com)
2. Go to **Billing and Cost Management** → **Cost Explorer**
3. Click **Enable Cost Explorer** if prompted
4. Wait a few minutes for activation (first-time setup may take up to 24 hours to populate data)

Repeat for each AWS account you want to query.

---

## Create an IAM user with least-privilege access

Repeat these steps for each AWS account you want to query. Each account gets its own IAM user.

### 1. Create the IAM user

1. Go to **IAM** → **Users** → **Create user**
2. Enter a username, e.g. `cloud-bills-reader`
3. **Do not** enable AWS Management Console access — this user only needs programmatic access
4. Click **Next**

### 2. Attach the least-privilege policy

On the **Set permissions** page:

1. Choose **Attach policies directly**
2. Click **Create policy** (opens a new tab)
3. Switch to the **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ce:GetCostAndUsage"],
      "Resource": "*"
    }
  ]
}
```

4. Click **Next**, name the policy `CloudBillsReadCosts`, click **Create policy**
5. Back on the user creation tab, refresh the policy list and attach `CloudBillsReadCosts`
6. Click **Next** → **Create user**

> `Resource: "*"` is required — AWS Cost Explorer does not support resource-level restrictions.

### 3. Generate access keys

1. Click on the new user → **Security credentials** tab
2. Under **Access keys**, click **Create access key**
3. Choose **Other** as the use case
4. Copy the **Access key ID** and **Secret access key** — the secret is only shown once

---

## Configure aws.yaml

```bash
cp aws.yaml.example aws.yaml
```

Fill in your credentials:

```yaml
default: prod

prod:
  access_key_id: AKIAIOSFODNN7EXAMPLE
  secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### Multiple accounts

Add one block per account. The `default` key sets which account is used when no account name is given in the URL:

```yaml
default: prod

prod:
  access_key_id: AKIA...
  secret_access_key: ...

dev:
  access_key_id: AKIA...
  secret_access_key: ...
```

---

## API usage

### Query the default AWS account

```bash
curl http://localhost:3000/aws
```

### Query a specific named account

```bash
curl http://localhost:3000/aws/prod
curl http://localhost:3000/aws/dev
```

### Example response

```json
{
  "provider": "aws",
  "account": "prod",
  "totalCost": 14.73,
  "currency": "USD",
  "lastUpdated": "2026-04-22T10:00:00.000Z"
}
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/aws-setup.md
git commit -m "docs: add AWS IAM setup guide"
```

---

### Task 8: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README with trimmed, provider-agnostic version**

Replace the entire contents of `README.md` with:

```markdown
# cloud-bills

A unified REST API for querying current-month cloud spend across providers. Built with Bun, Hono, and TypeScript — runs locally and returns spend data in a consistent JSON format.

## Supported providers

| Provider | Config file | Setup guide |
|----------|------------|-------------|
| Oracle Cloud (OCI) | `oci.yaml` | [docs/oci-setup.md](docs/oci-setup.md) |
| Amazon Web Services (AWS) | `aws.yaml` | [docs/aws-setup.md](docs/aws-setup.md) |

## Prerequisites

[Bun](https://bun.sh) runtime:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

```bash
git clone <repo>
cd cloud-bills
bun install
```

Copy and fill in the config file for each provider you want to use:

```bash
cp oci.yaml.example oci.yaml   # then follow docs/oci-setup.md
cp aws.yaml.example aws.yaml   # then follow docs/aws-setup.md
```

## Running the server

```bash
bun run dev    # development with hot reload
bun run start  # production
```

The server listens on **http://localhost:3000**.

## API

### Query the default account for a provider

```bash
curl http://localhost:3000/oci
curl http://localhost:3000/aws
```

### Query a specific named account

```bash
curl http://localhost:3000/oci/prod
curl http://localhost:3000/aws/dev
```

### Query all providers and accounts

```bash
curl http://localhost:3000/balance
```

### Response format

```json
{
  "provider": "aws",
  "account": "prod",
  "totalCost": 14.73,
  "currency": "USD",
  "lastUpdated": "2026-04-22T10:00:00.000Z"
}
```

## Adding more providers

1. Create `src/providers/<name>.ts` exporting `createProvider` and `loadConfig` returning `ProviderConfig`
2. Register it in `src/index.ts` under `providerConfigs`
3. Create `<name>.yaml.example` and add `<name>.yaml` to `.gitignore`
4. Add a setup guide at `docs/<name>-setup.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: trim README, link to per-provider setup guides"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| AWS provider with `access_key_id` + `secret_access_key` | Task 3 |
| `aws.yaml` multi-account YAML config | Tasks 3 + 4 |
| `loadAwsConfig` follows OCI pattern | Task 3 |
| Register in `src/index.ts` | Task 5 |
| IAM least-privilege instructions | Task 7 |
| Move OCI docs to own file | Task 6 |
| Create AWS setup doc | Task 7 |
| Update README | Task 8 |

**Placeholder scan:** None found — all steps contain complete code or exact commands.

**Type consistency:** `AwsAccountConfig`, `createAwsProvider`, `loadAwsConfig` are defined in Task 3 and referenced consistently in Tasks 4 and 5. `ProviderConfig`, `ProviderFn`, `CostResult` imported from `./types` throughout.
