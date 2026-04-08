import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  insertTrace,
  queryTraces,
  getTrace,
  getReplayContext,
  diffTraces,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
} from "@foxhound/db";
import { requireEntitlement } from "../middleware/entitlements.js";
import { checkSpanLimit, incrementSpanCount } from "@foxhound/billing";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import type { Trace } from "@foxhound/types";

async function persistTraceWithRetry(
  fastify: FastifyInstance,
  trace: Trace,
  orgId: string,
  spanCount: number,
  maxAttempts = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await Promise.all([insertTrace(trace, orgId), incrementSpanCount(orgId, spanCount)]);
      void maybeFireAlerts(fastify, trace, orgId);
      return;
    } catch (err: unknown) {
      if (attempt === maxAttempts) {
        fastify.log.error(
          { err, traceId: trace.id, attempt },
          "Failed to persist trace after all retries",
        );
        return;
      }
      const delayMs = 100 * Math.pow(2, attempt - 1); // 100ms, 200ms
      fastify.log.warn(
        { err, traceId: trace.id, attempt, nextRetryMs: delayMs },
        "Trace persist failed, retrying",
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

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

    const matchingRules = rules.filter((r) => r.eventType === "agent_failure");

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

      void reply.code(202).send({ accepted: true, id: trace.id });

      setImmediate(() => {
        persistTraceWithRetry(fastify, trace as unknown as Trace, orgId, spanCount).catch(() => {
          // Errors are already logged inside persistTraceWithRetry
        });
      });
    },
  );

  /**
   * GET /v1/traces/:id
   * Fetch a single trace by ID — scoped to the authenticated org.
   */
  fastify.get("/v1/traces/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const trace = await getTrace(id, request.orgId);
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
