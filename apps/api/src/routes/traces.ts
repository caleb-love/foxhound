import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  queryTraces,
  getTraceWithSpans,
  getReplayContext,
  diffTraces,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
} from "@foxhound/db";
import { requireEntitlement } from "../middleware/entitlements.js";
import { checkSpanLimit } from "@foxhound/billing";
import { persistTraceWithRetry } from "../persistence.js";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import type { Trace } from "@foxhound/types";
import { getBudgetPeriodKey } from "@foxhound/types";
import { updateSpanCosts } from "@foxhound/db";
import { lookupPricing } from "../lib/pricing-cache.js";
import { getRedis } from "../lib/redis.js";
import { getConfigFromCache } from "../lib/config-cache.js";
import { getCostMonitorQueue, getRegressionDetectorQueue } from "../queue.js";

/**
 * Checks whether the trace contains any error spans and, if so, dispatches
 * an agent_failure alert to all matching notification channels for the org.
 * Errors are logged but never thrown — alert delivery must not affect ingestion.
 */
async function maybeFireAlerts(
  fastify: FastifyInstance,
  trace: Trace,
  orgId: string,
): Promise<void> {
  const hasError = trace.spans.some((s) => s.status === "error");
  if (!hasError) return;

  try {
    const [rules, channelRows] = await Promise.all([
      getAlertRulesForOrg(orgId),
      listNotificationChannels(orgId),
    ]);

    if (rules.length === 0) return;

    const channelMap = new Map<string, NotificationChannel>(
      channelRows.map((row) => [
        row.id,
        {
          id: row.id,
          orgId: row.orgId,
          kind: row.kind as "slack",
          name: row.name,
          config: row.config as unknown as NotificationChannel["config"],
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      ]),
    );

    const event: AlertEvent = {
      type: "agent_failure",
      severity: "high",
      orgId,
      agentId: trace.agentId,
      traceId: trace.id,
      sessionId: trace.sessionId,
      message: `Agent "${trace.agentId}" produced one or more error spans in trace ${trace.id}.`,
      metadata: { spanCount: trace.spans.length },
      occurredAt: new Date(),
    };

    const matchingRules = rules.filter((r) => r.eventType === "agent_failure") as unknown as import("@foxhound/notifications").AlertRule[];

    await dispatchAlert(event, matchingRules, channelMap, fastify.log);

    // Log delivery for each matched rule
    await Promise.allSettled(
      matchingRules
        .filter((r) => channelMap.has(r.channelId))
        .map((rule) =>
          createNotificationLogEntry({
            id: randomUUID(),
            orgId,
            ruleId: rule.id,
            channelId: rule.channelId,
            eventType: "agent_failure",
            severity: "high",
            agentId: trace.agentId,
            traceId: trace.id,
            status: "sent",
          }),
        ),
    );
  } catch (err) {
    fastify.log.error({ err, traceId: trace.id }, "Alert dispatch failed");
  }
}

const SpanEventSchema = z.object({
  timeMs: z.number(),
  name: z.string(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const SpanSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  name: z.string(),
  kind: z.enum(["tool_call", "llm_call", "agent_step", "workflow", "custom"]),
  startTimeMs: z.number(),
  endTimeMs: z.number().optional(),
  status: z.enum(["ok", "error", "unset"]),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  events: z.array(SpanEventSchema),
});

const IngestTraceSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  sessionId: z.string().optional(),
  parentAgentId: z.string().optional(),
  correlationId: z.string().optional(),
  spans: z.array(SpanSchema),
  startTimeMs: z.number(),
  endTimeMs: z.number().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const DiffQuerySchema = z.object({
  runA: z.string().min(1),
  runB: z.string().min(1),
});

const QueryTracesSchema = z.object({
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

async function handlePhase4Ingestion(
  fastify: FastifyInstance,
  trace: z.infer<typeof IngestTraceSchema>,
  orgId: string,
): Promise<void> {
  try {
    const redis = getRedis();
    const config = await getConfigFromCache(orgId, trace.agentId);

    // 1. Cost extraction for LLM spans
    let traceCost = 0;
    const spanCosts: Array<{ traceId: string; spanId: string; costUsd: number }> = [];
    for (const span of trace.spans) {
      if (span.kind !== "llm_call") continue;

      let cost: number | null = null;
      const attrs = span.attributes;

      // Prefer SDK-reported cost
      if (typeof attrs["cost_usd"] === "number") {
        cost = attrs["cost_usd"];
      } else if (typeof attrs["model"] === "string") {
        const model = attrs["model"];
        const inputTokens =
          typeof attrs["token_count_input"] === "number" ? attrs["token_count_input"] : 0;
        const outputTokens =
          typeof attrs["token_count_output"] === "number" ? attrs["token_count_output"] : 0;
        if (inputTokens > 0 || outputTokens > 0) {
          const pricing = await lookupPricing(orgId, model);
          if (pricing) {
            cost =
              inputTokens * pricing.inputCostPerToken + outputTokens * pricing.outputCostPerToken;
          }
        }
      }

      if (cost !== null) {
        traceCost += cost;
        spanCosts.push({ traceId: trace.id, spanId: span.spanId, costUsd: cost });
      }
    }

    // Persist computed costs to spans.cost_usd
    if (spanCosts.length > 0) {
      await updateSpanCosts(spanCosts);
    }

    // 2. Update Redis running cost total
    if (redis && traceCost > 0 && config?.costBudgetUsd) {
      const periodKey = getBudgetPeriodKey(config.budgetPeriod ?? "monthly", trace.startTimeMs);
      const redisKey = `cost:${orgId}:${trace.agentId}:${periodKey}`;
      const newTotal = parseFloat(await redis.incrbyfloat(redisKey, traceCost));
      // Set TTL to 35 days (covers monthly periods)
      await redis.expire(redisKey, 35 * 24 * 3600);

      // Check if threshold crossed
      const budget = config.costBudgetUsd;
      const threshold = (config.costAlertThresholdPct ?? 80) / 100;
      if (newTotal >= budget) {
        const queue = getCostMonitorQueue();
        await queue?.add(
          "cost-alert",
          { orgId, agentId: trace.agentId, periodKey, level: "critical" },
          {
            jobId: `cost-alert:${orgId}:${trace.agentId}:${periodKey}:critical`,
          },
        );
      } else if (newTotal >= budget * threshold) {
        const queue = getCostMonitorQueue();
        await queue?.add(
          "cost-alert",
          { orgId, agentId: trace.agentId, periodKey, level: "high" },
          {
            jobId: `cost-alert:${orgId}:${trace.agentId}:${periodKey}:high`,
          },
        );
      }
    }

    // 3. Update Redis SLA counters
    if (redis && (config?.maxDurationMs || config?.minSuccessRate)) {
      const minuteBucket = Math.floor(trace.startTimeMs / 60000);
      const tracesKey = `sla:traces:${orgId}:${trace.agentId}:${minuteBucket}`;
      await redis.incr(tracesKey);
      await redis.expire(tracesKey, 90000); // 25 hours

      const hasError = trace.spans.some((s) => s.status === "error");
      if (hasError) {
        const errorsKey = `sla:errors:${orgId}:${trace.agentId}:${minuteBucket}`;
        await redis.incr(errorsKey);
        await redis.expire(errorsKey, 90000);
      }

      if (trace.endTimeMs) {
        const duration = trace.endTimeMs - trace.startTimeMs;
        const durKey = `sla:duration:${orgId}:${trace.agentId}:${minuteBucket}`;
        await redis.zadd(durKey, duration, trace.id);
        await redis.expire(durKey, 90000);
      }
    }

    // 4. Enqueue regression detection if agent_version is set
    const agentVersion = trace.metadata?.["agent_version"];
    if (typeof agentVersion === "string") {
      const queue = getRegressionDetectorQueue();
      await queue?.add(
        "regression-check",
        { orgId, agentId: trace.agentId, agentVersion },
        { jobId: `regression:${orgId}:${trace.agentId}:${agentVersion}` },
      );
    }
  } catch (err) {
    fastify.log.error({ err }, "Phase 4 ingestion processing failed");
  }
}

export function tracesRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/traces
   * Accept a trace payload from the SDK and persist it asynchronously.
   * Returns 202 immediately to avoid blocking the caller's hot path.
   * Scoped to the authenticated org (from API key middleware).
   */
  fastify.post(
    "/v1/traces",
    { config: { rateLimit: { max: 1000, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = IngestTraceSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const trace = result.data;
      const orgId = request.orgId;

      const spanCount = trace.spans.length;
      const limitCheck = await checkSpanLimit(orgId, spanCount);

      if (!limitCheck.allowed) {
        return reply.code(429).send({
          error: "span_limit_exceeded",
          message: `Monthly span limit of ${limitCheck.spansLimit.toLocaleString()} reached. Upgrade to Pro for higher limits.`,
          spansUsed: limitCheck.spansUsed,
          spansLimit: limitCheck.spansLimit,
        });
      }

      // Server-side sampling: drop non-error traces probabilistically.
      // Always keep error traces — losing errors defeats observability.
      const hasError = trace.spans.some((s) => s.status === "error");
      if (!hasError) {
        const samplingRate = request.samplingRate;
        if (samplingRate < 1.0 && Math.random() >= samplingRate) {
          return reply.code(202).send({ accepted: true, id: trace.id, sampled: false });
        }
      }

      void reply.code(202).send({ accepted: true, id: trace.id });

      setImmediate(() => {
        persistTraceWithRetry(fastify.log, trace as unknown as Trace, orgId).catch(() => {});
        void maybeFireAlerts(fastify, trace as unknown as Trace, orgId);
        void handlePhase4Ingestion(fastify, trace, orgId);
      });
    },
  );

  /**
   * GET /v1/traces/:id
   * Fetch a single trace by ID — scoped to the authenticated org.
   */
  fastify.get("/v1/traces/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const trace = await getTraceWithSpans(id, request.orgId);
    if (!trace) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(200).send(trace);
  });

  /**
   * GET /v1/traces/:traceId/spans/:spanId/replay
   * Reconstruct the full agent context at the moment a specific span began.
   * Scoped to the authenticated org. Requires canReplay entitlement.
   */
  fastify.get(
    "/v1/traces/:traceId/spans/:spanId/replay",
    { preHandler: [requireEntitlement("canReplay")] },
    async (request, reply) => {
      const { traceId, spanId } = request.params as { traceId: string; spanId: string };
      const context = await getReplayContext(traceId, spanId, request.orgId);
      if (!context) {
        return reply.code(404).send({ error: "Not Found" });
      }
      return reply.code(200).send(context);
    },
  );

  /**
   * GET /v1/runs/diff
   * Side-by-side diff of two agent runs — scoped to the authenticated org.
   * Requires canRunDiff entitlement.
   */
  fastify.get(
    "/v1/runs/diff",
    { preHandler: [requireEntitlement("canRunDiff")] },
    async (request, reply) => {
      const result = DiffQuerySchema.safeParse(request.query);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { runA, runB } = result.data;
      const diff = await diffTraces(runA, runB, request.orgId);
      if (!diff) {
        return reply.code(404).send({ error: "One or both runs not found" });
      }

      return reply.code(200).send(diff);
    },
  );

  /**
   * GET /v1/traces
   * Query persisted traces with optional filters — scoped to the authenticated org.
   */
  fastify.get("/v1/traces", async (request, reply) => {
    const result = QueryTracesSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { agentId, sessionId, from, to, page, limit } = result.data;

    const rows = await queryTraces({
      orgId: request.orgId,
      agentId,
      sessionId,
      from,
      to,
      page,
      limit,
    });

    return reply.code(200).send({
      data: rows,
      pagination: { page, limit, count: rows.length },
    });
  });
}
