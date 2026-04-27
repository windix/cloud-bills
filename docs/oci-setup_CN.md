# OCI 凭证配置

要从 Oracle Cloud Infrastructure (OCI) 获取费用数据，您应创建一个专用 IAM 用户，并授予其读取使用情况数据所需的最小权限。

选择以下两种方式之一：**控制台操作**（步骤 1–4）或 [**CLI 方式**](#cli-方式)，完成后配置 [`oci.yaml`](#配置-ociyaml)。

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

## CLI 方式

如果您已安装 OCI CLI 并配置了管理员 profile，可以用一段脚本完成上述步骤 1–4。完成后继续配置 [`oci.yaml`](#配置-ociyaml)。

**前置条件：** 安装 OCI CLI（macOS 执行 `brew install oci-cli`；其他平台参见[官方文档](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm)），然后运行 `oci setup config` 配置管理员 profile。

```bash
# 从管理员 ~/.oci/config 读取租户 OCID
TENANCY_OCID=$(awk -F= '/tenancy/{print $2; exit}' ~/.oci/config | tr -d ' ')

# 创建组
GROUP_OCID=$(oci iam group create \
  --name cloud-bills-readers \
  --description "Read-only access for cloud-bills" \
  --query 'data.id' --raw-output)

# 创建用户
USER_OCID=$(oci iam user create \
  --name cloud-bills-reader \
  --description "Service user for cloud-bills" \
  --query 'data.id' --raw-output)

# 将用户加入组
oci iam group add-user --user-id "$USER_OCID" --group-id "$GROUP_OCID"

# 在租户（根）级别创建最小权限策略
oci iam policy create \
  --compartment-id "$TENANCY_OCID" \
  --name CloudBillsReadUsage \
  --description "Allow cloud-bills-readers to read usage reports" \
  --statements '["Allow group cloud-bills-readers to read usage-reports in tenancy"]'

# 在本地生成 RSA 密钥对
mkdir -p ~/.oci/keys
openssl genrsa -out ~/.oci/keys/cloud-bills-reader.pem 2048
chmod 600 ~/.oci/keys/cloud-bills-reader.pem
openssl rsa -pubout \
  -in  ~/.oci/keys/cloud-bills-reader.pem \
  -out ~/.oci/keys/cloud-bills-reader-public.pem

# 上传公钥并获取指纹
FINGERPRINT=$(oci iam user api-key upload \
  --user-id "$USER_OCID" \
  --key-file ~/.oci/keys/cloud-bills-reader-public.pem \
  --query 'data.fingerprint' --raw-output)

echo ""
echo "将以下值填入 config/oci.yaml："
echo "  tenancy_id:  $TENANCY_OCID"
echo "  user_id:     $USER_OCID"
echo "  fingerprint: $FINGERPRINT"
echo "  private_key: （~/.oci/keys/cloud-bills-reader.pem 的文件内容）"
```

> **身份域说明：** 如果您的当前域是 `OracleIdentityCloudService`，请将 `--statements` 的值替换为：
> ```
> Allow group 'OracleIdentityCloudService'/'cloud-bills-readers' to read usage-reports in tenancy
> ```

## 配置 `oci.yaml`

完成上述控制台操作或 CLI 方式后，在项目根目录根据 `config/oci.yaml.example` 创建 `config/oci.yaml` 文件。

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
