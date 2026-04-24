<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { BalanceItem } from './types'
import { computeProviderSummaries, sortItems } from './utils/computations'
import AppHeader from './components/AppHeader.vue'
import SummaryHeader from './components/SummaryHeader.vue'
import AccountList from './components/AccountList.vue'

const items = ref<BalanceItem[]>([])
const loading = ref(false)
const lastUpdated = ref<Date | null>(null)
const fetchError = ref<string | null>(null)

const stored = localStorage.getItem('theme')
const isDark = ref(stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)

watch(
  isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  },
  { immediate: true },
)

async function fetchBalance() {
  loading.value = true
  fetchError.value = null
  try {
    const res = await fetch('/balance')
    if (!res.ok) throw new Error(`Server error: ${res.status}`)
    items.value = await res.json()
    lastUpdated.value = new Date()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(fetchBalance)

const providerSummaries = computed(() => computeProviderSummaries(items.value))
const sortedItems = computed(() => sortItems(items.value))
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="max-w-3xl mx-auto">
      <AppHeader
        :loading="loading"
        :last-updated="lastUpdated"
        :is-dark="isDark"
        @refresh="fetchBalance"
        @toggle-theme="(dark) => (isDark = dark)"
      />

      <!-- Top-level fetch error banner -->
      <div
        v-if="fetchError"
        class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 flex items-center justify-between"
      >
        <span class="text-sm text-red-600 dark:text-red-400">{{ fetchError }}</span>
        <button
          @click="fetchBalance"
          class="ml-3 text-xs bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-300 px-2 py-1 rounded cursor-pointer"
        >
          Retry
        </button>
      </div>

      <!-- Skeleton while loading first fetch -->
      <template v-if="loading && items.length === 0">
        <div class="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div class="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3"></div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div v-for="i in 4" :key="i" class="h-16 bg-slate-100 dark:bg-slate-900 rounded-lg animate-pulse"></div>
          </div>
        </div>
        <div class="px-4 py-3">
          <div class="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3"></div>
          <div class="flex flex-col gap-1.5">
            <div v-for="i in 5" :key="i" class="h-12 bg-slate-100 dark:bg-slate-900 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </template>

      <!-- Loaded -->
      <template v-else>
        <SummaryHeader :summaries="providerSummaries" />
        <AccountList :items="sortedItems" />
      </template>
    </div>
  </div>
</template>
