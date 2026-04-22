# cloud-bills

A unified REST API for querying current-month cloud spend across providers. Built with Bun, Hono, and TypeScript — runs locally and returns spend data in a consistent JSON format.

## Supported providers

| Provider | Config file | Setup guide |
|----------|------------|-------------|
| Oracle Cloud (OCI) | `oci.yaml` | [docs/oci-setup.md](docs/oci-setup.md) |
| Amazon Web Services (AWS) | `aws.yaml` | [docs/aws-setup.md](docs/aws-setup.md) |
| Microsoft Azure | `azure.yaml` | [docs/azure-setup.md](docs/azure-setup.md) |

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
```

### Query a specific named account

```bash
curl http://localhost:3000/oci/prod
curl http://localhost:3000/aws/dev
curl http://localhost:3000/azure/staging
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

## Adding more providers

1. Create `src/providers/<name>.ts` exporting `createProvider` and `loadConfig` returning `ProviderConfig`
2. Register it in `src/index.ts` under `providerConfigs`
3. Create `<name>.yaml.example` and add `<name>.yaml` to `.gitignore`
4. Add a setup guide at `docs/<name>-setup.md`
