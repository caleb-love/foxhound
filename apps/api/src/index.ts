import Fastify, { type FastifyRequest } from "fastify";
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
import { datasetsRoutes } from "./routes/datasets.js";
import { experimentsRoutes } from "./routes/experiments.js";
import { budgetsRoutes } from "./routes/budgets.js";
import { slasRoutes } from "./routes/slas.js";
import { regressionsRoutes } from "./routes/regressions.js";
import { promptsRoutes } from "./routes/prompts.js";
import { startRetentionCleanup, stopRetentionCleanup } from "./jobs/retention-cleanup.js";
import { registerMetrics } from "./observability/register.js";
import { setTraceBufferMetrics } from "./trace-buffer.js";

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

// Register self-observability (prom-client /metrics + ingest histograms)
const ingestMetrics = await registerMetrics(app);
setTraceBufferMetrics(ingestMetrics);

// Register raw Buffer parser for Protobuf ingest (WP04). Must run before
// route registration so `request.body` is a Buffer for Protobuf requests.
//
// WP05: the parser itself leaves the body untouched (still a Buffer).
// `decodeProtoBatch` in `traces-proto.ts` applies the gzip decompress +
// 1 MiB ceiling using the shared `decompressIfNeeded` helper. Doing the
// decompression inside the decoder keeps tenant-scope checks and the
// gzip/413 guard in one place; the parser stays simple.
app.addContentTypeParser(
  ["application/x-protobuf", "application/vnd.google.protobuf"],
  { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 },
  (_req, body, done) => done(null, body),
);

// WP05: JSON ingest also honors `Content-Encoding: gzip`. Fastify's
// built-in JSON parser does not decompress, so we register our own
// content-type parser that reads the raw Buffer, decompresses when
// needed, enforces the 1 MiB decompressed ceiling, and JSON.parses the
// result. Non-ingest JSON endpoints keep the stdlib parser because
// they are small enough that gzip is a net loss; the route scoping via
// `ingestRouteUrls` in `registerMetrics` naturally aligns with that.
app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 },
  async (req: FastifyRequest, body: Buffer): Promise<unknown> => {
    const { decompressIfNeeded } = await import("./middleware/decompress.js");
    const ce = req.headers["content-encoding"];
    const result = decompressIfNeeded(
      body,
      typeof ce === "string" ? ce : undefined,
    );
    if (!result.ok) {
      const err = new Error(result.message) as Error & {
        statusCode?: number;
      };
      err.statusCode = result.status;
      throw err;
    }
    try {
      return JSON.parse(result.body.toString("utf8")) as unknown;
    } catch (parseErr) {
      const err = new Error(
        `invalid JSON: ${(parseErr as Error).message}`,
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
  },
);

app.get("/health", async () => {
  const packageJson = (await import("../package.json", { with: { type: "json" } })) as {
    default?: { version?: string };
    version?: string;
  };
  const version = packageJson.default?.version ?? packageJson.version ?? "0.1.0";
  return { status: "ok", version };
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
await app.register(datasetsRoutes);
await app.register(experimentsRoutes);
await app.register(budgetsRoutes);
await app.register(slasRoutes);
await app.register(regressionsRoutes);
await app.register(promptsRoutes);

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
