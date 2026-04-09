import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { registerAuth } from "./plugins/auth.js";
import { tracesRoutes } from "./routes/traces.js";
import { authRoutes } from "./routes/auth.js";
import { apiKeysRoutes } from "./routes/apiKeys.js";
import { billingRoutes } from "./routes/billing.js";
import { billingWebhookRoutes } from "./routes/billing-webhook.js";
import { otlpRoutes } from "./routes/otlp.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { ssoRoutes } from "./routes/sso.js";
import { waitlistRoutes } from "./routes/waitlist.js";
import { scoresRoutes } from "./routes/scores.js";
import { evaluatorsRoutes } from "./routes/evaluators.js";
import { annotationsRoutes } from "./routes/annotations.js";
import { startRetentionCleanup, stopRetentionCleanup } from "./jobs/retention-cleanup.js";

const app = Fastify({
  logger: { level: process.env["LOG_LEVEL"] ?? "info" },
});

await app.register(cors, {
  origin: process.env["FRONTEND_URL"]
    ? process.env["FRONTEND_URL"].split(",")
    : ["http://localhost:3000"],
  credentials: true,
});
await app.register(helmet);

// Global rate limiting — per-route overrides applied below via config.rateLimit
await app.register(rateLimit, {
  global: true,
  max: 60,
  timeWindow: "1 minute",
  addHeaders: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
    "retry-after": true,
  },
});

// Register auth plugin (JWT + API key middleware)
registerAuth(app);

app.get("/health", () => {
  return { status: "ok", version: "0.0.1" };
});

await app.register(authRoutes);
await app.register(apiKeysRoutes);
await app.register(tracesRoutes);
await app.register(otlpRoutes);
await app.register(billingRoutes);
await app.register(billingWebhookRoutes);
await app.register(notificationsRoutes);
await app.register(ssoRoutes);
await app.register(waitlistRoutes);
await app.register(scoresRoutes);
await app.register(evaluatorsRoutes);
await app.register(annotationsRoutes);

// Start retention cleanup cron
startRetentionCleanup(app.log);

app.addHook("onClose", () => {
  stopRetentionCleanup();
});

const port = Number(process.env["PORT"] ?? 3001);
const host = process.env["HOST"] ?? "0.0.0.0";

app.listen({ port, host }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
