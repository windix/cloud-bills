import { mkdir } from "node:fs/promises";

type Runtime = "node" | "bun";

interface RuntimeConfig {
  runtime: Runtime;
  dockerfile: string;
  tag: string;
  containerName: string;
  port: number;
}

interface BuildResult {
  seconds: number;
  imageBytes: number;
}

interface LoadMetrics {
  totalRequests: number;
  concurrency: number;
  durationSeconds: number;
  requestsPerSecond: number;
  meanLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
}

interface LoadResult extends LoadMetrics {
  resources: ResourceStats;
}

interface ResourceSample {
  cpuPercent: number;
  memoryBytes: number;
}

interface ResourceStats {
  sampleCount: number;
  avgCpuPercent: number;
  peakCpuPercent: number;
  avgMemoryBytes: number;
  peakMemoryBytes: number;
}

interface BenchmarkResult {
  runtime: Runtime;
  build: BuildResult;
  startupMs: number;
  api: LoadResult;
  dashboard: LoadResult;
}

const ROOT = new URL("..", import.meta.url).pathname;
const RESULTS_DIR = `${ROOT}/benchmarks/results`;
const API_PATH = "/openapi.json";
const DASHBOARD_PATH = "/";

const RUNTIMES: RuntimeConfig[] = [
  {
    runtime: "node",
    dockerfile: "Dockerfile",
    tag: "cloud-bills-bench-node",
    containerName: "cloud-bills-bench-node",
    port: 3101,
  },
  {
    runtime: "bun",
    dockerfile: "Dockerfile.bun",
    tag: "cloud-bills-bench-bun",
    containerName: "cloud-bills-bench-bun",
    port: 3102,
  },
];

function parseArgs(argv: string[]) {
  const options = {
    concurrency: 32,
    requests: 400,
    startupTimeoutMs: 30_000,
    statsIntervalMs: 250,
    keepImages: false,
    noCache: false,
    runtime: undefined as Runtime | undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--keep-images") {
      options.keepImages = true;
      continue;
    }
    if (arg === "--no-cache") {
      options.noCache = true;
      continue;
    }
    if (arg === "--runtime") {
      const value = argv[index + 1];
      if (value !== "node" && value !== "bun") {
        throw new Error("--runtime must be 'node' or 'bun'");
      }
      options.runtime = value;
      index += 1;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = parsePositiveInt(arg, argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--requests") {
      options.requests = parsePositiveInt(arg, argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--startup-timeout-ms") {
      options.startupTimeoutMs = parsePositiveInt(arg, argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--stats-interval-ms") {
      options.statsIntervalMs = parsePositiveInt(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parsePositiveInt(flag: string, value: string | undefined): number {
  if (!value) throw new Error(`${flag} requires a value`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index] ?? 0;
}

function printHelp() {
  console.log(`Docker benchmark harness for comparing Bun and Node/npm images

Usage:
  bun scripts/benchmark-docker.ts [options]

Options:
  --runtime <node|bun>        Benchmark only one runtime
  --concurrency <number>      Concurrent requests per load test (default: 32)
  --requests <number>         Requests per load test (default: 400)
  --startup-timeout-ms <ms>   Max wait for container readiness (default: 30000)
  --stats-interval-ms <ms>    Docker stats sample interval (default: 250)
  --no-cache                  Build images with --no-cache
  --keep-images               Keep benchmark images after the run
  -h, --help                  Show this help

Metrics:
  - Docker build wall time
  - Final image size
  - Cold start to first successful /openapi.json response
  - Load test for /openapi.json and /
  - CPU and memory samples from docker stats during each load test
`);
}

function parsePercent(value: string): number {
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)%$/);
  if (!match) throw new Error(`Unable to parse CPU percentage: ${value}`);
  return Number.parseFloat(match[1]!);
}

function parseBytes(value: string): number {
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmgt]?i?)?b?$/i);
  if (!match) throw new Error(`Unable to parse byte value: ${value}`);

  const amount = Number.parseFloat(match[1]!);
  const unit = (match[2] ?? "").toLowerCase();
  const multipliers: Record<string, number> = {
    "": 1,
    k: 1000,
    m: 1000 ** 2,
    g: 1000 ** 3,
    t: 1000 ** 4,
    ki: 1024,
    mi: 1024 ** 2,
    gi: 1024 ** 3,
    ti: 1024 ** 4,
  };
  const multiplier = multipliers[unit];
  if (!multiplier) throw new Error(`Unsupported byte unit: ${value}`);
  return amount * multiplier;
}

function summarizeResources(samples: ResourceSample[]): ResourceStats {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      avgCpuPercent: 0,
      peakCpuPercent: 0,
      avgMemoryBytes: 0,
      peakMemoryBytes: 0,
    };
  }

  const totalCpuPercent = samples.reduce((sum, sample) => sum + sample.cpuPercent, 0);
  const totalMemoryBytes = samples.reduce((sum, sample) => sum + sample.memoryBytes, 0);

  return {
    sampleCount: samples.length,
    avgCpuPercent: totalCpuPercent / samples.length,
    peakCpuPercent: Math.max(...samples.map((sample) => sample.cpuPercent)),
    avgMemoryBytes: totalMemoryBytes / samples.length,
    peakMemoryBytes: Math.max(...samples.map((sample) => sample.memoryBytes)),
  };
}

async function runCommand(command: string[], options?: { quiet?: boolean }) {
  const proc = Bun.spawn(command, {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error([
      `Command failed: ${command.join(" ")}`,
      stdout.trim(),
      stderr.trim(),
    ].filter(Boolean).join("\n\n"));
  }

  if (!options?.quiet) {
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    if (output) console.log(output);
  }

  return { stdout, stderr };
}

async function ensureDocker() {
  await runCommand(["docker", "version"], { quiet: true });
}

async function buildImage(config: RuntimeConfig, noCache: boolean): Promise<BuildResult> {
  const args = ["docker", "build", "-f", config.dockerfile, "-t", config.tag];
  if (noCache) args.push("--no-cache");
  args.push(".");

  const startedAt = performance.now();
  await runCommand(args, { quiet: true });
  const seconds = (performance.now() - startedAt) / 1000;
  const inspect = await runCommand(
    ["docker", "image", "inspect", config.tag, "--format", "{{.Size}}"],
    { quiet: true }
  );
  const imageBytes = Number.parseInt(inspect.stdout.trim(), 10);
  return { seconds, imageBytes };
}

async function removeContainer(name: string) {
  try {
    await runCommand(["docker", "rm", "-f", name], { quiet: true });
  } catch {
    // Container may not exist.
  }
}

async function removeImage(tag: string) {
  try {
    await runCommand(["docker", "rmi", tag], { quiet: true });
  } catch {
    // Image may still be in use or absent.
  }
}

async function startContainer(config: RuntimeConfig, startupTimeoutMs: number): Promise<number> {
  await removeContainer(config.containerName);

  const startedAt = performance.now();
  await runCommand(
    [
      "docker",
      "run",
      "-d",
      "--name",
      config.containerName,
      "-p",
      `${config.port}:3000`,
      config.tag,
    ],
    { quiet: true }
  );

  const readyAt = await waitForHealthy(
    `http://127.0.0.1:${config.port}${API_PATH}`,
    startupTimeoutMs
  );
  return readyAt - startedAt;
}

async function waitForHealthy(url: string, timeoutMs = 30_000): Promise<number> {
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return performance.now();
    } catch {
      // Container may still be starting.
    }
    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function sampleContainerResources(containerName: string): Promise<ResourceSample> {
  const { stdout } = await runCommand(
    [
      "docker",
      "stats",
      "--no-stream",
      "--format",
      "{{.CPUPerc}}|{{.MemUsage}}",
      containerName,
    ],
    { quiet: true }
  );
  const line = stdout.trim();
  const [cpuRaw, memRaw] = line.split("|", 2);
  if (!cpuRaw || !memRaw) {
    throw new Error(`Unexpected docker stats output for ${containerName}: ${line}`);
  }
  const memoryUsed = memRaw.split("/", 2)[0]?.trim();
  if (!memoryUsed) {
    throw new Error(`Unable to parse memory usage for ${containerName}: ${line}`);
  }

  return {
    cpuPercent: parsePercent(cpuRaw),
    memoryBytes: parseBytes(memoryUsed),
  };
}

async function withResourceSampler<T>(
  containerName: string,
  intervalMs: number,
  work: () => Promise<T>
): Promise<{ result: T; resources: ResourceStats }> {
  const samples: ResourceSample[] = [];
  let active = true;

  const sampler = (async () => {
    while (active) {
      try {
        samples.push(await sampleContainerResources(containerName));
      } catch (error) {
        if (active) throw error;
      }

      if (!active) break;
      await Bun.sleep(intervalMs);
    }
  })();

  try {
    const result = await work();
    active = false;
    await sampler;
    return { result, resources: summarizeResources(samples) };
  } catch (error) {
    active = false;
    await sampler.catch(() => undefined);
    throw error;
  }
}

async function warmup(url: string, count = 20) {
  for (let index = 0; index < count; index += 1) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Warmup failed for ${url} with status ${response.status}`);
    }
    await response.arrayBuffer();
  }
}

async function runLoadTest(url: string, requests: number, concurrency: number): Promise<LoadMetrics> {
  const startedAt = performance.now();
  const latenciesMs: number[] = [];
  let successes = 0;
  let completed = 0;
  let nextRequest = 0;

  const worker = async () => {
    while (true) {
      const requestId = nextRequest;
      nextRequest += 1;
      if (requestId >= requests) return;

      const requestStartedAt = performance.now();
      try {
        const response = await fetch(url);
        await response.arrayBuffer();
        if (response.ok) successes += 1;
      } finally {
        latenciesMs.push(performance.now() - requestStartedAt);
        completed += 1;
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, requests) }, () => worker());
  await Promise.all(workers);

  const durationSeconds = (performance.now() - startedAt) / 1000;
  const sorted = [...latenciesMs].sort((left, right) => left - right);
  const meanLatencyMs =
    latenciesMs.reduce((sum, value) => sum + value, 0) / Math.max(latenciesMs.length, 1);

  return {
    totalRequests: completed,
    concurrency,
    durationSeconds,
    requestsPerSecond: completed / durationSeconds,
    meanLatencyMs,
    p50LatencyMs: percentile(sorted, 0.5),
    p95LatencyMs: percentile(sorted, 0.95),
    p99LatencyMs: percentile(sorted, 0.99),
    successRate: completed === 0 ? 0 : successes / completed,
  };
}

function printSummary(results: BenchmarkResult[]) {
  console.log("\nRuntime benchmark summary\n");

  for (const result of results) {
    console.log(`${result.runtime.toUpperCase()}`);
    console.log(`  build time     ${result.build.seconds.toFixed(2)} s`);
    console.log(`  image size     ${formatBytes(result.build.imageBytes)}`);
    console.log(`  cold start     ${result.startupMs.toFixed(0)} ms`);
    console.log(
      `  API /openapi   ${result.api.requestsPerSecond.toFixed(1)} req/s | p50 ${result.api.p50LatencyMs.toFixed(1)} ms | p95 ${result.api.p95LatencyMs.toFixed(1)} ms | success ${(result.api.successRate * 100).toFixed(1)}%`
    );
    console.log(
      `                 CPU avg ${result.api.resources.avgCpuPercent.toFixed(1)}% | peak ${result.api.resources.peakCpuPercent.toFixed(1)}% | mem avg ${formatBytes(result.api.resources.avgMemoryBytes)} | peak ${formatBytes(result.api.resources.peakMemoryBytes)} | samples ${result.api.resources.sampleCount}`
    );
    console.log(
      `  UI /           ${result.dashboard.requestsPerSecond.toFixed(1)} req/s | p50 ${result.dashboard.p50LatencyMs.toFixed(1)} ms | p95 ${result.dashboard.p95LatencyMs.toFixed(1)} ms | success ${(result.dashboard.successRate * 100).toFixed(1)}%`
    );
    console.log(
      `                 CPU avg ${result.dashboard.resources.avgCpuPercent.toFixed(1)}% | peak ${result.dashboard.resources.peakCpuPercent.toFixed(1)}% | mem avg ${formatBytes(result.dashboard.resources.avgMemoryBytes)} | peak ${formatBytes(result.dashboard.resources.peakMemoryBytes)} | samples ${result.dashboard.resources.sampleCount}`
    );
  }
}

async function saveResults(results: BenchmarkResult[]) {
  await mkdir(RESULTS_DIR, { recursive: true });
  await Bun.write(`${RESULTS_DIR}/.gitkeep`, "");

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const filePath = `${RESULTS_DIR}/${timestamp}.json`;
  await Bun.write(filePath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
  console.log(`\nSaved raw results to ${filePath}`);
}

async function benchmarkRuntime(
  config: RuntimeConfig,
  options: ReturnType<typeof parseArgs>
): Promise<BenchmarkResult> {
  console.log(`\n==> ${config.runtime.toUpperCase()}: building ${config.dockerfile}`);
  const build = await buildImage(config, options.noCache);

  console.log(`==> ${config.runtime.toUpperCase()}: starting container`);
  const startupMs = await startContainer(config, options.startupTimeoutMs);

  const apiUrl = `http://127.0.0.1:${config.port}${API_PATH}`;
  const dashboardUrl = `http://127.0.0.1:${config.port}${DASHBOARD_PATH}`;

  await warmup(apiUrl);
  await warmup(dashboardUrl);

  console.log(`==> ${config.runtime.toUpperCase()}: load testing ${API_PATH}`);
  const apiRun = await withResourceSampler(
    config.containerName,
    options.statsIntervalMs,
    () => runLoadTest(apiUrl, options.requests, options.concurrency)
  );

  console.log(`==> ${config.runtime.toUpperCase()}: load testing ${DASHBOARD_PATH}`);
  const dashboardRun = await withResourceSampler(
    config.containerName,
    options.statsIntervalMs,
    () => runLoadTest(dashboardUrl, options.requests, options.concurrency)
  );

  await removeContainer(config.containerName);

  return {
    runtime: config.runtime,
    build,
    startupMs,
    api: { ...apiRun.result, resources: apiRun.resources },
    dashboard: { ...dashboardRun.result, resources: dashboardRun.resources },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await ensureDocker();
  await mkdir(RESULTS_DIR, { recursive: true });
  await Bun.write(`${RESULTS_DIR}/.gitkeep`, "");

  const runtimes = options.runtime
    ? RUNTIMES.filter((config) => config.runtime === options.runtime)
    : RUNTIMES;

  const results: BenchmarkResult[] = [];

  try {
    for (const runtime of runtimes) {
      const result = await benchmarkRuntime(runtime, options);
      results.push(result);
    }
  } finally {
    for (const runtime of runtimes) {
      await removeContainer(runtime.containerName);
      if (!options.keepImages) await removeImage(runtime.tag);
    }
  }

  printSummary(results);
  await saveResults(results);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});