# OCI 凭证配置

要从 Oracle Cloud Infrastructure (OCI) 获取费用数据，您应创建一个专用 IAM 用户，并授予其读取使用情况数据所需的最小权限。

## 1. 获取租户 OCID

1. 登录 [OCI 控制台](https://cloud.oracle.com)。
2. 点击右上角的 **个人资料图标** → **租户：`<您的租户名称>`**。
3. 复制租户详细信息页面上显示的 **OCID**。
    *   该值以 `ocid1.tenancy.oc1..` 开头

## 2. 创建 IAM 组和用户

通过组管理权限是最佳实践。

进入 **身份和安全** → **域**。

在标记为 `当前域` 的域下，创建用户和组。

1. 进入 **用户管理** → **组** 选项卡，点击"创建"按钮。
2. 命名为 `cloud-bills-readers`，点击 **创建**。
3. 进入 **用户管理** → **用户** 选项卡，点击"创建"按钮。
4. 填写用户的名字/姓氏/用户名/电子邮件，在"组"中勾选 `cloud-bills-reader` 组。
5. 从用户详细信息页面复制 **用户 OCID**。
    *   这将是 `oci.yaml` 中的 `user_id`
    *   该值以 `ocid1.user.oc1..` 开头

## 3. 创建最小权限策略

若要查询费用数据，用户需要在租户级别读取使用情况报告的权限。

1. 进入 **身份和安全** → **策略** → **创建策略**。
2. 命名为 `CloudBillsReadUsage`。
3. 填写 **描述**。
4. 确保 **区间** 设置为 **根区间**（您的租户）。
5. 在 **策略生成器** 中，点击 **显示手动编辑器** 并粘贴以下策略语句：

```
Allow group cloud-bills-readers to read usage-reports in tenancy
```

如果您的 `当前域` 是 `OracleIdentityCloudService`，请改用以下策略语句：

```
Allow group 'OracleIdentityCloudService'/'cloud-bills-readers' to read usage-reports in tenancy
```

5. 点击 **创建**。

## 4. 生成 API 密钥

1. 进入您在步骤 2 中创建的 `cloud-bills-reader` 用户的详细信息页面。
2. 在 **资源**（左侧边栏）下，点击 **API 密钥**。
3. 点击 **添加 API 密钥**。
4. 选择 **生成 API 密钥对**。
5. 点击 **下载私钥** 保存 `.pem` 文件。
6. 点击 **添加**。
7. 从确认对话框中复制 **指纹**（格式：`xx:xx:xx:xx:...`）。

## 5. 配置 `oci.yaml`

在项目根目录根据 `oci.yaml.example` 创建 `oci.yaml` 文件。

对于 `private_key`，使用 YAML 块标量（`|`）直接粘贴 PEM 文件内容：

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

### 常用区域

| 区域 | 标识符 |
|--------|-----------|
| 美国东部（阿什本） | `us-ashburn-1` |
| 美国西部（凤凰城） | `us-phoenix-1` |
| 欧洲法兰克福 | `eu-frankfurt-1` |
| 亚太悉尼 | `ap-sydney-1` |
| 亚太东京 | `ap-tokyo-1` |

## 多账户配置

可以添加任意数量的命名配置块。`default` 键指定在 URL 中未指定账户时默认使用的账户：

```yaml
default: prod

prod:
  # ...
dev:
  # ...
```
