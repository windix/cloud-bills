import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { z } from "@hono/zod-openapi";
import { loadOciConfig } from "./providers/oci";
import { loadAwsConfig } from "./providers/aws";
import { loadAzureConfig } from "./providers/azure";
import { loadGcpConfig } from "./providers/gcp";
import type { ProviderConfig, CostResult } from "./providers/types";
import { CostResultSchema, ErrorSchema, BalanceItemSchema, type BalanceItem } from "./schemas";

const VALID_PROVIDERS = ["aws", "gcp", "azure", "oci"] as const;

const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
  azure: loadAzureConfig(),
  gcp: loadGcpConfig(),
};

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

const balanceRoute = createRoute({
  method: "get",
  path: "/balance",
  summary: "All account balances",
  description:
    "Returns cost data for every configured account across all providers. " +
    "If a provider fetch fails its entry contains an `error` field instead of cost fields.",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(BalanceItemSchema) } },
      description: "Balance for every account (provider errors embedded inline)",
    },
  },
});

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

// shared resolver

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
  // /{provider}
  const providerRoute = createRoute({
    method: "get",
    path: `/${provider}`,
    summary: `Default account balance for ${provider}`,
    request: {
      params: z.object({}),
    },
    responses: {
      200: {
        content: { "application/json": { schema: CostResultSchema } },
        description: "Account balance",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Account not found",
      },
      500: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Provider fetch error",
      },
    },
  });

  app.openapi(providerRoute, async (c) => {
    const result = await resolveAccount(provider, undefined);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json(result.data, 200);
  });

  // /{provider}/{account}
  const providerAccountRoute = createRoute({
    method: "get",
    path: `/${provider}/{account}`,
    summary: `Specific account balance for ${provider}`,
    request: {
      params: z.object({
        account: z.string().openapi({ example: "production", description: "Account name" }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: CostResultSchema } },
        description: "Account balance",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Account not found",
      },
      500: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Provider fetch error",
      },
    },
  });

  app.openapi(providerAccountRoute, async (c) => {
    const { account } = c.req.valid("param");
    const result = await resolveAccount(provider, account);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json(result.data, 200);
  });
}
