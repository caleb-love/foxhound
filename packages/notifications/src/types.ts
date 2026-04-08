// ──────────────────────────────────────────────────────────────────────────────
// Alert event types
// ──────────────────────────────────────────────────────────────────────────────

export type AlertEventType =
  | "agent_failure"
  | "anomaly_detected"
  | "cost_spike"
  | "compliance_violation";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface AlertEvent {
  type: AlertEventType;
  severity: AlertSeverity;
  orgId: string;
  agentId: string;
  traceId?: string;
  sessionId?: string;
  message: string;
  /** Additional event-specific metadata */
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

// ──────────────────────────────────────────────────────────────────────────────
// Provider interface
// ──────────────────────────────────────────────────────────────────────────────

export interface NotificationProvider {
  readonly kind: string;
  send(event: AlertEvent, channel: NotificationChannel): Promise<void>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Channel / rule types (mirrors DB rows, decoupled from Drizzle)
// ──────────────────────────────────────────────────────────────────────────────

export interface NotificationChannel {
  id: string;
  orgId: string;
  kind: "slack" | "pagerduty" | "github" | "linear" | "webhook";
  name: string;
  /** Encrypted config stored in DB; provider receives the decrypted version */
  config:
    | SlackChannelConfig
    | PagerDutyChannelConfig
    | GitHubChannelConfig
    | LinearChannelConfig
    | WebhookChannelConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlackChannelConfig {
  webhookUrl: string;
  /** Optional override channel name (e.g. #alerts) */
  channel?: string;
  /** Link back to the Foxhound dashboard for this org */
  dashboardBaseUrl?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// PagerDuty
// ──────────────────────────────────────────────────────────────────────────────

export interface PagerDutyChannelConfig {
  /** PagerDuty Events API v2 routing/integration key */
  integrationKey: string;
  /** Optional link back to the Foxhound dashboard for this org */
  dashboardBaseUrl?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// GitHub Issues
// ──────────────────────────────────────────────────────────────────────────────

export interface GitHubChannelConfig {
  /** GitHub personal access token or fine-grained token with issues:write */
  token: string;
  /** Repository in "owner/repo" format */
  repo: string;
  /** Optional label(s) to apply to created issues */
  labels?: string[];
  /** Optional link back to the Foxhound dashboard for this org */
  dashboardBaseUrl?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Linear
// ──────────────────────────────────────────────────────────────────────────────

export interface LinearChannelConfig {
  /** Linear API key */
  apiKey: string;
  /** Linear team ID to create issues in */
  teamId: string;
  /** Optional project ID */
  projectId?: string;
  /** Optional link back to the Foxhound dashboard for this org */
  dashboardBaseUrl?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic Webhook
// ──────────────────────────────────────────────────────────────────────────────

export interface WebhookChannelConfig {
  /** Endpoint to POST the event payload to */
  url: string;
  /** Secret used for HMAC-SHA256 signing (X-Foxhound-Signature header) */
  secret: string;
  /** Optional custom headers to send with every request */
  headers?: Record<string, string>;
  /** Optional link back to the Foxhound dashboard for this org */
  dashboardBaseUrl?: string;
}

export interface AlertRule {
  id: string;
  orgId: string;
  /** Which event type triggers this rule */
  eventType: AlertEventType;
  /** Minimum severity that triggers this rule */
  minSeverity: AlertSeverity;
  /** Target notification channel */
  channelId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────────────────────────────────────────
// Severity ordering (higher index = higher severity)
// ──────────────────────────────────────────────────────────────────────────────

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ──────────────────────────────────────────────────────────────────────────────
// PagerDuty severity mapping
// ──────────────────────────────────────────────────────────────────────────────

export const PAGERDUTY_SEVERITY: Record<AlertSeverity, "critical" | "error" | "warning" | "info"> = {
  critical: "critical",
  high: "error",
  medium: "warning",
  low: "info",
};
