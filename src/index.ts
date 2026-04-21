import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import ociProvider from "./providers/oci";
import type { ProviderFn, CostResult } from "./providers/types";

const providers: Record<string, ProviderFn> = {
  oci: ociProvider,
};

const app = new Hono();
app.use(trimTrailingSlash());

app.get("/balance/:provider", async (c) => {
  const name = c.req.param("provider");
  const provider = providers[name];

  if (!provider) {
    return c.json({ error: `Provider '${name}' not found` }, 404);
  }

  try {
    const result = await provider();
    return c.json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ provider: name, error: message }, 500);
  }
});

app.get("/balance", async (c) => {
  const entries = Object.entries(providers);
  const results = await Promise.allSettled(entries.map(([, fn]) => fn()));

  const response = results.map((result, i) => {
    const name = entries[i]?.[0] ?? "unknown";
    if (result.status === "fulfilled") {
      return result.value as CostResult;
    } else {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      return { provider: name, error: message };
    }
  });

  return c.json(response, 200);
});

export default {
  port: 3000,
  fetch: app.fetch,
};
