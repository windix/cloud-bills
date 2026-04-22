import { test, expect } from "bun:test";
import { app } from "./index";

test("GET /openapi.json returns OpenAPI 3.1 spec with expected paths", async () => {
  const res = await app.request("/openapi.json");
  expect(res.status).toBe(200);
  const body = await res.json() as Record<string, unknown>;
  expect(body.openapi).toBe("3.1.0");
  const paths = body.paths as Record<string, unknown>;
  expect(paths["/balance"]).toBeDefined();
  expect(paths["/{provider}"]).toBeDefined();
  expect(paths["/{provider}/{account}"]).toBeDefined();
});

test("GET /docs returns HTML with Swagger UI", async () => {
  const res = await app.request("/docs");
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text.toLowerCase()).toContain("swagger");
});
