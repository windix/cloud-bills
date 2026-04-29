import { app } from "./app";
export { app } from "./app";

export default {
  port: parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
};
