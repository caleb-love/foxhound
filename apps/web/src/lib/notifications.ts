export type EventType = "agent_failure" | "anomaly_detected" | "cost_spike" | "compliance_violation";
export type Severity = "critical" | "high" | "medium" | "low";

export interface NotificationChannel {
  id: string;
  orgId: string;
  kind: "slack";
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRule {
  id: string;
  orgId: string;
  eventType: EventType;
  minSeverity: Severity;
  channelId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listChannels(): Promise<NotificationChannel[]> {
  const res = await fetch("/api/notifications/channels", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list channels: ${res.status}`);
  const data = (await res.json()) as { data: NotificationChannel[] };
  return data.data;
}

export async function createChannel(params: {
  name: string;
  webhookUrl: string;
}): Promise<NotificationChannel> {
  const res = await fetch("/api/notifications/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      kind: "slack",
      config: { webhookUrl: params.webhookUrl },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to create channel: ${res.status}`);
  }
  return res.json() as Promise<NotificationChannel>;
}

export async function listRules(): Promise<AlertRule[]> {
  const res = await fetch("/api/notifications/rules", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list rules: ${res.status}`);
  const data = (await res.json()) as { data: AlertRule[] };
  return data.data;
}

export async function createRule(params: {
  eventType: EventType;
  minSeverity: Severity;
  channelId: string;
}): Promise<AlertRule> {
  const res = await fetch("/api/notifications/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to create rule: ${res.status}`);
  }
  return res.json() as Promise<AlertRule>;
}

export async function sendTestNotification(params: {
  channelId: string;
  eventType?: EventType;
  severity?: Severity;
}): Promise<void> {
  const res = await fetch("/api/notifications/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message ?? body.error ?? `Test notification failed: ${res.status}`);
  }
}
