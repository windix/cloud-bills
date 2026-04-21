import * as usageapi from "oci-usageapi";
import * as common from "oci-common";
import type { CostResult, ProviderFn } from "./types";

const ociProvider: ProviderFn = async function (): Promise<CostResult> {
  const tenancyId = process.env.OCI_TENANCY_ID;
  const userId = process.env.OCI_USER_ID;
  const fingerprint = process.env.OCI_FINGERPRINT;
  const privateKey = process.env.OCI_PRIVATE_KEY;
  const region = process.env.OCI_REGION;

  if (!tenancyId || !userId || !fingerprint || !privateKey || !region) {
    throw new Error("OCI credentials not configured");
  }

  const auth = new common.SimpleAuthenticationDetailsProvider(
    tenancyId,
    userId,
    fingerprint,
    privateKey,
    null,
    common.Region.fromRegionId(region)
  );

  const client = new usageapi.UsageapiClient({ authenticationDetailsProvider: auth });

  const now = new Date();
  const timeUsageStarted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const timeUsageEnded = now;

  const response = await client.requestSummarizedUsages({
    requestSummarizedUsagesDetails: {
      timeUsageStarted,
      timeUsageEnded,
      granularity: usageapi.models.RequestSummarizedUsagesDetails.Granularity.Monthly,
      tenantId: tenancyId,
    },
  });

  const items = response.usageAggregation?.items ?? [];

  const totalCost = items.reduce((sum, item) => sum + (item.computedAmount ?? 0), 0);
  const currency = items[0]?.currency ?? "USD";

  return {
    provider: "oci",
    totalCost: Math.round(totalCost * 100) / 100,
    currency,
    lastUpdated: new Date().toISOString(),
  };
};

export default ociProvider;
