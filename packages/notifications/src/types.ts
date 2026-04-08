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
  kind: "slack";
  name: string;
  /** Encrypted config stored in DB; provider receives the decrypted version */
  config: SlackChannelConfig;
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
