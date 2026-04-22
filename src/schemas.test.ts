import { describe, test, expect } from "bun:test";
import { CostResultSchema, ErrorSchema, BalanceItemSchema } from "./schemas";

describe("CostResultSchema", () => {
  test("accepts a valid CostResult", () => {
    const result = CostResultSchema.safeParse({
      provider: "aws",
      account: "production",
      totalCost: 123.45,
      currency: "USD",
      lastUpdated: "2026-04-22T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing totalCost", () => {
    const result = CostResultSchema.safeParse({
      provider: "aws",
      account: "production",
      currency: "USD",
      lastUpdated: "2026-04-22T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("ErrorSchema", () => {
  test("accepts valid error object", () => {
    expect(ErrorSchema.safeParse({ error: "not found" }).success).toBe(true);
  });
});

describe("BalanceItemSchema", () => {
  test("accepts a CostResult (fulfilled provider)", () => {
    const result = BalanceItemSchema.safeParse({
      provider: "aws",
      account: "prod",
      totalCost: 50,
      currency: "USD",
      lastUpdated: "2026-04-22T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a provider error object (failed provider)", () => {
    const result = BalanceItemSchema.safeParse({
      provider: "oci",
      account: "tenancy",
      error: "auth failed",
    });
    expect(result.success).toBe(true);
  });
});
