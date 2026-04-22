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
