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
