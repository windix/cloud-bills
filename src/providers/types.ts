export interface CostResult {
  provider: string;
  account: string;
  totalCost: number;
  currency: string;
  lastUpdated: string; // ISO 8601
}

export type ProviderFn = () => Promise<CostResult>;

export interface ProviderConfig {
  default: string;
  accounts: Record<string, ProviderFn>;
}
