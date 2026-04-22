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
