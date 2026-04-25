import { z } from "@hono/zod-openapi";

export const CreditEntrySchema = z
  .object({
    amount: z.number().openapi({ example: 400.0 }),
    currency: z.string().openapi({ example: "AUD" }),
    expiresAt: z
      .string()
      .openapi({ example: "2026-05-22T00:00:00.000Z", description: "ISO 8601 datetime" }),
    type: z.string().optional().openapi({ example: "B88888", description: "SKU part number" }),
    description: z
      .string()
      .optional()
      .openapi({ example: "Oracle Cloud Free Trial", description: "SKU friendly name" }),
  })
  .openapi("CreditEntry");

export const CostResultSchema = z
  .object({
    provider: z.string().openapi({ example: "aws" }),
    account: z.string().openapi({ example: "production" }),
    totalCost: z.number().openapi({ example: 123.45 }),
    currency: z.string().openapi({ example: "USD" }),
    lastUpdated: z
      .string()
      .openapi({ example: "2026-04-22T00:00:00Z", description: "ISO 8601 datetime" }),
    totalCredits: z.number().optional().openapi({ example: 400.0 }),
    credits: z
      .array(CreditEntrySchema)
      .optional()
      .openapi({ description: "Individual credit entries; omitted when no credits are available" }),
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
