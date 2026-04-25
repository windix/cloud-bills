# cloud-bills

A unified REST API for querying current-month cloud spend across providers. Built with Bun, Hono, and TypeScript — runs locally and returns spend data in a consistent JSON format.

## Supported providers

| Provider | Config file | Setup guide |
|----------|------------|-------------|
| Oracle Cloud (OCI) | `oci.yaml` | [docs/oci-setup.md](docs/oci-setup.md) |
| Amazon Web Services (AWS) | `aws.yaml` | [docs/aws-setup.md](docs/aws-setup.md) |
| Microsoft Azure | `azure.yaml` | [docs/azure-setup.md](docs/azure-setup.md) |
| Google Cloud Platform (GCP) | `gcp.yaml` | [docs/gcp-setup.md](docs/gcp-setup.md) |

## Prerequisites

[Bun](https://bun.sh) runtime:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

```bash
git clone <repo>
cd cloud-bills
bun install
```

Copy and fill in the config file for each provider you want to use:

```bash
cp oci.yaml.example oci.yaml      # then follow docs/oci-setup.md
cp aws.yaml.example aws.yaml      # then follow docs/aws-setup.md
cp azure.yaml.example azure.yaml  # then follow docs/azure-setup.md
cp gcp.yaml.example gcp.yaml      # then follow docs/gcp-setup.md
```

## Running the server

```bash
bun run dev    # development with hot reload
bun run start  # production
```

The server listens on **http://localhost:3000**.

## API documentation

Interactive API docs (Swagger UI) are available at **http://localhost:3000/docs** while the server is running. The OpenAPI 3.1 spec is served at **http://localhost:3000/openapi.json**.

## API

### Query the default account for a provider

```bash
curl http://localhost:3000/oci
curl http://localhost:3000/aws
curl http://localhost:3000/azure
curl http://localhost:3000/gcp
```

### Query a specific named account

```bash
curl http://localhost:3000/oci/prod
curl http://localhost:3000/aws/dev
curl http://localhost:3000/azure/staging
curl http://localhost:3000/gcp/main
```

### Query all providers and accounts

```bash
curl http://localhost:3000/balance
```

### Response format

```json
{
  "provider": "aws",
  "account": "prod",
  "totalCost": 14.73,
  "currency": "USD",
  "lastUpdated": "2026-04-22T10:00:00.000Z"
}
```

## Dashboard

A web UI for viewing cost data is available in the [`dashboard/`](dashboard/) directory. It fetches `GET /balance` and displays per-provider summary cards and a sorted account list with light/dark theme support.

```bash
cd dashboard && bun install && bun run dev
# open http://localhost:5173
```

See [dashboard/README.md](dashboard/README.md) for full details.

## Docker

Two Dockerfiles are provided:

| File | Base image | Notes |
|------|-----------|-------|
| `Dockerfile` | `node:alpine` | Uses Node.js; compiles TypeScript to JS with `esbuild` at build time, runs with plain `node` |
| `Dockerfile.bun` | `oven/bun` | Original Bun-based image |

Build and run with the default (Node.js) image:

```bash
docker build -t cloud-bills .
docker run -p 3000:3000 -v $(pwd)/config:/app/config cloud-bills
```

Or with the Bun image:

```bash
docker build -f Dockerfile.bun -t cloud-bills-bun .
docker run -p 3000:3000 -v $(pwd)/config:/app/config cloud-bills-bun
```

Alternatively, use Docker Compose (uses the default `Dockerfile`):

```bash
docker compose up
```

## Adding more providers

1. Create `src/providers/<name>.ts` exporting `createProvider` and `loadConfig` returning `ProviderConfig`
2. Register it in `src/app.ts` under `providerConfigs`
3. Create `<name>.yaml.example` and add `<name>.yaml` to `.gitignore`
4. Add a setup guide at `docs/<name>-setup.md`
