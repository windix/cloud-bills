<script setup lang="ts">
import type { BalanceItem } from '../types'
import { isCostResult } from '../types'
import { providerTextClass, providerDotClass } from '../utils/providerColors'

defineProps<{ items: BalanceItem[] }>()
</script>

<template>
  <div class="px-4 py-3">
    <div class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
      All accounts · sorted by cost
    </div>
    <div class="flex flex-col gap-1.5">
      <div
        v-for="item in items"
        :key="`${item.provider}-${item.account}`"
        data-testid="account-row"
        :class="[
          'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 flex justify-between items-center',
          !isCostResult(item) ? 'opacity-50' : '',
        ]"
      >
        <!-- Left: dot + provider + account -->
        <div class="flex items-center gap-2 min-w-0">
          <div
            :class="isCostResult(item) ? providerDotClass(item.provider) : 'bg-slate-300 dark:bg-slate-600'"
            class="w-2 h-2 rounded-full flex-shrink-0"
          ></div>
          <!-- Desktop: inline; Mobile: stacked -->
          <div class="hidden sm:flex items-center gap-1.5 min-w-0">
            <span
              :class="isCostResult(item) ? providerTextClass(item.provider) : 'text-slate-400 dark:text-slate-500'"
              class="text-xs font-bold"
            >{{ item.provider.toUpperCase() }}</span>
            <span class="text-slate-500 dark:text-slate-400 text-sm truncate">{{ item.account }}</span>
          </div>
          <div class="flex sm:hidden flex-col min-w-0">
            <span
              :class="isCostResult(item) ? providerTextClass(item.provider) : 'text-slate-400 dark:text-slate-500'"
              class="text-xs font-bold"
            >{{ item.provider.toUpperCase() }} · {{ item.account }}</span>
            <span v-if="isCostResult(item)" class="text-xs text-slate-400 dark:text-slate-500">{{ item.currency }}</span>
          </div>
        </div>

        <!-- Right: cost -->
        <div v-if="isCostResult(item)" class="text-right flex-shrink-0 ml-3">
          <div class="font-bold text-slate-800 dark:text-slate-100 text-sm">{{ item.totalCost.toFixed(2) }}</div>
          <div class="hidden sm:block text-xs text-slate-400 dark:text-slate-500">{{ item.currency }}</div>
          <div v-if="item.credits !== undefined" class="text-xs text-emerald-600 dark:text-emerald-400">
            {{ Math.abs(item.credits).toFixed(2) }} credits
          </div>
        </div>
        <div v-else class="font-semibold text-slate-400 dark:text-slate-500 text-xs flex-shrink-0 ml-3">
          Unavailable
        </div>
      </div>
    </div>
  </div>
</template>
