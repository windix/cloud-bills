import * as usageapi from "oci-usageapi";
import * as common from "oci-common";
import { startOfMonth, addDays, startOfDay } from "date-fns";
import { utc } from "@date-fns/utc";
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

  const privateKeyPem = privateKey.replace(/\\n/g, "\n");

  const auth = new common.SimpleAuthenticationDetailsProvider(
    tenancyId,
    userId,
    fingerprint,
    privateKeyPem,
    null,
    common.Region.fromRegionId(region)
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
      tenantId: tenancyId,
    },
  });

  const items = response.usageAggregation?.items ?? [];

  const totalCost = items.reduce((sum, item) => sum + (item.computedAmount ?? 0), 0);
  const firstItem = items.length > 0 ? items[0] : undefined;
  const currency = firstItem?.currency ?? "USD";

  return {
    provider: "oci",
    totalCost: Math.round(totalCost * 100) / 100,
    currency,
    lastUpdated: new Date().toISOString(),
  };
};

export default ociProvider;
