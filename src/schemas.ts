import { z } from "@hono/zod-openapi";

const CreditDetailSchema = z
  .object({
    type: z.string().openapi({ example: "PROMOTION" }),
    name: z.string().openapi({ example: "Free trial credit" }),
    amount: z.number().openapi({ example: -10.0, description: "Credit amount applied (negative value)" }),
  })
  .openapi("CreditDetail");

export const CostResultSchema = z
  .object({
    provider: z.string().openapi({ example: "aws" }),
    account: z.string().openapi({ example: "production" }),
    totalCost: z.number().openapi({ example: 123.45 }),
    currency: z.string().openapi({ example: "USD" }),
    lastUpdated: z
      .string()
      .openapi({ example: "2026-04-22T00:00:00Z", description: "ISO 8601 datetime" }),
    credits: z
      .number()
      .optional()
      .openapi({
        example: -15.0,
        description: "Total credits applied (negative value). Currently GCP only.",
      }),
    creditDetails: z
      .array(CreditDetailSchema)
      .optional()
      .openapi({
        description: "Per-type credit breakdown, ordered by amount. Currently GCP only.",
      }),
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
