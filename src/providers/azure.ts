import { CostManagementClient } from "@azure/arm-costmanagement";
import { ClientSecretCredential } from "@azure/identity";
import { startOfMonth, addDays, startOfDay } from "date-fns";
import { utc } from "@date-fns/utc";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, ProviderFn, ProviderConfig } from "./types";

export interface AzureAccountConfig {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  subscription_id: string;
}

interface AzureYaml {
  default: string;
  [account: string]: AzureAccountConfig | string;
}

export function createAzureProvider(name: string, config: AzureAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const credential = new ClientSecretCredential(
      config.tenant_id,
      config.client_id,
      config.client_secret
    );
    const client = new CostManagementClient(credential);

    const now = new Date();
    const start = startOfMonth(now, { in: utc });
    const end = startOfDay(addDays(now, 1, { in: utc }), { in: utc });

    const scope = `subscriptions/${config.subscription_id}`;

    const response = await client.query.usage(scope, {
      type: "Usage",
      timeframe: "Custom",
      timePeriod: {
        from: start,
        to: end,
      },
      dataset: {
        granularity: "Monthly",
        aggregation: {
          totalCost: {
            name: "PreTaxCost",
            function: "Sum",
          },
        },
      },
    });

    const rows = response.rows ?? [];
    let totalCost = 0;
    let currency = "USD";

    // Azure Query API returns rows as an array of arrays.
    // The columns are defined in response.columns.
    // In our query, it should be [PreTaxCost, Currency] if we didn't specify grouping.
    // Actually, it usually returns [PreTaxCost, Currency] in that order if we don't group.
    
    if (rows.length > 0) {
      const costIndex = response.columns?.findIndex((c) => c.name === "PreTaxCost") ?? 0;
      const currencyIndex = response.columns?.findIndex((c) => c.name === "Currency") ?? 1;
      
      totalCost = rows.reduce((sum, row) => sum + (row[costIndex] as number), 0);
      currency = rows[0][currencyIndex] as string;
    }

    return {
      provider: "azure",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  };
}

export function loadAzureConfig(path = "config/azure.yaml"): ProviderConfig {
  let raw: AzureYaml;
  try {
    raw = parse(readFileSync(path, "utf8")) as AzureYaml;
  } catch (err: any) {
    if (err.code === "ENOENT") return { default: "", accounts: {} };
    throw err;
  }
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createAzureProvider(key, val as AzureAccountConfig);
  }

  return { default: raw.default, accounts };
}
