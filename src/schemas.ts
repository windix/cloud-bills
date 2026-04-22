import { z } from "@hono/zod-openapi";

export const CostResultSchema = z
  .object({
    provider: z.string().openapi({ example: "aws" }),
    account: z.string().openapi({ example: "production" }),
    totalCost: z.number().openapi({ example: 123.45 }),
    currency: z.string().openapi({ example: "USD" }),
    lastUpdated: z
      .string()
      .openapi({ example: "2026-04-22T00:00:00Z", description: "ISO 8601 datetime" }),
  })
  .openapi("CostResult");

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Provider 'xyz' not found" }),
  })
  .openapi("Error");

export const BalanceItemSchema = z
  .union([
    CostResultSchema,
    z
      .object({
        provider: z.string(),
        account: z.string(),
        error: z.string(),
      })
      .openapi("BalanceError"),
  ])
  .openapi("BalanceItem");

export type BalanceItem = z.infer<typeof BalanceItemSchema>;
