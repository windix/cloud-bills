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

Note the **Dataset ID** — you'll need it in `gcp.yaml`.

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
5. The key file downloads automatically. Open it and copy the full JSON content — you'll paste it into `gcp.yaml` in Step 6.

You may see the error "An organisation policy that blocks service accounts key creation has been enforced on your organisation." when you trying to create new key for Service Account.

The reason is that `iam.disableServiceAccountKeyCreation` has been enforced.

To disable it (allow key creation):

1. Navigate to Policy: In the Google Cloud Console, go to IAM & Admin > Organization Policies.
2. Locate Policy: Search for Disable service account key creation.
3. Edit Policy: Click Edit Policy, select Override parent's policy, and set the policy enforcement to Off.
4. Save: Click Set Policy.

If you found out your account doesn't have permission, need to add 'Organisation Policy Administrator' role to your user:

Go to IAM, change to orgnisation level, Assign 'Organisation Policy Administrator' (roles/orgpolicy.policyAdmin) role to your user and try above again.

---

## 6. Configure `gcp.yaml`

1. Copy `gcp.yaml.example` to `gcp.yaml`.
2. Fill in the values. `project_id` is derived from the key JSON automatically:

```yaml
default: main

main:
  key_json: |
    {
      "type": "service_account",
      "project_id": "my-gcp-project",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "billing-reader@my-gcp-project.iam.gserviceaccount.com",
      "client_id": "...",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "...",
      "universe_domain": "googleapis.com"
    }
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
  "credits": -2.50,
  "creditDetails": [
    { "type": "PROMOTION", "name": "Free trial credit", "amount": -2.00 },
    { "type": "FREE_TIER", "name": "Free tier", "amount": -0.50 }
  ],
  "currency": "USD",
  "lastUpdated": "2026-04-23T10:00:00.000Z"
}
```

`credits` is the total of all credits applied this month (negative value). `creditDetails` breaks that total down by credit type and program name, ordered from largest to smallest savings. Credit types include `COMMITTED_USE_DISCOUNT`, `SUSTAINED_USE_DISCOUNT`, `PROMOTION`, `FREE_TIER`, `RESELLER_MARGIN`, and `SUBSCRIPTION_BENEFIT`.

Both fields are sourced from the same billing export table as cost data, so no additional IAM permissions are required.

> **Note:** Credit expiry dates are not available through any public API — they are only visible in the GCP Console under **Billing → Credits**.

---

## Understanding when credits appear

The `credits` and `creditDetails` fields are only present in the response when credits have actually been **applied against usage charges** in the current billing period. If you have credits on your account but neither field appears, the most likely reasons are:

**Credits not yet consumed**
Credits are recorded in the billing export only when GCP applies them to offset a charge. A credit that is 100% remaining (nothing spent yet) will not appear in BigQuery, and therefore not in this API. You can confirm your available credits in the GCP Console under **Billing → Credits** — but until they are consumed, the API will only return `totalCost`.

**Billing period not yet settled**
Some credit types (particularly committed-use discounts) are settled at the end of the billing cycle rather than in real time. They may not appear in the export until the invoice is finalised.

**Export set up recently**
GCP does not backfill historical credit data when a new billing export is created. Only credits applied after the export was enabled will appear.

Once credits start being consumed, they appear automatically — no configuration changes are needed.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Not found: Table ... gcp_billing_export_v1_...` | Export not yet populated or wrong billing account ID | Wait 24–48h after enabling export; double-check `billing_account_id` |
| `Permission denied on dataset` | SA missing `BigQuery Data Viewer` on the dataset | Repeat Step 4c |
| `Permission denied on project` | SA missing `BigQuery Job User` | Repeat Step 4b |
| `SyntaxError: Unexpected token` | Malformed `key_json` | Ensure the value is valid JSON; copy directly from the downloaded key file |
| `Dataset not found` | Wrong `dataset` | Check the dataset ID matches BigQuery console |
