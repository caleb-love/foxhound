import type {
  NotificationProvider,
  AlertEvent,
  NotificationChannel,
  GitHubChannelConfig,
} from "../types.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * GitHub Issues notification provider.
 *
 * Creates a GitHub issue from a Foxhound alert event, including full trace
 * context, span summary, and a link back to the Foxhound dashboard.
 *
 * Requires a GitHub token with `issues:write` permission on the target repo.
 */
export class GitHubProvider implements NotificationProvider {
  readonly kind = "github";

  async send(event: AlertEvent, channel: NotificationChannel): Promise<void> {
    const config = channel.config as GitHubChannelConfig;
    const body = buildIssueBody(event, config);
    const title = buildIssueTitle(event);

    const url = `${GITHUB_API_BASE}/repos/${config.repo}/issues`;
    const payload: Record<string, unknown> = { title, body };
    if (config.labels && config.labels.length > 0) {
      payload["labels"] = config.labels;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(`GitHub API returned ${response.status}: ${text}`);
    }
  }
}

function buildIssueTitle(event: AlertEvent): string {
  const label = EVENT_LABEL[event.type] ?? event.type;
  return `[Foxhound] ${label}: ${truncate(event.message, 100)}`;
}

function buildIssueBody(event: AlertEvent, config: GitHubChannelConfig): string {
  const traceUrl =
    event.traceId && config.dashboardBaseUrl
      ? `${config.dashboardBaseUrl}/traces/${event.traceId}`
      : null;

  const lines: string[] = [
    `## Foxhound Alert: ${EVENT_LABEL[event.type] ?? event.type}`,
    "",
    `**Severity:** ${event.severity.toUpperCase()}`,
    `**Agent ID:** \`${event.agentId}\``,
    `**Org ID:** \`${event.orgId}\``,
    `**Occurred At:** ${event.occurredAt.toISOString()}`,
    "",
    "### Summary",
    "",
    event.message,
  ];

  if (event.traceId) {
    lines.push("", "### Trace");
    if (traceUrl) {
      lines.push("", `[View trace in Foxhound](${traceUrl})`);
    } else {
      lines.push("", `Trace ID: \`${event.traceId}\``);
    }
  }

  if (event.sessionId) {
    lines.push("", `**Session ID:** \`${event.sessionId}\``);
  }

  const metaEntries = Object.entries(event.metadata);
  if (metaEntries.length > 0) {
    lines.push("", "### Additional Context", "");
    for (const [k, v] of metaEntries) {
      lines.push(`- **${k}:** \`${String(v)}\``);
    }
  }

  lines.push(
    "",
    "---",
    "",
    `*This issue was automatically created by [Foxhound](${config.dashboardBaseUrl ?? "https://foxhound.ai"}) observability platform.*`,
  );

  return lines.join("\n");
}

const EVENT_LABEL: Record<string, string> = {
  agent_failure: "Agent Failure",
  anomaly_detected: "Anomaly Detected",
  cost_spike: "Cost Spike",
  compliance_violation: "Compliance Violation",
};

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}
