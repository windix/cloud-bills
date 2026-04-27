import { serveStatic } from "hono/bun";
import { app } from "./app";
export { app } from "./app";

// Serve built dashboard — must come after all API routes
app.use("/*", serveStatic({ root: "./dashboard/dist" }));
// SPA fallback: any unmatched path returns index.html for client-side routing
app.use("/*", serveStatic({ root: "./dashboard/dist", rewriteRequestPath: () => "index.html" }));

export default {
  port: parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
};
