import { test, expect, mock } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";

// Mock must be declared before importing the module under test.
const mockSend = mock(() =>
  Promise.resolve({
    ResultsByTime: [
      {
        Total: {
          UnblendedCost: { Amount: "12.50", Unit: "USD" },
        },
      },
      {
        Total: {
          UnblendedCost: { Amount: "7.30", Unit: "USD" },
        },
      },
    ],
  })
);

mock.module("@aws-sdk/client-cost-explorer", () => ({
  CostExplorerClient: class {
    send = mockSend;
  },
  GetCostAndUsageCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { createAwsProvider, loadAwsConfig } = await import("./aws");

test("createAwsProvider sums costs across ResultsByTime periods", async () => {
  const provider = createAwsProvider("prod", {
    access_key_id: "AKIATEST",
    secret_access_key: "secret",
  });
  const result = await provider();
  expect(result.provider).toBe("aws");
  expect(result.account).toBe("prod");
  expect(result.totalCost).toBe(19.80);
  expect(result.currency).toBe("USD");
  expect(typeof result.lastUpdated).toBe("string");
});

test("createAwsProvider returns 0 cost and USD when ResultsByTime is empty", async () => {
  mockSend.mockImplementationOnce(() =>
    Promise.resolve({ ResultsByTime: [] })
  );
  const provider = createAwsProvider("dev", {
    access_key_id: "AKIATEST",
    secret_access_key: "secret",
  });
  const result = await provider();
  expect(result.totalCost).toBe(0);
  expect(result.currency).toBe("USD");
});

test("loadAwsConfig parses YAML into ProviderConfig", () => {
  const tmpPath = "/tmp/aws-test.yaml";
  writeFileSync(
    tmpPath,
    `default: prod\nprod:\n  access_key_id: AKIA1\n  secret_access_key: s1\ndev:\n  access_key_id: AKIA2\n  secret_access_key: s2\n`
  );
  const config = loadAwsConfig(tmpPath);
  unlinkSync(tmpPath);

  expect(config.default).toBe("prod");
  expect(typeof config.accounts.prod).toBe("function");
  expect(typeof config.accounts.dev).toBe("function");
  expect(config.accounts["default"]).toBeUndefined();
});
