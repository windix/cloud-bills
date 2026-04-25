import * as usageapi from "oci-usageapi";
import * as common from "oci-common";
import { startOfMonth, addDays, startOfDay, subYears, addYears } from "date-fns";
import { utc } from "@date-fns/utc";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, CreditEntry, ProviderFn, ProviderConfig } from "./types";

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

    // Cost query: current month to date
    const costStart = startOfMonth(now, { in: utc });
    const costEnd = startOfDay(addDays(now, 1, { in: utc }), { in: utc });

    // Credit query: wide window to capture all active credits
    const creditStart = subYears(now, 2);
    const creditEnd = addYears(now, 1);

    const [costResponse, creditResponse] = await Promise.all([
      client.requestSummarizedUsages({
        requestSummarizedUsagesDetails: {
          timeUsageStarted: costStart,
          timeUsageEnded: costEnd,
          granularity: usageapi.models.RequestSummarizedUsagesDetails.Granularity.Monthly,
          tenantId: config.tenancy_id,
        },
      }),
      client.requestSummarizedUsages({
        requestSummarizedUsagesDetails: {
          timeUsageStarted: creditStart,
          timeUsageEnded: creditEnd,
          granularity: usageapi.models.RequestSummarizedUsagesDetails.Granularity.Monthly,
          queryType: usageapi.models.RequestSummarizedUsagesDetails.QueryType.Credit,
          tenantId: config.tenancy_id,
        },
      }).catch(() => null),
    ]);

    const costItems = costResponse.usageAggregation?.items ?? [];
    const totalCost = costItems.reduce((sum, item) => sum + (item.computedAmount ?? 0), 0);
    const currency = costItems[0]?.currency ?? "USD";

    const creditItems = (creditResponse?.usageAggregation?.items ?? []).filter(
      (item) => (item.computedAmount ?? 0) !== 0 && item.timeUsageEnded != null
    );

    const credits: CreditEntry[] = creditItems.map((item) => ({
      amount: Math.round((item.computedAmount ?? 0) * 100) / 100,
      currency: item.currency ?? currency,
      expiresAt: item.timeUsageEnded!.toISOString(),
      ...(item.skuPartNumber && { type: item.skuPartNumber }),
      ...(item.skuName && { description: item.skuName }),
    }));

    const totalCredits =
      credits.length > 0
        ? Math.round(credits.reduce((sum, c) => sum + c.amount, 0) * 100) / 100
        : undefined;

    return {
      provider: "oci",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
      ...(credits.length > 0 && { totalCredits, credits }),
    };
  };
}

export function loadOciConfig(path = "config/oci.yaml"): ProviderConfig {
  let raw: OciYaml;
  try {
    raw = parse(readFileSync(path, "utf8")) as OciYaml;
  } catch (err: any) {
    if (err.code === "ENOENT") return { default: "", accounts: {} };
    throw err;
  }
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createOciProvider(key, val as OciAccountConfig);
  }

  return { default: raw.default, accounts };
}
