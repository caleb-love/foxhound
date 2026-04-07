import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { registerAuth } from "./plugins/auth.js";
import { tracesRoutes } from "./routes/traces.js";

const app = Fastify({
  logger: { level: process.env["LOG_LEVEL"] ?? "info" },
});

await app.register(cors);
await app.register(helmet);

// Global API key auth (all routes except /health)
registerAuth(app);

app.get("/health", async () => {
  return { status: "ok", version: "0.0.1" };
});

await app.register(tracesRoutes);

const port = Number(process.env["PORT"] ?? 3001);
const host = process.env["HOST"] ?? "0.0.0.0";

app.listen({ port, host }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
