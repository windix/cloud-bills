# Vue Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Vue 3 SPA in `dashboard/` that fetches `GET /balance` and displays cloud costs as a summary header + flat sorted account list with light/dark theme toggle.

**Architecture:** Independent `dashboard/` folder with its own `package.json`. Vite proxies `/balance` to the Hono backend at `localhost:3000` — no CORS config needed. Pure computation logic (sorting, grouping) extracted to testable utility functions; Vue components own only rendering.

**Tech Stack:** Vue 3 (Composition API), Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), TypeScript, `bun test` + `happy-dom` + `@vue/test-utils`

---

## File Map

```
dashboard/
├── bunfig.toml                        # bun test environment = happy-dom
├── index.html                         # SPA entry point
├── package.json
├── tsconfig.json
├── vite.config.ts                     # Vue plugin + Tailwind plugin + proxy
└── src/
    ├── main.ts                        # mount Vue app
    ├── style.css                      # @import tailwindcss + dark variant
    ├── types.ts                       # CostResult, BalanceError, BalanceItem, ProviderSummary, isCostResult
    ├── App.vue                        # root: fetch state, theme state, computed summaries + sorted items
    ├── components/
    │   ├── AppHeader.vue              # navbar: title, refresh button, ☀️/🌙 toggle
    │   ├── AppHeader.test.ts
    │   ├── SummaryHeader.vue          # per-provider cost cards (2-col mobile, 4-col desktop)
    │   ├── SummaryHeader.test.ts
    │   ├── AccountList.vue            # flat sorted rows; errors grayed out
    │   └── AccountList.test.ts
    └── utils/
        ├── providerColors.ts          # full Tailwind class strings per provider
        ├── computations.ts            # computeProviderSummaries(), sortItems()
        └── computations.test.ts
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/bunfig.toml`
- Create: `dashboard/index.html`

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "cloud-bills-dashboard",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "bun test"
  },
  "dependencies": {
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/test-utils": "^2.4.0",
    "happy-dom": "^15.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.4.0",
    "vite": "^6.0.0",
    "vue-tsc": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `dashboard/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/balance': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 3: Create `dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

- [ ] **Step 4: Create `dashboard/bunfig.toml`**

```toml
[test]
environment = "happy-dom"
```

- [ ] **Step 5: Create `dashboard/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cloud Bills</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Install dependencies**

```bash
cd dashboard && bun install
```

Expected: lock file created, `node_modules/` populated.

- [ ] **Step 7: Commit**

```bash
git add dashboard/
git commit -m "feat: scaffold dashboard project"
```

---

## Task 2: Types, styles, and provider color utility

**Files:**
- Create: `dashboard/src/types.ts`
- Create: `dashboard/src/style.css`
- Create: `dashboard/src/utils/providerColors.ts`

- [ ] **Step 1: Create `dashboard/src/types.ts`**

```ts
export interface CostResult {
  provider: string
  account: string
  totalCost: number
  currency: string
  lastUpdated: string
}

export interface BalanceError {
  provider: string
  account: string
  error: string
}

export type BalanceItem = CostResult | BalanceError

export interface ProviderSummary {
  provider: string
  totalCost: number | null   // null only when ALL accounts for this provider errored
  currency: string | null
  accountCount: number
  errorCount: number
}

export function isCostResult(item: BalanceItem): item is CostResult {
  return !('error' in item)
}
```

- [ ] **Step 2: Create `dashboard/src/style.css`**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

- [ ] **Step 3: Create `dashboard/src/utils/providerColors.ts`**

Full Tailwind class strings are written out in the lookup so Tailwind's static scanner includes them at build time.

```ts
const COLOR_MAP: Record<string, { text: string; dot: string }> = {
  aws:   { text: 'text-indigo-500 dark:text-indigo-400', dot: 'bg-indigo-500 dark:bg-indigo-400' },
  gcp:   { text: 'text-sky-500 dark:text-sky-400',       dot: 'bg-sky-500 dark:bg-sky-400' },
  oci:   { text: 'text-amber-500 dark:text-amber-400',   dot: 'bg-amber-500 dark:bg-amber-400' },
  azure: { text: 'text-red-500 dark:text-red-400',       dot: 'bg-red-500 dark:bg-red-400' },
}

const FALLBACK = { text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400 dark:bg-slate-500' }

export function providerTextClass(provider: string): string {
  return (COLOR_MAP[provider.toLowerCase()] ?? FALLBACK).text
}

export function providerDotClass(provider: string): string {
  return (COLOR_MAP[provider.toLowerCase()] ?? FALLBACK).dot
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/
git commit -m "feat: add types, styles, and provider color utility"
```

---

## Task 3: Computation utilities (TDD)

**Files:**
- Create: `dashboard/src/utils/computations.ts`
- Create: `dashboard/src/utils/computations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `dashboard/src/utils/computations.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { computeProviderSummaries, sortItems } from './computations'
import type { BalanceItem } from '../types'

const aws1: BalanceItem = { provider: 'aws', account: 'prod', totalCost: 120, currency: 'USD', lastUpdated: '' }
const aws2: BalanceItem = { provider: 'aws', account: 'staging', totalCost: 34, currency: 'USD', lastUpdated: '' }
const gcp1: BalanceItem = { provider: 'gcp', account: 'main', totalCost: 55, currency: 'USD', lastUpdated: '' }
const azureErr: BalanceItem = { provider: 'azure', account: 'main', error: 'credentials missing' }

describe('computeProviderSummaries', () => {
  test('sums costs for the same provider', () => {
    const summaries = computeProviderSummaries([aws1, aws2])
    const aws = summaries.find(s => s.provider === 'aws')!
    expect(aws.totalCost).toBe(154)
    expect(aws.accountCount).toBe(2)
    expect(aws.errorCount).toBe(0)
  })

  test('returns null totalCost when all accounts errored', () => {
    const summaries = computeProviderSummaries([azureErr])
    const azure = summaries.find(s => s.provider === 'azure')!
    expect(azure.totalCost).toBeNull()
    expect(azure.currency).toBeNull()
    expect(azure.errorCount).toBe(1)
  })

  test('counts errors separately when provider has mixed results', () => {
    const partialErr: BalanceItem = { provider: 'aws', account: 'broken', error: 'timeout' }
    const summaries = computeProviderSummaries([aws1, partialErr])
    const aws = summaries.find(s => s.provider === 'aws')!
    expect(aws.totalCost).toBe(120)
    expect(aws.errorCount).toBe(1)
    expect(aws.accountCount).toBe(2)
  })

  test('produces one entry per provider', () => {
    const summaries = computeProviderSummaries([aws1, aws2, gcp1])
    expect(summaries).toHaveLength(2)
  })
})

describe('sortItems', () => {
  test('sorts by totalCost descending', () => {
    const sorted = sortItems([gcp1, aws1, aws2])
    expect(sorted.map(i => (i as any).account)).toEqual(['prod', 'main', 'staging'])
  })

  test('error rows go to the bottom', () => {
    const sorted = sortItems([aws2, azureErr, aws1])
    expect((sorted[sorted.length - 1] as any).account).toBe('main') // azure error
  })

  test('does not mutate the input array', () => {
    const input = [gcp1, aws1]
    sortItems(input)
    expect(input[0]).toBe(gcp1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd dashboard && bun test src/utils/computations.test.ts
```

Expected: `Cannot find module './computations'`

- [ ] **Step 3: Create `dashboard/src/utils/computations.ts`**

```ts
import type { BalanceItem, CostResult, ProviderSummary } from '../types'
import { isCostResult } from '../types'

export function computeProviderSummaries(items: BalanceItem[]): ProviderSummary[] {
  const map = new Map<string, ProviderSummary>()
  for (const item of items) {
    const entry = map.get(item.provider) ?? {
      provider: item.provider,
      totalCost: null,
      currency: null,
      accountCount: 0,
      errorCount: 0,
    }
    entry.accountCount++
    if (isCostResult(item)) {
      entry.totalCost = (entry.totalCost ?? 0) + item.totalCost
      entry.currency = item.currency
    } else {
      entry.errorCount++
    }
    map.set(item.provider, entry)
  }
  return [...map.values()]
}

export function sortItems(items: BalanceItem[]): BalanceItem[] {
  return [...items].sort((a, b) => {
    const aErr = !isCostResult(a)
    const bErr = !isCostResult(b)
    if (aErr && !bErr) return 1
    if (!aErr && bErr) return -1
    if (aErr && bErr) return 0
    return (b as CostResult).totalCost - (a as CostResult).totalCost
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd dashboard && bun test src/utils/computations.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/utils/
git commit -m "feat: add computation utilities with tests"
```

---

## Task 4: AppHeader component (TDD)

**Files:**
- Create: `dashboard/src/components/AppHeader.vue`
- Create: `dashboard/src/components/AppHeader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `dashboard/src/components/AppHeader.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import AppHeader from './AppHeader.vue'

const baseProps = { loading: false, lastUpdated: null, isDark: false }

describe('AppHeader', () => {
  test('renders title', () => {
    const wrapper = mount(AppHeader, { props: baseProps })
    expect(wrapper.text()).toContain('Cloud Bills')
  })

  test('emits refresh when refresh button clicked', async () => {
    const wrapper = mount(AppHeader, { props: baseProps })
    await wrapper.find('[data-testid="refresh-btn"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  test('refresh button is disabled while loading', () => {
    const wrapper = mount(AppHeader, { props: { ...baseProps, loading: true } })
    expect(wrapper.find('[data-testid="refresh-btn"]').attributes('disabled')).toBeDefined()
  })

  test('emits toggle-theme with false when sun clicked', async () => {
    const wrapper = mount(AppHeader, { props: { ...baseProps, isDark: true } })
    await wrapper.find('[data-testid="theme-light"]').trigger('click')
    expect(wrapper.emitted('toggle-theme')).toEqual([[false]])
  })

  test('emits toggle-theme with true when moon clicked', async () => {
    const wrapper = mount(AppHeader, { props: baseProps })
    await wrapper.find('[data-testid="theme-dark"]').trigger('click')
    expect(wrapper.emitted('toggle-theme')).toEqual([[true]])
  })

  test('shows last updated text when lastUpdated is set', () => {
    const date = new Date(Date.now() - 2 * 60 * 1000)
    const wrapper = mount(AppHeader, { props: { ...baseProps, lastUpdated: date } })
    expect(wrapper.text()).toContain('min ago')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd dashboard && bun test src/components/AppHeader.test.ts
```

Expected: `Cannot find module './AppHeader.vue'`

- [ ] **Step 3: Create `dashboard/src/components/AppHeader.vue`**

```vue
<script setup lang="ts">
defineProps<{
  loading: boolean
  lastUpdated: Date | null
  isDark: boolean
}>()

const emit = defineEmits<{
  refresh: []
  'toggle-theme': [dark: boolean]
}>()

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} mins ago`
}
</script>

<template>
  <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
    <div class="font-bold text-slate-800 dark:text-slate-100 text-base">☁ Cloud Bills</div>
    <div class="flex items-center gap-2 sm:gap-3">
      <span v-if="lastUpdated" class="hidden sm:block text-xs text-slate-400 dark:text-slate-500">
        Updated {{ timeAgo(lastUpdated) }}
      </span>
      <button
        data-testid="refresh-btn"
        :disabled="loading"
        @click="emit('refresh')"
        class="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 sm:px-3 py-1 text-xs text-slate-500 dark:text-slate-300 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        <span :class="loading ? 'animate-spin inline-block' : ''">↻</span>
        <span class="hidden sm:inline">Refresh</span>
      </button>
      <div class="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full p-0.5 flex">
        <button
          data-testid="theme-light"
          @click="emit('toggle-theme', false)"
          :class="!isDark ? 'bg-white dark:bg-slate-600 shadow-sm' : 'opacity-40'"
          class="rounded-full px-1.5 py-0.5 text-xs transition-all cursor-pointer"
        >☀️</button>
        <button
          data-testid="theme-dark"
          @click="emit('toggle-theme', true)"
          :class="isDark ? 'bg-white dark:bg-slate-600 shadow-sm' : 'opacity-40'"
          class="rounded-full px-1.5 py-0.5 text-xs transition-all cursor-pointer"
        >🌙</button>
      </div>
    </div>
  </header>
</template>
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd dashboard && bun test src/components/AppHeader.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/AppHeader.vue dashboard/src/components/AppHeader.test.ts
git commit -m "feat: add AppHeader component with tests"
```

---

## Task 5: SummaryHeader component (TDD)

**Files:**
- Create: `dashboard/src/components/SummaryHeader.vue`
- Create: `dashboard/src/components/SummaryHeader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `dashboard/src/components/SummaryHeader.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import SummaryHeader from './SummaryHeader.vue'
import type { ProviderSummary } from '../types'

const summaries: ProviderSummary[] = [
  { provider: 'aws', totalCost: 154, currency: 'USD', accountCount: 2, errorCount: 0 },
  { provider: 'gcp', totalCost: 55, currency: 'USD', accountCount: 1, errorCount: 0 },
  { provider: 'azure', totalCost: null, currency: null, accountCount: 1, errorCount: 1 },
]

describe('SummaryHeader', () => {
  test('renders a card for each provider', () => {
    const wrapper = mount(SummaryHeader, { props: { summaries } })
    expect(wrapper.findAll('[data-testid="provider-card"]')).toHaveLength(3)
  })

  test('shows provider name uppercased', () => {
    const wrapper = mount(SummaryHeader, { props: { summaries } })
    expect(wrapper.text()).toContain('AWS')
    expect(wrapper.text()).toContain('GCP')
  })

  test('shows cost and currency for successful providers', () => {
    const wrapper = mount(SummaryHeader, { props: { summaries } })
    expect(wrapper.text()).toContain('154.00')
    expect(wrapper.text()).toContain('USD')
  })

  test('shows Unavailable when totalCost is null', () => {
    const wrapper = mount(SummaryHeader, { props: { summaries } })
    expect(wrapper.text()).toContain('Unavailable')
  })

  test('shows warning badge when provider has partial errors', () => {
    const partialSummaries: ProviderSummary[] = [
      { provider: 'aws', totalCost: 120, currency: 'USD', accountCount: 2, errorCount: 1 },
    ]
    const wrapper = mount(SummaryHeader, { props: { summaries: partialSummaries } })
    expect(wrapper.text()).toContain('failed')
  })

  test('shows total account count in section label', () => {
    const wrapper = mount(SummaryHeader, { props: { summaries } })
    expect(wrapper.text()).toContain('4 accounts')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd dashboard && bun test src/components/SummaryHeader.test.ts
```

Expected: `Cannot find module './SummaryHeader.vue'`

- [ ] **Step 3: Create `dashboard/src/components/SummaryHeader.vue`**

```vue
<script setup lang="ts">
import type { ProviderSummary } from '../types'
import { providerTextClass } from '../utils/providerColors'

const props = defineProps<{ summaries: ProviderSummary[] }>()

const totalAccounts = () => props.summaries.reduce((n, s) => n + s.accountCount, 0)
</script>

<template>
  <div class="px-4 sm:px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
    <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
      This month · {{ totalAccounts() }} {{ totalAccounts() === 1 ? 'account' : 'accounts' }}
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      <div
        v-for="s in summaries"
        :key="s.provider"
        data-testid="provider-card"
        class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
      >
        <div :class="['text-xs font-bold mb-1', providerTextClass(s.provider)]">
          {{ s.provider.toUpperCase() }}
        </div>
        <div v-if="s.totalCost !== null" class="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
          {{ s.currency }} {{ s.totalCost.toFixed(2) }}
        </div>
        <div v-else class="font-semibold text-slate-400 text-sm">Unavailable</div>
        <div class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {{ s.accountCount }} {{ s.accountCount === 1 ? 'account' : 'accounts' }}
          <span v-if="s.errorCount > 0 && s.totalCost !== null" class="text-amber-500"> · ⚠ {{ s.errorCount }} failed</span>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd dashboard && bun test src/components/SummaryHeader.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/SummaryHeader.vue dashboard/src/components/SummaryHeader.test.ts
git commit -m "feat: add SummaryHeader component with tests"
```

---

## Task 6: AccountList component (TDD)

**Files:**
- Create: `dashboard/src/components/AccountList.vue`
- Create: `dashboard/src/components/AccountList.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `dashboard/src/components/AccountList.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import AccountList from './AccountList.vue'
import type { BalanceItem } from '../types'

const items: BalanceItem[] = [
  { provider: 'aws', account: 'production', totalCost: 120, currency: 'USD', lastUpdated: '' },
  { provider: 'gcp', account: 'main', totalCost: 55, currency: 'USD', lastUpdated: '' },
  { provider: 'azure', account: 'main', error: 'credentials missing' },
]

describe('AccountList', () => {
  test('renders a row for each item', () => {
    const wrapper = mount(AccountList, { props: { items } })
    expect(wrapper.findAll('[data-testid="account-row"]')).toHaveLength(3)
  })

  test('shows provider and account name', () => {
    const wrapper = mount(AccountList, { props: { items } })
    expect(wrapper.text()).toContain('AWS')
    expect(wrapper.text()).toContain('production')
  })

  test('shows cost for successful accounts', () => {
    const wrapper = mount(AccountList, { props: { items } })
    expect(wrapper.text()).toContain('120.00')
    expect(wrapper.text()).toContain('USD')
  })

  test('shows Unavailable for error accounts', () => {
    const wrapper = mount(AccountList, { props: { items } })
    expect(wrapper.text()).toContain('Unavailable')
  })

  test('error row has reduced opacity class', () => {
    const wrapper = mount(AccountList, { props: { items } })
    const rows = wrapper.findAll('[data-testid="account-row"]')
    const errorRow = rows[2]
    expect(errorRow.classes().join(' ')).toContain('opacity-50')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd dashboard && bun test src/components/AccountList.test.ts
```

Expected: `Cannot find module './AccountList.vue'`

- [ ] **Step 3: Create `dashboard/src/components/AccountList.vue`**

```vue
<script setup lang="ts">
import type { BalanceItem } from '../types'
import { isCostResult } from '../types'
import { providerTextClass, providerDotClass } from '../utils/providerColors'

defineProps<{ items: BalanceItem[] }>()
</script>

<template>
  <div class="px-4 sm:px-5 py-4">
    <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
      All accounts · sorted by cost
    </div>
    <div class="flex flex-col gap-1.5">
      <div
        v-for="item in items"
        :key="`${item.provider}-${item.account}`"
        data-testid="account-row"
        :class="[
          'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 flex justify-between items-center',
          !isCostResult(item) && 'opacity-50'
        ]"
      >
        <div class="flex items-center gap-2">
          <div :class="['w-2 h-2 rounded-full flex-shrink-0', providerDotClass(item.provider)]" />
          <div>
            <div class="flex items-center gap-1.5">
              <span :class="['font-semibold text-xs', providerTextClass(item.provider)]">
                {{ item.provider.toUpperCase() }}
              </span>
              <span class="text-slate-600 dark:text-slate-300 text-sm">{{ item.account }}</span>
            </div>
            <div v-if="isCostResult(item)" class="sm:hidden text-xs text-slate-400 mt-0.5">
              {{ item.currency }}
            </div>
          </div>
        </div>
        <div v-if="isCostResult(item)" class="text-right">
          <div class="font-bold text-slate-800 dark:text-slate-100">{{ item.totalCost.toFixed(2) }}</div>
          <div class="hidden sm:block text-xs text-slate-400 dark:text-slate-500">{{ item.currency }}</div>
        </div>
        <div v-else class="font-semibold text-slate-400 text-sm">Unavailable</div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd dashboard && bun test src/components/AccountList.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/AccountList.vue dashboard/src/components/AccountList.test.ts
git commit -m "feat: add AccountList component with tests"
```

---

## Task 7: App.vue and main.ts — wire everything together

**Files:**
- Create: `dashboard/src/App.vue`
- Create: `dashboard/src/main.ts`

- [ ] **Step 1: Create `dashboard/src/App.vue`**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { BalanceItem, ProviderSummary } from './types'
import AppHeader from './components/AppHeader.vue'
import SummaryHeader from './components/SummaryHeader.vue'
import AccountList from './components/AccountList.vue'
import { computeProviderSummaries, sortItems } from './utils/computations'

const items = ref<BalanceItem[]>([])
const loading = ref(false)
const lastUpdated = ref<Date | null>(null)
const fetchError = ref<string | null>(null)

const stored = localStorage.getItem('theme')
const isDark = ref(
  stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
)

watch(
  isDark,
  (val) => {
    document.documentElement.classList.toggle('dark', val)
    localStorage.setItem('theme', val ? 'dark' : 'light')
  },
  { immediate: true }
)

async function fetchBalance() {
  loading.value = true
  fetchError.value = null
  try {
    const res = await fetch('/balance')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    items.value = (await res.json()) as BalanceItem[]
    lastUpdated.value = new Date()
  } catch (err) {
    fetchError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchBalance)

const providerSummaries = computed<ProviderSummary[]>(() =>
  computeProviderSummaries(items.value)
)

const sortedItems = computed<BalanceItem[]>(() => sortItems(items.value))
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
    <AppHeader
      :loading="loading"
      :last-updated="lastUpdated"
      :is-dark="isDark"
      @refresh="fetchBalance"
      @toggle-theme="(dark) => (isDark = dark)"
    />
    <main class="max-w-3xl mx-auto">
      <!-- Top-level fetch error -->
      <div
        v-if="fetchError"
        class="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex justify-between items-center"
      >
        <span>{{ fetchError }}</span>
        <button @click="fetchBalance" class="font-semibold hover:underline cursor-pointer">Retry</button>
      </div>

      <!-- Loading skeleton (first load only) -->
      <template v-if="loading && items.length === 0">
        <div class="px-4 sm:px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div v-for="i in 4" :key="i" class="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div class="px-4 sm:px-5 py-4">
          <div class="flex flex-col gap-1.5">
            <div v-for="i in 4" :key="i" class="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          </div>
        </div>
      </template>

      <!-- Data -->
      <template v-else>
        <SummaryHeader :summaries="providerSummaries" />
        <AccountList :items="sortedItems" />
      </template>
    </main>
  </div>
</template>
```

- [ ] **Step 2: Create `dashboard/src/main.ts`**

```ts
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 3: Run the full test suite**

```bash
cd dashboard && bun test
```

Expected: all tests across all files pass.

- [ ] **Step 4: Start the backend and the dashboard dev server**

In one terminal:
```bash
bun run src/index.ts
```

In another:
```bash
cd dashboard && bun run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 5: Verify in browser**

Check:
- [ ] Summary cards appear with one card per provider
- [ ] Account rows sorted highest cost first, error rows grayed at bottom
- [ ] Refresh button re-fetches data
- [ ] ☀️/🌙 toggle switches theme; preference survives page reload
- [ ] Layout looks correct on a narrow viewport (≤640px): cards in 2×2 grid, currency stacked below account name

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/App.vue dashboard/src/main.ts
git commit -m "feat: add App root component and entry point"
```

---

## Task 8: Type check and final cleanup

**Files:** no new files

- [ ] **Step 1: Run type check**

```bash
cd dashboard && bunx vue-tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 2: Run full test suite one final time**

```bash
cd dashboard && bun test
```

Expected: all tests pass.

- [ ] **Step 3: Add `.superpowers/` to `.gitignore` if not already there**

Open `/Users/windix/learn/cloud-bills/.gitignore` and ensure this line is present:
```
.superpowers/
```

- [ ] **Step 4: Final commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm files"
```
