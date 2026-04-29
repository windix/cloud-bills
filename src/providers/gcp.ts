import { BigQuery } from "@google-cloud/bigquery";
import { parse } from "yaml";
import { readFileSync } from "fs";
import type { CostResult, CreditDetail, ProviderFn, ProviderConfig } from "./types";

export interface GcpAccountConfig {
  key_json: string;
  dataset: string;
  billing_account_id: string;
}

interface GcpYaml {
  default: string;
  [account: string]: GcpAccountConfig | string;
}

export function createGcpProvider(name: string, config: GcpAccountConfig): ProviderFn {
  return async (): Promise<CostResult> => {
    const credentials = JSON.parse(config.key_json);
    const projectId: string = credentials.project_id;
    const client = new BigQuery({ projectId, credentials });

    const tableSuffix = config.billing_account_id.replace(/-/g, "_");
    const tableRef = `${projectId}.${config.dataset}.gcp_billing_export_v1_${tableSuffix}`;

    const costQuery = `
      SELECT
        SUM(cost) AS total_cost,
        SUM((SELECT SUM(c.amount) FROM UNNEST(credits) AS c)) AS total_credits,
        currency
      FROM \`${tableRef}\`
      WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
      GROUP BY currency
    `;

    const creditsQuery = `
      SELECT
        credit.type AS type,
        COALESCE(credit.full_name, credit.name) AS name,
        SUM(credit.amount) AS amount
      FROM \`${tableRef}\`,
      UNNEST(credits) AS credit
      WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
      GROUP BY type, COALESCE(credit.full_name, credit.name)
      ORDER BY amount ASC
    `;

    const [[costRows], [creditRows]] = await Promise.all([
      client.query(costQuery),
      client.query(creditsQuery),
    ]);

    let totalCost = 0;
    let totalCredits = 0;
    let currency = "USD";

    if (costRows.length > 0) {
      totalCost = costRows[0].total_cost ?? 0;
      totalCredits = costRows[0].total_credits ?? 0;
      currency = costRows[0].currency;
    }

    const creditDetails: CreditDetail[] = creditRows.map((row: any) => ({
      type: row.type,
      name: row.name,
      amount: Math.round(row.amount * 100) / 100,
    }));

    const hasCredits = creditDetails.length > 0;

    return {
      provider: "gcp",
      account: name,
      totalCost: Math.round(totalCost * 100) / 100,
      ...(hasCredits && {
        credits: Math.round(totalCredits * 100) / 100,
        creditDetails,
      }),
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
