import { Hono } from "hono";
import type { Context } from "hono";
import { loadOciConfig } from "./providers/oci";
import { loadAwsConfig } from "./providers/aws";
import type { ProviderConfig, CostResult } from "./providers/types";

const providerConfigs: Record<string, ProviderConfig> = {
  oci: loadOciConfig(),
  aws: loadAwsConfig(),
};

const app = new Hono();

app.get("/balance", async (c: Context) => {
  const calls = Object.values(providerConfigs).flatMap((cfg) =>
    Object.values(cfg.accounts).map((fn) => fn())
  );
  const results = await Promise.allSettled(calls);

  let accountIdx = 0;
  const response = Object.entries(providerConfigs).flatMap(([providerName, cfg]) =>
    Object.keys(cfg.accounts).map((accountName) => {
      const result = results[accountIdx++];
      if (result!.status === "fulfilled") {
        return result!.value as CostResult;
      }
      const message =
        result!.reason instanceof Error ? result!.reason.message : String(result!.reason);
      return { provider: providerName, account: accountName, error: message };
    })
  );

  return c.json(response, 200);
});

app.get("/:provider/:account?", async (c: Context) => {
  const providerName = c.req.param("provider") ?? "";
  const cfg = providerConfigs[providerName];

  if (!cfg) {
    return c.json({ error: `Provider '${providerName}' not found` }, 404);
  }

  const accountName = c.req.param("account") ?? cfg.default;
  const fn = cfg.accounts[accountName];

  if (!fn) {
    return c.json({ error: `Account '${accountName}' not found` }, 404);
  }

  try {
    return c.json(await fn(), 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ provider: providerName, account: accountName, error: message }, 500);
  }
});

export default {
  port: 3000,
  fetch: app.fetch,
};
