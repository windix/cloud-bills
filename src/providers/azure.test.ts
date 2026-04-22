import { test, expect, mock } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";

// Mocking Azure Identity and Cost Management
const mockQueryUsage = mock(() =>
  Promise.resolve({
    columns: [
      { name: "PreTaxCost", type: "Number" },
      { name: "Currency", type: "String" },
    ],
    rows: [[10.5, "USD"], [5.25, "USD"]],
  })
);

mock.module("@azure/identity", () => ({
  ClientSecretCredential: class {
    constructor() {}
  },
}));

mock.module("@azure/arm-costmanagement", () => ({
  CostManagementClient: class {
    constructor() {}
    query = {
      usage: mockQueryUsage,
    };
  },
}));

const { createAzureProvider, loadAzureConfig } = await import("./azure");

test("createAzureProvider sums costs across rows", async () => {
  const provider = createAzureProvider("prod", {
    tenant_id: "tenant",
    client_id: "client",
    client_secret: "secret",
    subscription_id: "sub",
  });
  const result = await provider();
  expect(result.provider).toBe("azure");
  expect(result.account).toBe("prod");
  expect(result.totalCost).toBe(15.75);
  expect(result.currency).toBe("USD");
  expect(typeof result.lastUpdated).toBe("string");
});

test("createAzureProvider returns 0 cost and USD when rows are empty", async () => {
  mockQueryUsage.mockImplementationOnce(() =>
    Promise.resolve({ rows: [] })
  );
  const provider = createAzureProvider("dev", {
    tenant_id: "tenant",
    client_id: "client",
    client_secret: "secret",
    subscription_id: "sub",
  });
  const result = await provider();
  expect(result.totalCost).toBe(0);
  expect(result.currency).toBe("USD");
});

test("loadAzureConfig returns empty config when file does not exist", () => {
  const config = loadAzureConfig("/nonexistent/path/azure.yaml");
  expect(config.default).toBe("");
  expect(config.accounts).toEqual({});
});

test("loadAzureConfig parses YAML into ProviderConfig", () => {
  const tmpPath = "/tmp/azure-test.yaml";
  writeFileSync(
    tmpPath,
    `default: main\nmain:\n  tenant_id: t1\n  client_id: c1\n  client_secret: s1\n  subscription_id: sub1\n`
  );
  const config = loadAzureConfig(tmpPath);
  unlinkSync(tmpPath);

  expect(config.default).toBe("main");
  expect(typeof config.accounts.main).toBe("function");
  expect(config.accounts["default"]).toBeUndefined();
});
