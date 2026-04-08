/**
 * @foxhound/notifications — Generic notification pipeline for Foxhound.
 *
 * Exports the provider interface, alert event types, and the dispatch function.
 * New providers (PagerDuty, GitHub, Linear, webhooks) implement NotificationProvider
 * and register in dispatcher.ts.
 */

export type {
  AlertEvent,
  AlertEventType,
  AlertSeverity,
  AlertRule,
  NotificationChannel,
  NotificationProvider,
  SlackChannelConfig,
  PagerDutyChannelConfig,
  GitHubChannelConfig,
  LinearChannelConfig,
  WebhookChannelConfig,
} from "./types.js";

export { SEVERITY_RANK, PAGERDUTY_SEVERITY } from "./types.js";
export { dispatchAlert } from "./dispatcher.js";
export { SlackProvider } from "./providers/index.js";
export { PagerDutyProvider } from "./providers/index.js";
export { GitHubProvider } from "./providers/index.js";
export { LinearProvider } from "./providers/index.js";
export { WebhookProvider } from "./providers/index.js";
