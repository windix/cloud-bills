# Vue Dashboard — Cloud Bills UI

**Date:** 2026-04-24
**Stack:** Vue 3 + Vite + Tailwind CSS v4 + TypeScript
**Scope:** Read-only display dashboard for cloud cost data. No configuration UI.

---

## Overview

A standalone Vue 3 SPA living in `dashboard/` with its own `package.json`. It fetches `GET /balance` from the Hono backend and displays all accounts in a summary header + sorted flat list layout. Supports light/dark theme toggle with OS-preference detection and `localStorage` persistence.

---

## Project Structure

```
cloud-bills/
└── dashboard/
    ├── package.json          # independent — no shared deps with backend
    ├── vite.config.ts        # proxy + Tailwind plugin
    ├── index.html
    └── src/
        ├── main.ts
        ├── App.vue           # root: fetches data, holds state, theme logic
        └── components/
            ├── AppHeader.vue         # navbar: title, refresh button, theme toggle
            ├── SummaryHeader.vue     # per-provider cost cards
            └── AccountList.vue       # flat sorted account rows
```

No router, no store — the app is a single view. State lives in `App.vue` and is passed down via props.

---

## Architecture

### Data flow

1. `App.vue` mounts → calls `fetch('/balance')`
2. Response is an array of `BalanceItem` (success or error shape)
3. Computed: group by provider for `SummaryHeader`, sort by `totalCost` descending for `AccountList` (error rows go to the bottom)
4. Refresh button re-runs the same fetch and updates state

### Vite proxy

```ts
// vite.config.ts
server: {
  proxy: {
    '/balance': 'http://localhost:3000'
  }
}
```

No CORS configuration needed on the backend. During `vite build`, the app targets the same origin (backend serves the built output if deployed together, or a separate host in production).

### TypeScript types

Mirror the backend's existing types — no shared package needed at this stage:

```ts
interface CostResult {
  provider: string
  account: string
  totalCost: number
  currency: string
  lastUpdated: string // ISO 8601
}

interface BalanceError {
  provider: string
  account: string
  error: string
}

type BalanceItem = CostResult | BalanceError
```

A type guard `'error' in item` distinguishes the two shapes throughout the app.

---

## Components

### `App.vue`

- Owns `items: BalanceItem[]`, `loading: boolean`, `lastUpdated: Date | null`, `error: string | null` (top-level fetch failure)
- Owns `isDark: boolean` — toggled by header, stored to `localStorage`, initialised from `localStorage ?? prefers-color-scheme`
- Watches `isDark` to set/remove `dark` class on `<html>`
- Passes computed `providerSummaries` to `SummaryHeader` and `sortedItems` to `AccountList`

### `AppHeader.vue`

Props: `loading`, `lastUpdated`, `isDark`  
Emits: `refresh`, `toggle-theme`

- Title: "☁ Cloud Bills"
- "Updated X min ago" label — hidden on mobile (`hidden sm:block`)
- Refresh button: shows spinner while `loading`, otherwise `↻` icon. On mobile: icon only, no label
- Theme toggle: ☀️/🌙 pill. Active icon has highlighted background. On mobile: replaces text label with icon

### `SummaryHeader.vue`

Props: `summaries: ProviderSummary[]`

```ts
interface ProviderSummary {
  provider: string
  totalCost: number | null  // null only if ALL accounts for this provider errored
  currency: string | null   // null when totalCost is null; assumes same currency per provider
  accountCount: number      // total accounts (success + error)
  errorCount: number        // how many accounts returned an error shape
}
```

- Grid: `grid-cols-4` on `sm+`, `grid-cols-2` on mobile
- Each card: provider name (colored), cost amount, account count
- Partial errors (`errorCount > 0 && totalCost !== null`): show cost with a small "⚠ N failed" note
- Full error (`totalCost === null`): cost shown as "Unavailable" in muted color
- Currencies are not mixed — each card shows its own currency. No cross-provider grand total.

**Provider color map** (consistent across header and list):

| Provider | Light accent | Dark accent |
|----------|-------------|-------------|
| aws      | indigo-500  | indigo-400  |
| gcp      | sky-500     | sky-400     |
| oci      | amber-500   | amber-400   |
| azure    | red-500     | red-400     |
| (other)  | slate-500   | slate-400   |

### `AccountList.vue`

Props: `items: BalanceItem[]` (pre-sorted — errors at bottom)

- Each row: colored dot + provider badge + account name on left; cost + currency on right
- Error row: full row grayed out (`opacity-50`), cost replaced by "Unavailable"
- On mobile: currency label stacks below the provider·account line (saves horizontal space)
- Section label above list: "All accounts · sorted by cost"

---

## Sorting

```ts
const sortedItems = computed(() =>
  [...items.value].sort((a, b) => {
    const aErr = 'error' in a
    const bErr = 'error' in b
    if (aErr && !bErr) return 1
    if (!aErr && bErr) return -1
    if (aErr && bErr) return 0
    return (b as CostResult).totalCost - (a as CostResult).totalCost
  })
)
```

---

## Theme

Tailwind v4 has no `tailwind.config.js`. Dark mode class strategy is declared in CSS:

```css
/* src/style.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

`App.vue` initialises theme state:

```ts
const stored = localStorage.getItem('theme')
isDark.value = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
```

On toggle: flips `isDark`, persists to `localStorage`, updates `document.documentElement.classList`.

---

## Loading & Error States

- **Loading:** skeleton shimmer rows in place of account list; summary cards show placeholder blocks
- **Top-level fetch failure:** banner below header with error message and a retry button
- **Per-account error:** grayed-out row (API already embeds errors inline in the `/balance` response)

---

## Responsive Breakpoints

| Element | Mobile (default) | sm (≥640px) |
|---------|-----------------|-------------|
| Summary grid | 2 columns | 4 columns |
| Navbar "Updated X ago" | hidden | visible |
| Refresh button | icon only | icon + "Refresh" label |
| Account row currency | stacked below | inline right |

---

## Development

```sh
# Start backend
bun run src/index.ts

# Start dashboard dev server (separate terminal)
cd dashboard && bun run dev
# opens http://localhost:5173
```

---

## Out of Scope

- Authentication
- Historical cost charts / trends
- Provider/account configuration UI
- Deployment / containerization
- Auto-refresh (manual only)
