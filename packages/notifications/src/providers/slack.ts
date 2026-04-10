import type {
  NotificationProvider,
  AlertEvent,
  NotificationChannel,
  SlackChannelConfig,
} from "../types.js";

/** Emoji per severity for Block Kit visual hierarchy */
const SEVERITY_EMOJI: Record<string, string> = {
  critical: ":red_circle:",
  high: ":large_orange_circle:",
  medium: ":large_yellow_circle:",
  low: ":large_blue_circle:",
};

/** Human-readable label per event type */
const EVENT_LABELS: Record<string, string> = {
  agent_failure: "Agent Failure",
  anomaly_detected: "Anomaly Detected",
  cost_spike: "Cost Spike",
  compliance_violation: "Compliance Violation",
  cost_budget_exceeded: "Cost Budget Exceeded",
  sla_duration_breach: "SLA Duration Breach",
  sla_success_rate_breach: "SLA Success Rate Breach",
  behavior_regression: "Behavior Regression Detected",
};

export class SlackProvider implements NotificationProvider {
  readonly kind = "slack";

  async send(event: AlertEvent, channel: NotificationChannel): Promise<void> {
    const config = channel.config as SlackChannelConfig;
    const blocks = buildBlocks(event, config);

    const body: Record<string, unknown> = { blocks };
    if (config.channel) {
      body["channel"] = config.channel;
    }

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(`Slack webhook returned ${response.status}: ${text}`);
    }
  }
}

function buildBlocks(event: AlertEvent, config: SlackChannelConfig): unknown[] {
  const emoji = SEVERITY_EMOJI[event.severity] ?? ":white_circle:";
  const label = EVENT_LABELS[event.type] ?? event.type;
  const ts = event.occurredAt.toISOString();

  const headerText = `${emoji} *${label}* — ${event.severity.toUpperCase()}`;

  const fields: Array<{ type: string; text: string }> = [
    { type: "mrkdwn", text: `*Agent ID*\n${event.agentId}` },
    { type: "mrkdwn", text: `*Org ID*\n${event.orgId}` },
    { type: "mrkdwn", text: `*Occurred At*\n${ts}` },
  ];

  if (event.traceId) {
    const traceLink = config.dashboardBaseUrl
      ? `<${config.dashboardBaseUrl}/traces/${event.traceId}|${event.traceId}>`
      : event.traceId;
    fields.push({ type: "mrkdwn", text: `*Trace*\n${traceLink}` });
  }

  if (event.sessionId) {
    fields.push({ type: "mrkdwn", text: `*Session ID*\n${event.sessionId}` });
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${label} — ${event.severity.toUpperCase()}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: headerText },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: event.message },
    },
    {
      type: "section",
      fields,
    },
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Foxhound • ${ts}` }],
    },
  ];

  return blocks;
}
