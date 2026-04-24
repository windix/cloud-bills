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
