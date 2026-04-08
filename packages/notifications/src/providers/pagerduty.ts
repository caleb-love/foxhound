import type {
  NotificationProvider,
  AlertEvent,
  NotificationChannel,
  PagerDutyChannelConfig,
} from "../types.js";
import { PAGERDUTY_SEVERITY } from "../types.js";

const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";

/**
 * PagerDuty Events API v2 notification provider.
 *
 * Triggers an alert for critical/high severity events and auto-resolves when
 * an "agent_recovered" companion event is sent.  Severity mapping:
 *   critical → "critical", high → "error", medium → "warning", low → "info"
 *
 * Requires a PagerDuty integration/routing key (Events API v2 integration).
 */
export class PagerDutyProvider implements NotificationProvider {
  readonly kind = "pagerduty";

  async send(event: AlertEvent, channel: NotificationChannel): Promise<void> {
    const config = channel.config as PagerDutyChannelConfig;
    const payload = buildPayload(event, config);

    const response = await fetch(PAGERDUTY_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(`PagerDuty Events API returned ${response.status}: ${text}`);
    }
  }

  /**
   * Send a resolve event to auto-resolve a previously triggered incident.
   *
   * @param dedupKey  The deduplication key returned from or used in the trigger call.
   * @param config    The channel config containing the integration key.
   */
  async resolve(dedupKey: string, config: PagerDutyChannelConfig): Promise<void> {
    const payload = {
      routing_key: config.integrationKey,
      dedup_key: dedupKey,
      event_action: "resolve",
    };

    const response = await fetch(PAGERDUTY_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(`PagerDuty resolve returned ${response.status}: ${text}`);
    }
  }
}

function buildPayload(event: AlertEvent, config: PagerDutyChannelConfig): Record<string, unknown> {
  const severity = PAGERDUTY_SEVERITY[event.severity];
  const traceUrl =
    event.traceId && config.dashboardBaseUrl
      ? `${config.dashboardBaseUrl}/traces/${event.traceId}`
      : undefined;

  const customDetails: Record<string, unknown> = {
    orgId: event.orgId,
    agentId: event.agentId,
    eventType: event.type,
    occurredAt: event.occurredAt.toISOString(),
    ...event.metadata,
  };
  if (event.sessionId) {
    customDetails["sessionId"] = event.sessionId;
  }

  const links: Array<{ href: string; text: string }> = [];
  if (traceUrl) {
    links.push({ href: traceUrl, text: "View Trace in Foxhound" });
  }

  return {
    routing_key: config.integrationKey,
    event_action: "trigger",
    dedup_key: event.traceId
      ? `foxhound-${event.orgId}-${event.traceId}`
      : `foxhound-${event.orgId}-${event.agentId}-${event.type}`,
    payload: {
      summary: `[Foxhound] ${event.type}: ${event.message}`,
      severity,
      source: `foxhound/${event.agentId}`,
      timestamp: event.occurredAt.toISOString(),
      custom_details: customDetails,
    },
    links,
  };
}
