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
  return `${mins} min ago`
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
