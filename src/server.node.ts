import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app";

// Serve built dashboard — must come after all API routes
app.use("/*", serveStatic({ root: "./dashboard/dist" }));
// SPA fallback: any unmatched path returns index.html for client-side routing
app.use("/*", serveStatic({ root: "./dashboard/dist", rewriteRequestPath: () => "index.html" }));

serve({ fetch: app.fetch, port: parseInt(process.env.PORT ?? "3000") });
