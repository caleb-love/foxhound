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
} from "./types.js";

export { SEVERITY_RANK } from "./types.js";
export { dispatchAlert } from "./dispatcher.js";
export { SlackProvider } from "./providers/index.js";
