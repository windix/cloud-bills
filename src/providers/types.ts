export interface CreditEntry {
  amount: number;
  currency: string;
  expiresAt: string; // ISO 8601
  type?: string;
  description?: string;
}

export interface CostResult {
  provider: string;
  account: string;
  totalCost: number;
  currency: string;
  lastUpdated: string; // ISO 8601
  totalCredits?: number;
  credits?: CreditEntry[];
}

export type ProviderFn = () => Promise<CostResult>;

export interface ProviderConfig {
  default: string;
  accounts: Record<string, ProviderFn>;
}
