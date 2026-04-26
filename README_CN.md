# cloud-bills

统一的 REST API，用于查询各云服务商当月的云支出。基于 Bun、Hono 和 TypeScript 构建——可本地运行，以一致的 JSON 格式返回支出数据。

## 支持的云服务商

| 服务商 | 配置文件 | 配置指南 |
|----------|------------|-------------|
| Oracle Cloud (OCI) | `oci.yaml` | [docs/oci-setup_CN.md](docs/oci-setup_CN.md) |
| Amazon Web Services (AWS) | `aws.yaml` | [docs/aws-setup_CN.md](docs/aws-setup_CN.md) |
| Microsoft Azure | `azure.yaml` | [docs/azure-setup_CN.md](docs/azure-setup_CN.md) |
| Google Cloud Platform (GCP) | `gcp.yaml` | [docs/gcp-setup_CN.md](docs/gcp-setup_CN.md) |

## 前置条件

安装 [Bun](https://bun.sh) 运行时：

```bash
curl -fsSL https://bun.sh/install | bash
```

## 安装

```bash
git clone <repo>
cd cloud-bills
bun install
```

复制并填写每个要使用的云服务商对应的配置文件：

```bash
cp oci.yaml.example oci.yaml      # 然后参照 docs/oci-setup_CN.md
cp aws.yaml.example aws.yaml      # 然后参照 docs/aws-setup_CN.md
cp azure.yaml.example azure.yaml  # 然后参照 docs/azure-setup_CN.md
cp gcp.yaml.example gcp.yaml      # 然后参照 docs/gcp-setup_CN.md
```

## 启动服务器

```bash
bun run dev      # 开发模式（支持热重载）
bun run start    # 生产模式
bun run dev:all  # 同时启动开发服务器和控制台
```

服务器监听地址：**http://localhost:3000**

## API 文档

服务器运行时，可通过 **http://localhost:3000/docs** 访问交互式 API 文档（Swagger UI）。OpenAPI 3.1 规范地址为 **http://localhost:3000/openapi.json**。

## API

### 查询某服务商的默认账户

```bash
curl http://localhost:3000/oci
curl http://localhost:3000/aws
curl http://localhost:3000/azure
curl http://localhost:3000/gcp
```

### 查询指定账户

```bash
curl http://localhost:3000/oci/prod
curl http://localhost:3000/aws/dev
curl http://localhost:3000/azure/staging
curl http://localhost:3000/gcp/main
```

### 查询所有服务商和账户

```bash
curl http://localhost:3000/balance
```

### 响应格式

```json
{
  "provider": "aws",
  "account": "prod",
  "totalCost": 14.73,
  "currency": "USD",
  "lastUpdated": "2026-04-22T10:00:00.000Z"
}
```

## 控制台（Dashboard）

[`dashboard/`](dashboard/) 目录中提供了一个查看费用数据的 Web 界面，它会请求 `GET /balance` 并展示每个服务商的汇总卡片和按费用排序的账户列表，支持亮色/暗色主题。

```bash
cd dashboard && bun install && bun run dev
# 打开 http://localhost:5173
```

也可以在项目根目录运行 `bun run dev:all`，同时启动服务器和控制台。

详情请参阅 [dashboard/README_CN.md](dashboard/README_CN.md)。

## Docker

提供了两个 Dockerfile：

| 文件 | 基础镜像 | 说明 |
|------|-----------|-------|
| `Dockerfile` | `node:alpine` | 使用 Node.js；构建时用 `esbuild` 将 TypeScript 编译为 JS，以普通 `node` 运行 |
| `Dockerfile.bun` | `oven/bun` | 基于 Bun 的原始镜像 |

使用默认（Node.js）镜像构建并运行：

```bash
docker build -t cloud-bills .
docker run -p 3000:3000 -v $(pwd)/config:/app/config cloud-bills
```

或使用 Bun 镜像：

```bash
docker build -f Dockerfile.bun -t cloud-bills-bun .
docker run -p 3000:3000 -v $(pwd)/config:/app/config cloud-bills-bun
```

也可以使用 Docker Compose（使用默认 `Dockerfile`）：

```bash
docker compose up
```

## Bun 与 Node/npm 在 Docker 中的基准测试

本项目包含一个可复现的 Docker 基准测试工具，用于比较两种容器运行路径：

- `Dockerfile`：Node.js 运行时，`npm install`，TypeScript 打包到 `dist/server.node.cjs`
- `Dockerfile.bun`：Bun 运行时，`bun install`，Bun 直接执行 `src/index.ts`

运行比较测试：

```bash
bun run bench:docker
```

该基准测试会分别构建每个镜像，每次只启动一个容器（避免容器间资源争用），并记录：

- Docker 构建耗时
- 最终镜像大小
- 冷启动时间（至首次 `GET /openapi.json` 成功）
- `GET /openapi.json` 的稳态延迟和吞吐量
- `GET /` 的稳态延迟和吞吐量
- 负载测试期间通过 `docker stats` 采样的 CPU 和内存用量

可以调整请求量和并发数，例如：

```bash
bun run bench:docker --requests 1000 --concurrency 64 --no-cache
```

原始测试结果写入 `benchmarks/results/*.json`。建议至少运行 3 次并比较中位数，而非仅凭单次结果判断。

详情请参阅 [docs/docker-benchmark_CN.md](docs/docker-benchmark_CN.md)。

## 添加更多服务商

1. 创建 `src/providers/<name>.ts`，导出 `createProvider` 和 `loadConfig`（返回 `ProviderConfig`）
2. 在 `src/app.ts` 的 `providerConfigs` 中注册
3. 创建 `<name>.yaml.example` 并将 `<name>.yaml` 添加到 `.gitignore`
4. 在 `docs/<name>-setup_CN.md` 添加配置指南
