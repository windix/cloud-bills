export interface CreditDetail {
  type: string;
  name: string;
  amount: number;
}

export interface CostResult {
  provider: string;
  account: string;
  totalCost: number;
  currency: string;
  lastUpdated: string; // ISO 8601
  credits?: number; // Total credits applied (negative value). Currently GCP only.
  creditDetails?: CreditDetail[]; // Per-type credit breakdown. Currently GCP only.
}

export type ProviderFn = () => Promise<CostResult>;

export interface ProviderConfig {
  default: string;
  accounts: Record<string, ProviderFn>;
}
