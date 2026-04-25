# Docker + Config Folder Reorganisation — Design Spec

**Date:** 2026-04-25

## Goal

Package the cloud-bills backend and Vue dashboard into a single Docker image. Credentials/config are mounted as a volume at runtime, never baked into the image.

---

## 1. Config Folder Restructure

All credential and config files move from the project root into a `config/` directory:

```
config/
  aws.yaml
  azure.yaml
  gcp.yaml
  oci.yaml
  keys/
    *.json
```

**Changes required:**

- `.gitignore`: replace individual entries (`aws.yaml`, `azure.yaml`, `gcp.yaml`, `oci.yaml`, `keys/`) with a single `config/` entry.
- Move `*.yaml.example` files into `config/` so the expected structure is self-documenting alongside the gitignored files.
- Update each provider loader to resolve config paths relative to `config/` instead of the project root:
  - `src/providers/aws.ts`
  - `src/providers/azure.ts`
  - `src/providers/gcp.ts`
  - `src/providers/oci.ts`

---

## 2. Hono Static File Serving

`src/index.ts` gains a `serveStatic` handler (from `hono/bun`) that serves `dashboard/dist/` at `/`.

- All API routes (`/balance`, `/{provider}`, `/{provider}/{account}`, `/docs`, `/openapi.json`) are registered **before** the static handler so they take priority.
- A catch-all fallback serves `index.html` for all unmatched routes, enabling Vue Router client-side navigation.

The `dashboard/dist/` path is relative to the working directory (`/app` inside the container).

---

## 3. Dockerfile

Multi-stage build using `oven/bun` for both stages, keeping the final image free of dev tooling.

**Stage 1 — dashboard builder**

```dockerfile
FROM oven/bun AS dashboard-builder
WORKDIR /build
COPY dashboard/package.json dashboard/bun.lock ./
RUN bun install --frozen-lockfile
COPY dashboard/ .
RUN bunx vite build
```

**Stage 2 — final runtime**

```dockerfile
FROM oven/bun AS runtime
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src/ ./src/
COPY tsconfig.json ./
COPY --from=dashboard-builder /build/dist ./dashboard/dist
EXPOSE 3000
CMD ["bun", "src/index.ts"]
```

**Volume mount at runtime:**

```
-v ./config:/app/config
```

---

## 4. .dockerignore

Exclude from build context:

```
node_modules/
dashboard/node_modules/
dashboard/dist/
config/
.git/
.worktrees/
*.yaml
```

(`*.yaml.example` files inside `config/` are excluded via `config/` — this is intentional since they contain no secrets and the image doesn't need them.)

---

## 5. docker-compose.yml (optional convenience)

A `docker-compose.yml` at the project root for local use:

```yaml
services:
  cloud-bills:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
```

---

## Out of Scope

- Multi-container setups (reverse proxy, separate frontend container)
- CI/CD pipeline changes
- Health check endpoint
