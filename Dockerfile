# Stage 1: build the Vue dashboard
FROM node:alpine AS dashboard-builder
WORKDIR /build
COPY dashboard/package.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 2: runtime
FROM node:alpine AS runtime
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src/ ./src/
COPY tsconfig.json ./
COPY --from=dashboard-builder /build/dist ./dashboard/dist
EXPOSE 3000
CMD ["npx", "tsx", "src/server.node.ts"]
