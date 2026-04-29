import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { CostResultSchema, ErrorSchema, BalanceItemSchema } from "./schemas";

export const sharedResponses = {
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
} as const;

export const balanceRoute = createRoute({
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

export function createProviderRoutes(provider: string) {
  const defaultRoute = createRoute({
    method: "get",
    path: `/${provider}`,
    summary: `Default account balance for ${provider}`,
    request: {
      params: z.object({}),
    },
    responses: sharedResponses,
  });

  const accountRoute = createRoute({
    method: "get",
    path: `/${provider}/{account}`,
    summary: `Specific account balance for ${provider}`,
    request: {
      params: z.object({
        account: z.string().openapi({ example: "production", description: "Account name" }),
      }),
    },
    responses: sharedResponses,
  });

  return { defaultRoute, accountRoute };
}
