import type { AlertEvent, AlertRule, NotificationChannel, NotificationProvider } from "./types.js";
import { SEVERITY_RANK } from "./types.js";
import { SlackProvider } from "./providers/index.js";
import { PagerDutyProvider } from "./providers/index.js";
import { GitHubProvider } from "./providers/index.js";
import { LinearProvider } from "./providers/index.js";
import { WebhookProvider } from "./providers/index.js";

const PROVIDERS: Record<string, NotificationProvider> = {
  slack: new SlackProvider(),
  pagerduty: new PagerDutyProvider(),
  github: new GitHubProvider(),
  linear: new LinearProvider(),
  webhook: new WebhookProvider(),
};

/**
 * Dispatches an alert event to all matching channels based on the org's rules.
 *
 * @param event      The alert event to dispatch.
 * @param rules      Alert rules for the org (pre-filtered to the org).
 * @param channels   Notification channels keyed by ID.
 * @param logger     Optional logger (e.g. Fastify logger).
 */
export async function dispatchAlert(
  event: AlertEvent,
  rules: AlertRule[],
  channels: Map<string, NotificationChannel>,
  logger?: { error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const matchingRules = rules.filter(
    (rule) =>
      rule.enabled &&
      rule.eventType === event.type &&
      SEVERITY_RANK[event.severity] >= SEVERITY_RANK[rule.minSeverity],
  );

  await Promise.allSettled(
    matchingRules.map(async (rule) => {
      const channel = channels.get(rule.channelId);
      if (!channel) {
        logger?.error({ ruleId: rule.id, channelId: rule.channelId }, "Channel not found for rule");
        return;
      }

      const provider = PROVIDERS[channel.kind];
      if (!provider) {
        logger?.error({ channelKind: channel.kind }, "No provider registered for channel kind");
        return;
      }

      try {
        await provider.send(event, channel);
      } catch (err) {
        logger?.error(
          { err, ruleId: rule.id, channelId: channel.id, eventType: event.type },
          "Failed to send notification",
        );
      }
    }),
  );
}
