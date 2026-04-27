# OCI Credential Setup

To fetch cost data from Oracle Cloud Infrastructure (OCI), you should create a dedicated IAM user and grant it the minimal permissions required to read usage data.

Choose either the [**Console walkthrough**](#setup-via-console) or the [**CLI alternative**](#setup-via-cli) below, then complete [Configure `oci.yaml`](#configure-ociyaml).

---

## Setup via Console

### 1. Get your Tenancy OCID

1.  Log in to the [OCI Console](https://cloud.oracle.com).
2.  Click your **profile icon** (top right) → **Tenancy: `<your-tenancy-name>`**.
3.  Copy the **OCID** shown on the Tenancy detail page.
    *   The value starts with `ocid1.tenancy.oc1..`

### 2. Create an IAM Group and User

It is best practice to manage permissions via groups.

Go to **Identity & Security** → **Domains**.

Under the domain marked as `current domain`, create user and group.

1.  Go to tab **User management** → **Groups**, click on "Create" button.
2.  Name it `cloud-bills-readers` and click **Create**.
3.  Go to tab **User management** → **Users**, click on "Create" button.
4. FIll in First name / Last name / Username / Email for user creation, tick `cloud-bills-reader` group for Groups.
5.  Copy the **User OCID** from the user's detail page.
    *   This will be your `user_id` in `oci.yaml`.
    *   The value starts with `ocid1.user.oc1..`

### 3. Create a Least-Privilege Policy

To query cost data, the user needs permission to read usage reports at the tenancy level.

1.  Go to **Identity & Security** → **Policies** → **Create Policy**.
2.  Name it `CloudBillsReadUsage`.
3.  Fill in **Description**.
4.  Ensure the **Compartment** is set to the **root compartment** (your tenancy).
5.  In the **Policy Builder**, click **Show manual editor** and paste this policy statement:

```
Allow group cloud-bills-readers to read usage-reports in tenancy
```

If your `current domain` is `OracleIdentityCloudService`, use this policy statement instead:

```
Allow group 'OracleIdentityCloudService'/'cloud-bills-readers' to read usage-reports in tenancy
```

5.  Click **Create**.

### 4. Generate API Keys

1.  Go to the detail page of the `cloud-bills-reader` user you created in Step 2.
2.  Under **Resources** (left sidebar), click **API Keys**.
3.  Click **Add API Key**.
4.  Choose **Generate API Key Pair**.
5.  Click **Download Private Key** to save the `.pem` file.
6.  Click **Add**.
7.  Copy the **Fingerprint** from the confirmation dialog (format: `xx:xx:xx:xx:...`).

Please continue to [Configure `oci.yaml`](#configure-ociyaml) section.

---

## Setup via CLI

If you have the OCI CLI installed and an admin profile configured, steps 1–4 above can be run as a single script. Complete [Configure `oci.yaml`](#configure-ociyaml) afterward.

**Prerequisites:** Install the OCI CLI (`brew install oci-cli` on macOS; see [other platforms](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm)), then run `oci setup config` to configure an admin profile.

```bash
# place update them if required
GROUP_NAME=cb-readers
USER_NAME=cb-reader
USER_EMAIL=cb-reader@email.com

# Read tenancy OCID from your admin ~/.oci/config profile
TENANCY_OCID=$(awk -F= '/tenancy/{print $2; exit}' ~/.oci/config | tr -d ' ')

# Create group
GROUP_OCID=$(oci iam group create \
  --name ${GROUP_NAME} \
  --description "Read-only access for cloud-bills" \
  --query 'data.id' --raw-output)

# Create user
USER_OCID=$(oci iam user create \
  --name ${USER_NAME} \
  --email ${USER_EMAIL} \
  --description "Service user for cloud-bills" \
  --query 'data.id' --raw-output)

# Add user to group
oci iam group add-user --user-id "$USER_OCID" --group-id "$GROUP_OCID"

# Create least-privilege policy at tenancy (root) level
oci iam policy create \
  --compartment-id "$TENANCY_OCID" \
  --name CloudBillsReadUsage \
  --description "Allow ${GROUP_NAME} to read usage reports" \
  --statements '["Allow group '${GROUP_NAME}' to read usage-reports in tenancy"]'

# Generate RSA key pair locally
mkdir -p ~/.oci/keys
openssl genrsa -out ~/.oci/keys/${USER_NAME}.pem 2048
chmod 600 ~/.oci/keys/${USER_NAME}.pem
openssl rsa -pubout \
  -in  ~/.oci/keys/${USER_NAME}.pem \
  -out ~/.oci/keys/${USER_NAME}-public.pem

# Upload public key and capture fingerprint
FINGERPRINT=$(oci iam user api-key upload \
  --user-id "$USER_OCID" \
  --key-file ~/.oci/keys/${USER_NAME}-public.pem \
  --query 'data.fingerprint' --raw-output)

echo ""
echo "Copy these values into config/oci.yaml:"
echo "  tenancy_id:  $TENANCY_OCID"
echo "  user_id:     $USER_OCID"
echo "  fingerprint: $FINGERPRINT"
echo "  private_key: (contents of ~/.oci/keys/${USER_NAME}.pem)"
```

> **Identity domain note:** If your current domain is `OracleIdentityCloudService`, replace the `--statements` value with:
> ```
> Allow group 'OracleIdentityCloudService'/'cloud-bills-readers' to read usage-reports in tenancy
> ```

---

## Configure `oci.yaml`

After completing either the Console walkthrough or CLI alternative above, create a `config/oci.yaml` file based on `config/oci.yaml.example`.

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
