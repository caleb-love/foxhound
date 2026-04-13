import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createNotificationChannel,
  listNotificationChannels,
  createAlertRule,
  listAlertRules,
  getAlertRulesForOrg,
  getNotificationChannel,
  createNotificationLogEntry,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, AlertRule, NotificationChannel } from "@foxhound/notifications";

// ──────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ──────────────────────────────────────────────────────────────────────────────

const CreateChannelSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.literal("slack"),
  config: z.object({
    webhookUrl: z.string().url(),
    channel: z.string().optional(),
    dashboardBaseUrl: z.string().url().optional(),
  }),
});

const CreateAlertRuleSchema = z.object({
  eventType: z.enum(["agent_failure", "anomaly_detected", "cost_spike", "compliance_violation"]),
  minSeverity: z.enum(["critical", "high", "medium", "low"]).default("high"),
  channelId: z.string().min(1),
});

const SendTestSchema = z.object({
  channelId: z.string().min(1),
  eventType: z
    .enum(["agent_failure", "anomaly_detected", "cost_spike", "compliance_violation"])
    .default("agent_failure"),
  severity: z.enum(["critical", "high", "medium", "low"]).default("high"),
});

// ──────────────────────────────────────────────────────────────────────────────
// Route plugin
// ──────────────────────────────────────────────────────────────────────────────

export function notificationsRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/notifications/channels
   * Create a new notification channel (e.g. Slack incoming webhook).
   */
  fastify.post("/v1/notifications/channels", async (request, reply) => {
    const result = CreateChannelSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { name, kind, config } = result.data;
    const channel = await createNotificationChannel({
      id: randomUUID(),
      orgId: request.orgId,
      kind,
      name,
      config: config as Record<string, unknown>,
    });

    return reply.code(201).send(sanitizeChannel(channel));
  });

  /**
   * GET /v1/notifications/channels
   * List all notification channels for the authenticated org.
   */
  fastify.get("/v1/notifications/channels", async (request, reply) => {
    const channels = await listNotificationChannels(request.orgId);
    return reply.code(200).send({ data: channels.map(sanitizeChannel) });
  });

  /**
   * POST /v1/notifications/rules
   * Create an alert rule that routes events to a channel.
   */
  fastify.post("/v1/notifications/rules", async (request, reply) => {
    const result = CreateAlertRuleSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { eventType, minSeverity, channelId } = result.data;

    // Verify the channel belongs to this org
    const channel = await getNotificationChannel(channelId, request.orgId);
    if (!channel) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const rule = await createAlertRule({
      id: randomUUID(),
      orgId: request.orgId,
      eventType,
      minSeverity,
      channelId,
    });

    return reply.code(201).send(rule);
  });

  /**
   * GET /v1/notifications/rules
   * List all alert rules for the authenticated org.
   */
  fastify.get("/v1/notifications/rules", async (request, reply) => {
    const rules = await listAlertRules(request.orgId);
    return reply.code(200).send({ data: rules });
  });

  /**
   * POST /v1/notifications/test
   * Send a test notification through a specific channel.
   */
  fastify.post(
    "/v1/notifications/test",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = SendTestSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { channelId, eventType, severity } = result.data;

      const channelRow = await getNotificationChannel(channelId, request.orgId);
      if (!channelRow) {
        return reply.code(404).send({ error: "Channel not found" });
      }

      const channel: NotificationChannel = {
        id: channelRow.id,
        orgId: channelRow.orgId,
        kind: channelRow.kind as "slack",
        name: channelRow.name,
        config: channelRow.config as unknown as NotificationChannel["config"],
        createdAt: channelRow.createdAt,
        updatedAt: channelRow.updatedAt,
      };

      const event: AlertEvent = {
        type: eventType,
        severity,
        orgId: request.orgId,
        agentId: "test-agent",
        message: `This is a test notification for event type "${eventType}" at severity "${severity}".`,
        metadata: { test: true },
        occurredAt: new Date(),
      };

      const rules = await getAlertRulesForOrg(request.orgId);
      const channelMap = new Map([[channel.id, channel]]);

      // For test, create a synthetic rule pointing at the requested channel
      const testRule = {
        id: "test-rule",
        orgId: request.orgId,
        eventType,
        minSeverity: severity,
        channelId,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let status: "sent" | "failed" = "sent";
      let errorMsg: string | undefined;

      try {
        await dispatchAlert(
          event,
          [testRule, ...rules] as unknown as AlertRule[],
          channelMap,
          fastify.log,
        );
      } catch (err) {
        status = "failed";
        errorMsg = err instanceof Error ? err.message : "Unknown error";
        fastify.log.error({ err, channelId }, "Test notification failed");
      }

      await createNotificationLogEntry({
        id: randomUUID(),
        orgId: request.orgId,
        channelId,
        eventType,
        severity,
        agentId: "test-agent",
        status,
        error: errorMsg,
      });

      if (status === "failed") {
        return reply.code(502).send({ error: "Notification delivery failed", message: errorMsg });
      }

      return reply.code(200).send({ ok: true });
    },
  );
}

/** Strip the raw config (may contain webhook URLs) — return only safe fields */
function sanitizeChannel(
  channel: Awaited<ReturnType<typeof createNotificationChannel>>,
): Record<string, unknown> {
  return {
    id: channel.id,
    orgId: channel.orgId,
    kind: channel.kind,
    name: channel.name,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}
