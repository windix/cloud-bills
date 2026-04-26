# Docker 基准测试

本项目现已包含一个可复现的基准测试工具，用于比较两种支持的容器执行路径：

- `Dockerfile`：Node.js + `npm install` + 打包后的服务器运行时
- `Dockerfile.bun`：Bun + `bun install` + 直接运行 TypeScript

目标是在相同主机、Docker Desktop 和应用代码下比较运行时行为，同时将基准测试重点放在服务器开销而非云服务商延迟上。

## 测量指标

每次运行会为两个镜像分别采集以下指标：

1. Docker 构建耗时
2. 最终镜像大小
3. 冷启动延迟（直到 `GET /openapi.json` 返回 `200`）
4. `GET /openapi.json` 的延迟和吞吐量
5. `GET /` 的延迟和吞吐量
6. 每次负载测试期间从 `docker stats` 采样的平均和峰值 CPU 及内存用量

`/openapi.json` 被用作 API 基准测试目标，因为它能测试应用和路由器，而无需发出任何对外云 API 请求。`/` 则通过 dashboard 包额外提供一个可对比的静态文件服务测试。

## 为什么基准测试顺序运行

脚本每次只构建并运行一个镜像，这是有意为之。

同时运行两个容器会造成 CPU、内存、文件系统缓存和 Docker Desktop 网络的资源争用，顺序运行能产生更干净的运行时差异数据。

## 命令

在仓库根目录运行：

```bash
bun run bench:docker
```

可用参数：

```bash
bun run bench:docker --requests 1000 --concurrency 64
bun run bench:docker --runtime bun
bun run bench:docker --runtime node --no-cache
bun run bench:docker --keep-images
bun run bench:docker --stats-interval-ms 100
```

## 输出

脚本会打印如下摘要：

```text
Runtime benchmark summary

NODE
  build time     18.42 s
  image size     241.13 MB
  cold start     812 ms
  API /openapi   1398.4 req/s | p50 18.1 ms | p95 33.5 ms | success 100.0%
                 CPU avg 64.8% | peak 91.3% | mem avg 79.42 MB | peak 83.11 MB | samples 12
  UI /           1210.7 req/s | p50 20.7 ms | p95 39.9 ms | success 100.0%
                 CPU avg 51.2% | peak 72.8% | mem avg 81.04 MB | peak 84.90 MB | samples 11

BUN
  build time     11.37 s
  image size     178.02 MB
  cold start     463 ms
  API /openapi   1660.2 req/s | p50 14.6 ms | p95 26.8 ms | success 100.0%
                 CPU avg 49.5% | peak 77.4% | mem avg 61.30 MB | peak 64.12 MB | samples 12
  UI /           1474.5 req/s | p50 16.8 ms | p95 30.3 ms | success 100.0%
                 CPU avg 38.1% | peak 59.6% | mem avg 62.44 MB | peak 65.02 MB | samples 11
```

同时还会将原始 JSON 数据保存到 `benchmarks/results/<timestamp>.json`，以便后续比较多次运行结果。

## 如何解读结果

查看运行结果时，请遵循以下原则：

1. 至少运行 3 次，比较中位数，而非依赖单次样本。
2. 只有在需要比较冷构建成本时才使用 `--no-cache`。关注迭代开发重构时应保持缓存启用。
3. 以 `/openapi.json` 衡量服务器/运行时开销，以 `/` 了解静态文件服务的差异。
4. CPU 和内存数据从 Docker 采样，应将其视为对比信号而非精确的性能分析器数据。
5. 在 macOS 上，Docker Desktop 或 OrbStack 报告的是 Linux 虚拟机环境中的用量，但在同一台机器上进行 Bun 与 Node 比较时仍然有效。
6. 除非差异在多次运行中保持稳定，否则应将小的差值视为噪声。
7. 如需针对特定服务商进行基准测试，请先添加存根路由或基于 fixture 的服务商。不要使用实时云请求进行运行时比较，因为网络和远程 API 抖动会主导测试结果。

## 环境要求

- 本地安装 Bun
- 本地运行 Docker
- 主机上 `3101` 和 `3102` 端口可用

此基准测试无需云服务凭证，因为被测量的路由不会调用云服务商 API。
