import { BigQuery } from "@google-cloud/bigquery";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, ProviderFn, ProviderConfig } from "./types";

export interface GcpAccountConfig {
  key_file: string;
  project_id: string;
  dataset: string;
  billing_account_id: string;
}

interface GcpYaml {
  default: string;
  [account: string]: GcpAccountConfig | string;
}

export function createGcpProvider(name: string, config: GcpAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const client = new BigQuery({
      projectId: config.project_id,
      keyFilename: config.key_file,
    });

    const tableSuffix = config.billing_account_id.replace(/-/g, "_");
    const tableRef = `${config.project_id}.${config.dataset}.gcp_billing_export_v1_${tableSuffix}`;

    const query = `
      SELECT SUM(cost) AS total_cost, currency
      FROM \`${tableRef}\`
      WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
      GROUP BY currency
    `;

    const [rows] = await client.query(query);

    let totalCost = 0;
    let currency = "USD";

    if (rows.length > 0) {
      totalCost = rows[0].total_cost;
      currency = rows[0].currency;
    }

    return {
      provider: "gcp",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  };
}

export function loadGcpConfig(path = "config/gcp.yaml"): ProviderConfig {
  let raw: GcpYaml;
  try {
    raw = parse(readFileSync(path, "utf8")) as GcpYaml;
  } catch (err: any) {
    if (err.code === "ENOENT") return { default: "", accounts: {} };
    throw err;
  }
  const accounts: Record<string, ProviderFn> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "default") continue;
    accounts[key] = createGcpProvider(key, val as GcpAccountConfig);
  }

  return { default: raw.default, accounts };
}
