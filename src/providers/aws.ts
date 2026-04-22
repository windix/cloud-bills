import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { format, startOfMonth, addDays, startOfDay } from "date-fns";
import { utc } from "@date-fns/utc";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, ProviderFn, ProviderConfig } from "./types";

export interface AwsAccountConfig {
  access_key_id: string;
  secret_access_key: string;
}

interface AwsYaml {
  default: string;
  [account: string]: AwsAccountConfig | string;
}

export function createAwsProvider(name: string, config: AwsAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const client = new CostExplorerClient({
      region: "us-east-1",
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
    });

    const now = new Date();
    const start = format(startOfMonth(now, { in: utc }), "yyyy-MM-dd");
    const end = format(addDays(startOfDay(now, { in: utc }), 1), "yyyy-MM-dd");

    const response = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      })
    );

    const results = response.ResultsByTime ?? [];
    let totalCost = 0;
    let currency = "USD";

    for (const period of results) {
      const amount = period.Total?.UnblendedCost?.Amount;
      const unit = period.Total?.UnblendedCost?.Unit;
      if (amount) totalCost += parseFloat(amount);
      if (unit) currency = unit;
    }

    return {
      provider: "aws",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  };
}

export function loadAwsConfig(path = "aws.yaml"): ProviderConfig {
  const raw = parse(readFileSync(path, "utf8")) as AwsYaml;
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createAwsProvider(key, val as AwsAccountConfig);
  }

  return { default: raw.default, accounts };
}
