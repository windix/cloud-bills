# Azure Setup

To fetch cost data from Azure, you need to create a Service Principal (App Registration) and grant it the **Cost Management Reader** role at the Subscription level.

## 1. Create a Service Principal

1.  Log in to the [Azure Portal](https://portal.azure.com/).
2.  Search for **App registrations** and select it.
3.  Click **+ New registration**.
4.  Enter a name (e.g., `cloud-bills`).
5.  Set **Supported account types** to "Single tenant only - Default Directory".
6.  Click **Register**.
7.  Copy the **Application (client) ID** and **Directory (tenant) ID**.

## 2. Create a Client Secret

1.  In the App registration, go to **Manage > Certificates & secrets**.
2.  Click **+ New client secret**.
3.  Add a description and set an expiration date.
4.  Click **Add**.
5.  Copy the **Value** of the client secret immediately (it won't be shown again).

## 3. Assign Permissions (Least Privilege)

To query cost data, the Service Principal needs the **Cost Management Reader** role.

1.  Search for **Subscriptions** in the Azure Portal.
2.  Select the subscription you want to monitor.
3.  Go to **Access control (IAM)** in the left sidebar.
4.  Click **+ Add** -> **Add role assignment**.
5.  Search for **Cost Management Reader**. Select it and click **Next**.
6.  Click **+ Select members**.
7.  Search for the name of your Service Principal (e.g., `cloud-bills`).
8.  Select it, click **Select**, then **Review + assign**.

## 4. Configuration

Create an `azure.yaml` file in the project root based on `azure.yaml.example`.

```yaml
default: main
main:
  tenant_id: "your-tenant-id"
  client_id: "your-client-id"
  client_secret: "your-client-secret"
  subscription_id: "your-subscription-id"
```
