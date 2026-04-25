# AWS 凭证配置

## 前置条件

### 启用 Cost Explorer

在使用 API 之前，必须先激活 Cost Explorer。每月 100 万次 API 请求以内免费。

1. 登录 [AWS 控制台](https://console.aws.amazon.com)
2. 进入 **账单和成本管理** → **Cost Explorer**
3. 如有提示，点击 **启用 Cost Explorer**
4. 等待几分钟完成激活（首次设置可能需要长达 24 小时才能填充数据）

对每个需要查询的 AWS 账户重复上述操作。

---

## 创建最小权限 IAM 用户

对每个需要查询的 AWS 账户重复以下步骤。每个账户各创建一个独立的 IAM 用户。

### 1. 创建 IAM 用户

1. 进入 **IAM** → **用户** → **创建用户**
2. 输入用户名，例如 `cloud-bills-reader`
3. **不要**启用 AWS 管理控制台访问权限——该用户只需要程序化访问
4. 点击 **下一步**

### 2. 附加最小权限策略

在 **设置权限** 页面：

1. 选择 **直接附加策略**
2. 点击 **创建策略**（在新标签页中打开）
3. 切换到 **JSON** 选项卡并粘贴以下内容：

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

4. 点击 **下一步**，将策略命名为 `CloudBillsReadCosts`，然后点击 **创建策略**
5. 返回用户创建标签页，刷新策略列表并附加 `CloudBillsReadCosts`
6. 点击 **下一步** → **创建用户**

> `Resource: "*"` 是必需的——AWS Cost Explorer 不支持资源级别的限制。

### 3. 生成访问密钥

1. 点击新建的用户 → **安全凭证** 选项卡
2. 在 **访问密钥** 下，点击 **创建访问密钥**
3. 选择 **其他** 作为使用场景
4. 复制 **访问密钥 ID** 和 **私有访问密钥**——私有访问密钥仅显示一次

---

## 配置 aws.yaml

```bash
cp aws.yaml.example aws.yaml
```

填入您的凭证：

```yaml
default: prod

prod:
  access_key_id: AKIAIOSFODNN7EXAMPLE
  secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### 多账户配置

每个账户添加一个配置块。`default` 键指定在 URL 中未指定账户名时默认使用的账户：

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

## API 使用

### 查询默认 AWS 账户

```bash
curl http://localhost:3000/aws
```

### 查询指定账户

```bash
curl http://localhost:3000/aws/prod
curl http://localhost:3000/aws/dev
```

### 响应示例

```json
{
  "provider": "aws",
  "account": "prod",
  "totalCost": 14.73,
  "currency": "USD",
  "lastUpdated": "2026-04-22T10:00:00.000Z"
}
```
