# OCI Credential Setup

To fetch cost data from Oracle Cloud Infrastructure (OCI), you should create a dedicated IAM user and grant it the minimal permissions required to read usage data.

## 1. Get your Tenancy OCID

1.  Log in to the [OCI Console](https://cloud.oracle.com).
2.  Click your **profile icon** (top right) → **Tenancy: `<your-tenancy-name>`**.
3.  Copy the **OCID** shown on the Tenancy detail page.
    *   The value starts with `ocid1.tenancy.oc1..`

## 2. Create an IAM Group and User

It is best practice to manage permissions via groups.

1.  Go to **Identity & Security** → **Groups** → **Create Group**.
2.  Name it `cloud-bills-readers` and click **Create**.
3.  Go to **Identity & Security** → **Users** → **Create User**.
4.  Name it `cloud-bills-reader`.
5.  After creation, click **Add User to Group** and select the `cloud-bills-readers` group.
6.  Copy the **User OCID** from the user's detail page.
    *   This will be your `user_id` in `oci.yaml`.
    *   The value starts with `ocid1.user.oc1..`

## 3. Create a Least-Privilege Policy

To query cost data, the user needs permission to read usage reports at the tenancy level.

1.  Go to **Identity & Security** → **Policies** → **Create Policy**.
2.  Name it `CloudBillsReadUsage`.
3.  Ensure the **Compartment** is set to the **root compartment** (your tenancy).
4.  In the **Policy Builder**, click **Show manual editor** and paste:

```hcl
Allow group cloud-bills-readers to read usage-report in tenancy
```

5.  Click **Create**.

## 4. Generate API Keys

1.  Go to the detail page of the `cloud-bills-reader` user you created in Step 2.
2.  Under **Resources** (left sidebar), click **API Keys**.
3.  Click **Add API Key**.
4.  Choose **Generate API Key Pair**.
5.  Click **Download Private Key** to save the `.pem` file.
6.  Click **Add**.
7.  Copy the **Fingerprint** from the confirmation dialog (format: `xx:xx:xx:xx:...`).

## 5. Configure `oci.yaml`

Create an `oci.yaml` file in the project root based on `oci.yaml.example`.

For `private_key`, paste the PEM file contents directly using a YAML block scalar (`|`):

```yaml
default: prod

prod:
  tenancy_id: "ocid1.tenancy.oc1..your-tenancy-id"
  user_id: "ocid1.user.oc1..your-user-id"
  fingerprint: "your-fingerprint"
  region: "us-ashburn-1"
  private_key: |
    -----BEGIN RSA PRIVATE KEY-----
    MIIEowIBAAKCAQEA...
    -----END RSA PRIVATE KEY-----
```

### Common Regions

| Region | Identifier |
|--------|-----------|
| US East (Ashburn) | `us-ashburn-1` |
| US West (Phoenix) | `us-phoenix-1` |
| EU Frankfurt | `eu-frankfurt-1` |
| AP Sydney | `ap-sydney-1` |
| AP Tokyo | `ap-tokyo-1` |

## Multiple accounts

Add as many named blocks as you like. The `default` key sets which account is used when no account is specified in the URL:

```yaml
default: prod

prod:
  # ...
dev:
  # ...
```
