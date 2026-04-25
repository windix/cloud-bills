# Docker Benchmarking

This repo now includes a reproducible benchmark for comparing the two supported container execution paths:

- `Dockerfile`: Node.js + `npm install` + bundled server runtime
- `Dockerfile.bun`: Bun + `bun install` + direct TypeScript runtime

The goal is to compare runtime behavior under the same host, Docker Desktop, and application code, while keeping the benchmark focused on server overhead instead of cloud-provider latency.

## What gets measured

Each run captures these metrics for both images:

1. Docker build wall time
2. final image size
3. cold start latency until `GET /openapi.json` returns `200`
4. latency and throughput for `GET /openapi.json`
5. latency and throughput for `GET /`
6. average and peak CPU plus memory usage during each load test, sampled from `docker stats`

`/openapi.json` is used as the API benchmark target because it exercises the app and router without making any outbound cloud API requests. `/` adds a comparable static-file serving check through the dashboard bundle.

## Why the benchmark runs sequentially

The script builds and runs one image at a time. That is intentional.

Running both containers simultaneously would add contention for CPU, memory, filesystem cache, and Docker Desktop networking. Sequential runs produce cleaner runtime deltas.

## Command

From the repo root:

```bash
bun run bench:docker
```

Useful flags:

```bash
bun run bench:docker --requests 1000 --concurrency 64
bun run bench:docker --runtime bun
bun run bench:docker --runtime node --no-cache
bun run bench:docker --keep-images
bun run bench:docker --stats-interval-ms 100
```

## Output

The script prints a summary like this:

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

It also saves raw JSON to `benchmarks/results/<timestamp>.json` so repeated runs can be compared later.

## How to interpret the results

Use these rules when reviewing runs:

1. Compare medians across at least 3 runs, not a single sample.
2. Use `--no-cache` only when you want to compare cold build cost. Leave cache enabled when you care about iterative developer rebuilds.
3. Focus on `/openapi.json` for server/runtime overhead. Use `/` to understand any static-serving differences.
4. CPU and memory are sampled from Docker, so treat them as comparative signals rather than precise profilers.
5. On macOS, Docker Desktop or OrbStack reports usage from the Linux VM environment, which is still useful for Bun vs Node comparison on the same machine.
6. Treat small deltas as noise unless they are stable across repeated runs.
7. If you want provider-specific benchmarking, add a stubbed route or fixture-based provider first. Do not benchmark live cloud requests for runtime comparison because network and remote API jitter will dominate the result.

## Requirements

- Bun installed locally
- Docker running locally
- ports `3101` and `3102` available on the host

No cloud credentials are required for this benchmark because the measured routes do not call provider APIs.