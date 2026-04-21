import * as usageapi from "oci-usageapi";
import * as common from "oci-common";
import { startOfMonth, addDays, startOfDay } from "date-fns";
import { utc } from "@date-fns/utc";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, ProviderFn, ProviderConfig } from "./types";

export interface OciAccountConfig {
  tenancy_id: string;
  user_id: string;
  fingerprint: string;
  private_key: string;
  region: string;
}

interface OciYaml {
  default: string;
  [account: string]: OciAccountConfig | string;
}

export function createOciProvider(name: string, config: OciAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const auth = new common.SimpleAuthenticationDetailsProvider(
      config.tenancy_id,
      config.user_id,
      config.fingerprint,
      config.private_key,
      null,
      common.Region.fromRegionId(config.region)
    );

    const client = new usageapi.UsageapiClient({ authenticationDetailsProvider: auth });

    const now = new Date();
    const timeUsageStarted = startOfMonth(now, { in: utc });
    const timeUsageEnded = startOfDay(addDays(now, 1, { in: utc }), { in: utc });

    const response = await client.requestSummarizedUsages({
      requestSummarizedUsagesDetails: {
        timeUsageStarted,
        timeUsageEnded,
        granularity: usageapi.models.RequestSummarizedUsagesDetails.Granularity.Monthly,
        tenantId: config.tenancy_id,
      },
    });

    const items = response.usageAggregation?.items ?? [];
    const totalCost = items.reduce((sum, item) => sum + (item.computedAmount ?? 0), 0);
    const currency = items[0]?.currency ?? "USD";

    return {
      provider: "oci",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  };
}

export function loadOciConfig(path = "oci.yaml"): ProviderConfig {
  const raw = parse(readFileSync(path, "utf8")) as OciYaml;
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createOciProvider(key, val as OciAccountConfig);
  }

  return { default: raw.default, accounts };
}
