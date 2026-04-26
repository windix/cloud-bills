# GCP 配置指南

本指南介绍如何启用 GCP Cloud Billing 导出到 BigQuery，并创建最小权限服务账号，使 cloud-bills 能够查询您当月的支出。

## 前置条件

- 拥有至少一个结算账户的 GCP 账号
- 对结算账户具有 Owner 或 Billing Account Administrator 权限
- 对 BigQuery 所在 GCP 项目具有 Owner 或 Editor 权限

---

## 1. 创建 BigQuery 数据集

1. 在 GCP 控制台中打开 [BigQuery](https://console.cloud.google.com/bigquery)。
2. 在资源管理器面板中，点击您的项目名称 → **创建数据集**。
3. 将 **数据集 ID** 设置为 `billing_export`（或您喜欢的名称——请记录以备后用）。
4. 选择靠近您工作负载的 **位置**。
5. 点击 **创建数据集**。

记录 **项目 ID**（显示在控制台顶部）和 **数据集 ID**——`gcp.yaml` 中需要这两个值。

---

## 2. 启用 Cloud Billing 导出到 BigQuery

1. 在 GCP 控制台中打开 [计费](https://console.cloud.google.com/billing)。
2. 选择您的结算账户。
3. 在左侧菜单中点击 **计费导出**。
4. 点击 **BigQuery 导出** 选项卡。
5. 点击 **标准使用费用** 旁边的 **修改设置**。
6. 将 **项目** 设置为您在上方创建数据集的项目。
7. 将 **数据集** 设置为 `billing_export`（或您选择的名称）。
8. 点击 **保存**。

GCP 会自动创建导出表，表名格式为：

```
gcp_billing_export_v1_<BILLING_ACCOUNT_ID_WITH_UNDERSCORES>
```

例如，结算账户 `AAAAAA-BBBBBB-CCCCCC` 对应的表名为 `gcp_billing_export_v1_AAAAAA_BBBBBB_CCCCCC`。cloud-bills 会根据 `gcp.yaml` 中的 `billing_account_id` 自动推导表名——您无需手动输入表名。

> **注意：** 初始数据可能需要长达 48 小时才会出现。后续每日更新通常在数小时内到达。

---

## 3. 查找您的结算账户 ID

1. 打开 [计费](https://console.cloud.google.com/billing)。
2. 选择您的结算账户。
3. 在左侧菜单中点击 **账户管理**。
4. 顶部显示的 **结算账户 ID** 格式为 `XXXXXX-XXXXXX-XXXXXX`。

---

## 4. 创建最小权限服务账号

服务账号仅需以下两个权限——不多也不少：

| 权限 | 作用范围 | 用途 |
|---|---|---|
| `roles/bigquery.jobUser` | 项目级 | 允许提交查询作业 |
| `roles/bigquery.dataViewer` | 仅限数据集 | 允许读取结算数据集中的行 |

该服务账号无法读取其他数据集、访问 Billing API、管理 IAM 或执行任何写操作。

### a. 创建服务账号

1. 打开 [IAM 和管理 → 服务账号](https://console.cloud.google.com/iam-admin/serviceaccounts)。
2. 确保选中了正确的项目（托管 BigQuery 的项目）。
3. 点击 **创建服务账号**。
4. 将 **服务账号名称** 设置为 `billing-reader`。
5. 点击 **创建并继续**。
6. **跳过** "将此服务账号的访问权限授予项目"步骤——此处不要分配任何角色。
7. 点击 **完成**。

服务账号电子邮件地址为 `billing-reader@<project-id>.iam.gserviceaccount.com`。

### b. 在项目级授予 `BigQuery Job User`

1. 打开 [IAM 和管理 → IAM](https://console.cloud.google.com/iam-admin/iam)。
2. 点击 **授予访问权限**。
3. 在 **新主体** 中粘贴服务账号电子邮件（`billing-reader@<project-id>.iam.gserviceaccount.com`）。
4. 在 **角色** 中搜索并选择 **BigQuery Job User**（`roles/bigquery.jobUser`）。
5. 点击 **保存**。

### c. 仅在数据集级别授予 `BigQuery Data Viewer`

此步骤将数据访问范围限定在结算数据集内。

1. 打开 [BigQuery](https://console.cloud.google.com/bigquery)。
2. 在资源管理器面板中，点击 `billing_export` 数据集（不是表——是数据集本身）。
3. 点击 **共享** → **权限** → **添加主体**。
4. 在 **新主体** 中粘贴服务账号电子邮件。
5. 在 **角色** 中搜索并选择 **BigQuery Data Viewer**（`roles/bigquery.dataViewer`）。
6. 点击 **保存**。

> **不要**在项目级授予 BigQuery Data Viewer——这会使服务账号能够读取项目中的所有数据集。

---

## 5. 下载 JSON 密钥文件

1. 打开 [IAM 和管理 → 服务账号](https://console.cloud.google.com/iam-admin/serviceaccounts)。
2. 点击 `billing-reader@<project-id>.iam.gserviceaccount.com`。
3. 进入 **密钥** 选项卡 → **添加密钥** → **创建新密钥**。
4. 选择 **JSON** → **创建**。
5. 密钥文件将自动下载——请妥善保管。
6. 将其移至仓库根目录下的 `keys/` 目录中（例如 `keys/main-billing-sa.json`）。`keys/` 目录已被 gitignore——切勿提交密钥文件。

如果在为服务账号创建新密钥时遇到"组织策略已阻止服务账号密钥创建"的错误：

原因是 `iam.disableServiceAccountKeyCreation` 已被强制执行。

要禁用该策略（允许密钥创建）：

1. 导航到策略：在 Google Cloud 控制台中，进入 IAM 和管理 > 组织政策。
2. 找到策略：搜索"禁用服务账号密钥创建"。
3. 编辑策略：点击"编辑策略"，选择"替换父级的策略"，并将策略执行设置为"关闭"。
4. 保存：点击"设置策略"。

如果您发现账号没有权限，需要为您的用户添加"组织策略管理员"角色：

进入 IAM，切换到组织级别，为您的用户分配"组织策略管理员"（roles/orgpolicy.policyAdmin）角色，然后再次尝试上述步骤。

---

## 6. 配置 `gcp.yaml`

1. 将 `gcp.yaml.example` 复制为 `gcp.yaml`。
2. 填入以下值：

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
  dataset: billing_export                       # 第 1 步中的数据集 ID
  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"   # 第 3 步中的结算账户 ID
```

3. 启动服务器：

```bash
bun run src/index.ts
```

4. 验证接口：

```bash
curl http://localhost:3000/gcp
```

预期响应：

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

`credits` 是本月所有抵用金的总和（负值）。`creditDetails` 将该总额按抵用金类型和名称拆分，按节省金额从大到小排列。抵用金类型包括 `COMMITTED_USE_DISCOUNT`、`SUSTAINED_USE_DISCOUNT`、`PROMOTION`、`FREE_TIER`、`RESELLER_MARGIN` 和 `SUBSCRIPTION_BENEFIT`。

两个字段均来源于与费用数据相同的结算导出表，无需任何额外 IAM 权限。

> **注意：** 抵用金的到期日期无法通过任何公开 API 获取——仅可在 GCP 控制台的 **计费 → 抵用金** 页面查看。

---

## 了解抵用金的显示时机

`credits` 和 `creditDetails` 字段仅在当前结算周期内有抵用金**实际抵扣使用费**时才会出现在响应中。如果您的账户有抵用金但两个字段均未出现，最可能的原因如下：

**抵用金尚未消耗**
抵用金仅在 GCP 将其用于抵扣费用时才会写入结算导出表。剩余比例为 100%（尚未使用）的抵用金不会出现在 BigQuery 中，因此也不会出现在本 API 的响应中。您可以在 GCP 控制台的 **计费 → 抵用金** 页面确认可用抵用金——但在实际消耗之前，API 仅返回 `totalCost`。

**结算周期尚未结算**
部分抵用金类型（尤其是承诺使用折扣）在结算周期结束时才进行结算，而非实时写入。它们可能要等到账单确认后才会出现在导出表中。

**导出功能近期才启用**
创建新的结算导出时，GCP 不会回填历史抵用金数据。只有在导出启用后产生的抵用金消耗才会出现。

抵用金一旦开始被消耗，便会自动出现在响应中，无需任何配置变更。

---

## 故障排查

| 错误 | 原因 | 解决方法 |
|---|---|---|
| `Not found: Table ... gcp_billing_export_v1_...` | 导出尚未填充或结算账户 ID 错误 | 启用导出后等待 24–48 小时；仔细检查 `billing_account_id` |
| `Permission denied on dataset` | 服务账号缺少数据集上的 `BigQuery Data Viewer` | 重复步骤 4c |
| `Permission denied on project` | 服务账号缺少 `BigQuery Job User` | 重复步骤 4b |
| `SyntaxError: Unexpected token` | `key_json` 格式错误 | 确认值为有效 JSON；直接从下载的密钥文件复制 |
| `Dataset not found` | `project_id` 或 `dataset` 错误 | 与 BigQuery 控制台中的值对照检查 |
