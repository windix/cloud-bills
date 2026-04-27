import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { loadOciConfig } from "./providers/oci";
import { loadAwsConfig } from "./providers/aws";
import { loadAzureConfig } from "./providers/azure";
import { loadGcpConfig } from "./providers/gcp";
import type { ProviderConfig, CostResult } from "./providers/types";
import type { BalanceItem } from "./schemas";
import { balanceRoute, createProviderRoutes } from "./routes";
import { join } from "path";

const configDir = process.env.CONFIG_DIR ?? "config";

const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(join(configDir, "oci.yaml")),
  aws: loadAwsConfig(join(configDir, "aws.yaml")),
  azure: loadAzureConfig(join(configDir, "azure.yaml")),
  gcp: loadGcpConfig(join(configDir, "gcp.yaml")),
};

const VALID_PROVIDERS = Object.keys(providerConfigs);

export const app = new OpenAPIHono();

// spec + UI — registered first so /{provider} wildcard doesn't swallow these paths

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Cloud Bills API",
    version: "1.0.0",
    description: "Fetch cloud cost data across OCI, AWS, Azure, and GCP accounts.",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// /balance

app.openapi(balanceRoute, async (c) => {
  const ordered = Object.entries(providerConfigs).flatMap(([providerName, cfg]) =>
    Object.keys(cfg.accounts).map((accountName) => ({
      providerName,
      accountName,
      fn: cfg.accounts[accountName]!,
    }))
  );
  const results = await Promise.allSettled(ordered.map(({ fn }) => fn()));
  const response: BalanceItem[] = ordered.map(({ providerName, accountName }, i) => {
    const result = results[i]!;
    if (result.status === "fulfilled") return result.value as CostResult;
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return { provider: providerName, account: accountName, error: message };
  });

  return c.json(response, 200);
});

async function resolveAccount(
  providerName: string,
  accountParam: string | undefined
): Promise<{ ok: true; data: CostResult } | { ok: false; status: 404 | 500; error: string }> {
  const cfg = providerConfigs[providerName];
  if (!cfg) return { ok: false, status: 404, error: `Provider '${providerName}' not found` };

  const accountName = accountParam ?? cfg.default;
  const fn = cfg.accounts[accountName];
  if (!fn) return { ok: false, status: 404, error: `Account '${accountName}' not found` };

  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, error: message };
  }
}

// Register routes only for valid providers
for (const provider of VALID_PROVIDERS) {
  const { defaultRoute, accountRoute } = createProviderRoutes(provider);

  app.openapi(defaultRoute, async (c) => {
    const result = await resolveAccount(provider, undefined);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json(result.data, 200);
  });

  app.openapi(accountRoute, async (c) => {
    const { account } = c.req.valid("param");
    const result = await resolveAccount(provider, account);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json(result.data, 200);
  });
}
