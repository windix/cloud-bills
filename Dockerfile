# Stage 1: build the Vue dashboard
FROM node:24-alpine AS dashboard-builder
WORKDIR /build
COPY dashboard/package.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 2: build — compile TS to JS
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY src/ ./src/
COPY tsconfig.json ./
RUN npx esbuild src/server.node.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.node.js

# Stage 3: runtime
FROM node:24-alpine AS runtime
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=dashboard-builder /build/dist ./dashboard/dist
EXPOSE 3000
CMD ["node", "dist/server.node.js"]
