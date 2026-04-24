# Cloud Bills Dashboard

A Vue 3 + Tailwind CSS v4 single-page app that displays cloud spend data from the backend API.

## Stack

- [Vue 3](https://vuejs.org) (Composition API, `<script setup>`)
- [Vite 6](https://vitejs.dev) (dev server with proxy to backend)
- [Tailwind CSS v4](https://tailwindcss.com)
- TypeScript

## Prerequisites

The backend server must be running on `http://localhost:3000`. See the [main README](../README.md) for setup.

## Development

```bash
# Install dependencies
bun install

# Start the dev server (proxies /balance to http://localhost:3000)
bun run dev
```

Open **http://localhost:5173** in your browser.

## Testing

```bash
bun test
```

## Build

```bash
bun run build   # outputs to dist/
bun run preview # preview the production build locally
```

## Features

- **Summary cards** — per-provider total cost, grouped at the top
- **Account list** — all accounts sorted by cost (highest first), errors at the bottom
- **Light / dark theme** — toggle in the header; defaults to OS preference, persists across reloads
- **Responsive** — 4-column summary on desktop, 2-column on mobile
- **Manual refresh** — refresh button in the header re-fetches `/balance`
