import { test, expect, mock } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";

// Mock must be declared before importing the module under test.
const mockQuery = mock(() =>
  Promise.resolve([[{ total_cost: 12.5, currency: "AUD" }]])
);

mock.module("@google-cloud/bigquery", () => ({
  BigQuery: class {
    query = mockQuery;
  },
}));

const { createGcpProvider, loadGcpConfig } = await import("./gcp");

test("loadGcpConfig returns empty config when file does not exist", () => {
  const config = loadGcpConfig("/nonexistent/path/gcp.yaml");
  expect(config.default).toBe("");
  expect(config.accounts).toEqual({});
});

test("loadGcpConfig parses YAML into ProviderConfig", () => {
  const tmpPath = "/tmp/gcp-test.yaml";
  writeFileSync(
    tmpPath,
    `default: main\nmain:\n  key_file: ./keys/sa.json\n  project_id: my-project\n  dataset: billing_export\n  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"\n`
  );
  const config = loadGcpConfig(tmpPath);
  unlinkSync(tmpPath);

  expect(config.default).toBe("main");
  expect(typeof config.accounts.main).toBe("function");
  expect(config.accounts["default"]).toBeUndefined();
});

test("createGcpProvider returns correct CostResult from BigQuery rows", async () => {
  const provider = createGcpProvider("main", {
    key_file: "./keys/sa.json",
    project_id: "my-project",
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.provider).toBe("gcp");
  expect(result.account).toBe("main");
  expect(result.totalCost).toBe(12.5);
  expect(result.currency).toBe("AUD");
  expect(typeof result.lastUpdated).toBe("string");
});

test("createGcpProvider returns 0 cost and USD when rows are empty", async () => {
  mockQuery.mockImplementationOnce(() => Promise.resolve([[]]));
  const provider = createGcpProvider("main", {
    key_file: "./keys/sa.json",
    project_id: "my-project",
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.totalCost).toBe(0);
  expect(result.currency).toBe("USD");
});

test("createGcpProvider propagates BigQuery errors", async () => {
  mockQuery.mockImplementationOnce(() =>
    Promise.reject(new Error("BigQuery error"))
  );
  const provider = createGcpProvider("main", {
    key_file: "./keys/sa.json",
    project_id: "my-project",
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  await expect(provider()).rejects.toThrow("BigQuery error");
});
