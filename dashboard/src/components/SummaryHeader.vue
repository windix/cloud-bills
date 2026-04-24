<script setup lang="ts">
import type { ProviderSummary } from '../types'
import { providerTextClass } from '../utils/providerColors'

defineProps<{ summaries: ProviderSummary[] }>()

function formatCost(summary: ProviderSummary): string {
  if (summary.totalCost === null) return 'Unavailable'
  return `${summary.currency} ${summary.totalCost.toFixed(2)}`
}
</script>

<template>
  <div class="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
    <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
      This month · {{ summaries.reduce((s, p) => s + p.accountCount, 0) }} accounts
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div
        v-for="summary in summaries"
        :key="summary.provider"
        data-testid="provider-card"
        class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
      >
        <div :class="providerTextClass(summary.provider)" class="text-xs font-bold mb-0.5">
          {{ summary.provider.toUpperCase() }}
        </div>

        <div v-if="summary.totalCost !== null" class="font-bold text-slate-800 dark:text-slate-100 text-sm">
          {{ summary.currency }} {{ summary.totalCost.toFixed(2) }}
        </div>
        <div v-else class="font-semibold text-slate-400 dark:text-slate-500 text-xs">
          Unavailable
        </div>

        <span
          v-if="summary.errorCount > 0 && summary.totalCost !== null"
          data-testid="error-badge"
          class="inline-block text-xs text-amber-500 dark:text-amber-400 mt-0.5"
        >⚠ {{ summary.errorCount }} failed</span>

        <div class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {{ summary.accountCount }} acct{{ summary.accountCount !== 1 ? 's' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>
