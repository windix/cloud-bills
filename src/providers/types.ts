export interface CostResult {
  provider: string;
  totalCost: number;
  currency: string;
  lastUpdated: string; // ISO 8601
}

export type ProviderFn = () => Promise<CostResult>;
