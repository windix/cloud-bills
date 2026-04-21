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
cp .env.example .env
```

Then fill in your credentials in `.env` — see the [OCI credential setup](#oci-credential-setup) section below.

## OCI credential setup

Open `.env` and set the following variables. Each step below explains exactly where to find each value.

---

### `OCI_TENANCY_ID`

1. Log in to the [OCI Console](https://cloud.oracle.com)
2. Click your **profile icon** (top right) → **Tenancy: `<your-tenancy-name>`**
3. Copy the **OCID** shown on the Tenancy detail page

The value starts with `ocid1.tenancy.oc1..`

```
OCI_TENANCY_ID=ocid1.tenancy.oc1..aaaaaaaa...
```

---

### `OCI_USER_ID`

1. Click your **profile icon** (top right) → **User Settings** (or **My Profile**)
2. Copy the **User OCID** shown at the top of the page

The value starts with `ocid1.user.oc1..`

```
OCI_USER_ID=ocid1.user.oc1..aaaaaaaa...
```

---

### `OCI_FINGERPRINT` and `OCI_PRIVATE_KEY`

These are generated together when you add an API key.

1. Go to **Profile icon** → **User Settings** → **API Keys** → **Add API Key**
2. Choose **Generate API Key Pair**
3. Click **Download Private Key** to save the `.pem` file somewhere safe
4. Click **Add** — the confirmation dialog shows the **fingerprint** (format: `xx:xx:xx:xx:...`)
5. Set `OCI_FINGERPRINT` to that value:
   ```
   OCI_FINGERPRINT=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
   ```

6. For `OCI_PRIVATE_KEY`, the entire PEM file contents must be on a single line with `\n` replacing actual newlines. Run this command, substituting your actual path:
   ```bash
   awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' /path/to/private-key.pem
   ```
   Paste the output as the value in `.env` (no surrounding quotes needed):
   ```
   OCI_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----\n
   ```

---

### `OCI_REGION`

Your OCI region identifier. Find it in the Console URL or the region selector in the top bar.

Common values:

| Region | Identifier |
|--------|-----------|
| US East (Ashburn) | `us-ashburn-1` |
| US West (Phoenix) | `us-phoenix-1` |
| EU Frankfurt | `eu-frankfurt-1` |
| AP Sydney | `ap-sydney-1` |
| AP Tokyo | `ap-tokyo-1` |

```
OCI_REGION=ap-sydney-1
```

---

## Running the server

```bash
bun run dev    # development with hot reload
bun run start  # production
```

The server listens on **http://localhost:3000**.

## API usage

### Query OCI balance

```bash
curl http://localhost:3000/balance/oci
```

### Query all providers

```bash
curl http://localhost:3000/balance
```

### Example response

```json
{
  "provider": "oci",
  "totalCost": 2.47,
  "currency": "AUD",
  "lastUpdated": "2026-04-21T10:00:00.000Z"
}
```

## Adding more providers

1. Create a new file in `src/providers/` (e.g. `src/providers/aws.ts`)
2. Export a default function matching the `ProviderFn` type
3. Register it in `src/index.ts`
