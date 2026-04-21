# cloud-bills

A unified REST API for querying your current-month cloud spend across providers. Built with Bun, Hono, and TypeScript — runs locally and returns spend data in a consistent JSON format. Currently supports Oracle Cloud Infrastructure (OCI), with more providers to come.

## Prerequisites

- [Bun](https://bun.sh) runtime installed:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- An OCI account with sufficient permissions to query usage/cost data

## Installation

```bash
git clone <repo>
cd cloud-bills
bun install
cp oci.yaml.example oci.yaml
```

Then fill in your credentials in `oci.yaml` — see the [OCI credential setup](#oci-credential-setup) section below.

## OCI credential setup

Open `oci.yaml`. The file is a map of named accounts. Each account block requires five fields.

### `tenancy_id`

1. Log in to the [OCI Console](https://cloud.oracle.com)
2. Click your **profile icon** (top right) → **Tenancy: `<your-tenancy-name>`**
3. Copy the **OCID** shown on the Tenancy detail page

The value starts with `ocid1.tenancy.oc1..`

---

### `user_id`

1. Click your **profile icon** (top right) → **User Settings** (or **My Profile**)
2. Copy the **User OCID** shown at the top of the page

The value starts with `ocid1.user.oc1..`

---

### `fingerprint` and `private_key`

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

### `region`

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

### Multiple accounts

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

---

## Running the server

```bash
bun run dev    # development with hot reload
bun run start  # production
```

The server listens on **http://localhost:3000**.

## API usage

### Query the default OCI account

```bash
curl http://localhost:3000/oci
```

### Query a specific named account

```bash
curl http://localhost:3000/oci/prod
curl http://localhost:3000/oci/dev
```

### Query all providers and accounts

```bash
curl http://localhost:3000/balance
```

### Example response

```json
{
  "provider": "oci",
  "account": "prod",
  "totalCost": 2.47,
  "currency": "AUD",
  "lastUpdated": "2026-04-21T10:00:00.000Z"
}
```

## Adding more providers

1. Create `src/providers/<name>.ts` exporting a `loadConfig()` function returning `ProviderConfig`
2. Register it in `src/index.ts` under `providerConfigs`
3. Create `<name>.yaml.example` and add `<name>.yaml` to `.gitignore`
