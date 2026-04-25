# Stage 1: build the Vue dashboard
FROM oven/bun AS dashboard-builder
WORKDIR /build
COPY dashboard/package.json dashboard/bun.lock ./
RUN bun install --frozen-lockfile
COPY dashboard/ .
RUN bunx vite build

# Stage 2: runtime
FROM oven/bun AS runtime
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src/ ./src/
COPY tsconfig.json ./
COPY --from=dashboard-builder /build/dist ./dashboard/dist
EXPOSE 3000
CMD ["bun", "src/index.ts"]
