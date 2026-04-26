import { test, expect, mock } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";

// Mock must be declared before importing the module under test.
// Each provider() call fires two BigQuery queries (cost + credits breakdown) via Promise.all,
// so tests that invoke provider() must set up two mockImplementationOnce calls.
const mockQuery = mock(() => Promise.resolve([[]]));

mock.module("@google-cloud/bigquery", () => ({
  BigQuery: class {
    query = mockQuery;
  },
}));

const { createGcpProvider, loadGcpConfig } = await import("./gcp");

const KEY_JSON = JSON.stringify({ project_id: "my-project", type: "service_account" });

test("loadGcpConfig returns empty config when file does not exist", () => {
  const config = loadGcpConfig("/nonexistent/path/gcp.yaml");
  expect(config.default).toBe("");
  expect(config.accounts).toEqual({});
});

test("loadGcpConfig parses YAML into ProviderConfig", () => {
  const tmpPath = "/tmp/gcp-test.yaml";
  writeFileSync(
    tmpPath,
    `default: main\nmain:\n  key_json: '${KEY_JSON}'\n  dataset: billing_export\n  billing_account_id: "AAAAAA-BBBBBB-CCCCCC"\n`
  );
  const config = loadGcpConfig(tmpPath);
  unlinkSync(tmpPath);

  expect(config.default).toBe("main");
  expect(typeof config.accounts.main).toBe("function");
  expect(config.accounts["default"]).toBeUndefined();
});

test("createGcpProvider returns correct CostResult with credit breakdown", async () => {
  mockQuery.mockImplementationOnce(() =>
    Promise.resolve([[{ total_cost: 12.5, total_credits: -5.0, currency: "AUD" }]])
  );
  mockQuery.mockImplementationOnce(() =>
    Promise.resolve([
      [
        { type: "PROMOTION", name: "Free trial credit", amount: -3.0 },
        { type: "COMMITTED_USE_DISCOUNT", name: "Committed Use Discount: CPU", amount: -2.0 },
      ],
    ])
  );

  const provider = createGcpProvider("main", {
    key_json: KEY_JSON,
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.provider).toBe("gcp");
  expect(result.account).toBe("main");
  expect(result.totalCost).toBe(12.5);
  expect(result.credits).toBe(-5.0);
  expect(result.currency).toBe("AUD");
  expect(typeof result.lastUpdated).toBe("string");
  expect(result.creditDetails).toEqual([
    { type: "PROMOTION", name: "Free trial credit", amount: -3.0 },
    { type: "COMMITTED_USE_DISCOUNT", name: "Committed Use Discount: CPU", amount: -2.0 },
  ]);
});

test("createGcpProvider omits credits fields when rows are empty", async () => {
  mockQuery.mockImplementationOnce(() => Promise.resolve([[]])); // cost query: empty
  mockQuery.mockImplementationOnce(() => Promise.resolve([[]])); // credits query: empty

  const provider = createGcpProvider("main", {
    key_json: KEY_JSON,
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.totalCost).toBe(0);
  expect(result.currency).toBe("USD");
  expect(result.credits).toBeUndefined();
  expect(result.creditDetails).toBeUndefined();
});

test("createGcpProvider omits credits fields when no credits are applied", async () => {
  mockQuery.mockImplementationOnce(() =>
    Promise.resolve([[{ total_cost: 20.0, total_credits: null, currency: "USD" }]])
  );
  mockQuery.mockImplementationOnce(() => Promise.resolve([[]])); // no credit rows

  const provider = createGcpProvider("main", {
    key_json: KEY_JSON,
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  const result = await provider();
  expect(result.totalCost).toBe(20.0);
  expect(result.credits).toBeUndefined();
  expect(result.creditDetails).toBeUndefined();
});

test("createGcpProvider propagates BigQuery errors", async () => {
  mockQuery.mockImplementationOnce(() =>
    Promise.reject(new Error("BigQuery error"))
  );
  mockQuery.mockImplementationOnce(() => Promise.resolve([[]]));

  const provider = createGcpProvider("main", {
    key_json: KEY_JSON,
    dataset: "billing_export",
    billing_account_id: "AAAAAA-BBBBBB-CCCCCC",
  });
  await expect(provider()).rejects.toThrow("BigQuery error");
});
