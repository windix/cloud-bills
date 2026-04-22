import { test, expect } from "bun:test";
import { loadOciConfig } from "./oci";

test("loadOciConfig returns empty config when file does not exist", () => {
  const config = loadOciConfig("/nonexistent/path/oci.yaml");
  expect(config.default).toBe("");
  expect(config.accounts).toEqual({});
});
