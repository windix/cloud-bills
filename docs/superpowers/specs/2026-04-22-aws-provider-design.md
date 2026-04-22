# AWS Provider — Multi-Account Cost Support

**Date:** 2026-04-22
**Branch:** feature/aws-provider
**Scope:** Add AWS Cost Explorer provider following the existing OCI YAML-based multi-account pattern; reorganise provider setup docs.

---

## Overview

Add an AWS provider that reads per-account credentials from `aws.yaml`, queries AWS Cost Explorer for current-month spend, and returns a `CostResult` per account. Restructure README to link out to per-provider setup docs.

---

## Architecture

No core changes to `src/index.ts` routing or `src/providers/types.ts`. The new provider plugs into the existing `ProviderConfig` pattern.

```
cloud-bills/
├── src/
│   └── providers/
│       └── aws.ts              # new — mirrors oci.ts structure
├── aws.yaml.example            # new — credential template
├── docs/
│   ├── oci-setup.md            # new — OCI instructions moved from README
│   └── aws-setup.md            # new — AWS IAM + Cost Explorer setup guide
└── README.md                   # updated — overview + links to setup docs
```

---

## `aws.yaml` Config Format

```yaml
# Copy to aws.yaml and fill in credentials. aws.yaml is gitignored.
default: prod

prod:
  access_key_id: AKIAIOSFODNN7EXAMPLE
  secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# dev:
#   access_key_id: ...
#   secret_access_key: ...
```

No `region` field — Cost Explorer is always queried via `us-east-1`.

---

## AWS Provider (`src/providers/aws.ts`)

**Interface:**
```ts
export interface AwsAccountConfig {
  access_key_id: string;
  secret_access_key: string;
}
```

**`createAwsProvider(name, config): ProviderFn`**
1. Initialise `CostExplorerClient` with static credentials and region `us-east-1`
2. Build date range: first day of current month → today (both in `YYYY-MM-DD` format, UTC)
3. Call `GetCostAndUsageCommand` with `Granularity: MONTHLY`, metric `UnblendedCost`
4. Sum all `UnblendedCost.Amount` values across returned time periods
5. Extract currency from first result; default to `"USD"`
6. Return `CostResult` with `provider: "aws"`, `account: name`, rounded total, currency, ISO timestamp

**`loadAwsConfig(path = "aws.yaml"): ProviderConfig`**  
Same shape as `loadOciConfig` — parse YAML, iterate keys, skip `"default"`, build accounts map.

**Dependency:** `@aws-sdk/client-cost-explorer`

---

## `src/index.ts` Change

```ts
import { loadAwsConfig } from "./providers/aws";

const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
};
```

Each provider's config file is loaded at startup. If `aws.yaml` is missing, startup throws — same behaviour as OCI today.

---

## IAM Least-Privilege Policy

Create one IAM user per AWS account with programmatic access only (no console login). Attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ce:GetCostAndUsage"],
    "Resource": "*"
  }]
}
```

`Resource: "*"` is required — Cost Explorer does not support resource-level restrictions.

**Prerequisite:** Cost Explorer must be enabled in each account (AWS Console → Billing → Cost Explorer → Enable). It is free for the first million API requests/month.

---

## Documentation Reorganisation

| File | Change |
|---|---|
| `README.md` | Trim to overview, quickstart, and links to provider setup docs |
| `docs/oci-setup.md` | OCI credential instructions moved verbatim from README |
| `docs/aws-setup.md` | Full AWS guide: enable Cost Explorer, create IAM user, attach policy, generate access key, configure `aws.yaml` |

---

## Error Handling

Follows existing OCI pattern:
- Missing `aws.yaml` at startup → process throws on `loadAwsConfig()`
- Missing/invalid credentials → `CostExplorerClient` throws; caught by router, returned as `{ provider, account, error }` with HTTP 500
- Unknown provider or account → existing 404 handling in router (no change needed)

---

## Out of Scope

- AWS Organizations consolidated billing (each account uses its own credentials)
- IAM role / instance profile credential chain
- Per-service or per-region cost breakdown
