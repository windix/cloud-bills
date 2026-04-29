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
      totalCredits: undefined,
    }
    entry.accountCount++
    if (isCostResult(item)) {
      entry.totalCost = (entry.totalCost ?? 0) + item.totalCost
      entry.currency = item.currency
      if (item.credits !== undefined) {
        entry.totalCredits = (entry.totalCredits ?? 0) + item.credits
      }
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
