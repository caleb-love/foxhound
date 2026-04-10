import type {
  NotificationProvider,
  AlertEvent,
  NotificationChannel,
  LinearChannelConfig,
} from "../types.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";

const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        url
      }
    }
  }
`;

/**
 * Linear notification provider.
 *
 * Creates a Linear issue for any Foxhound alert, including the trace link,
 * span summary, and suggested investigation steps.
 *
 * Requires a Linear API key and a team ID.
 */
export class LinearProvider implements NotificationProvider {
  readonly kind = "linear";

  async send(event: AlertEvent, channel: NotificationChannel): Promise<void> {
    const config = channel.config as LinearChannelConfig;
    const title = buildIssueTitle(event);
    const description = buildIssueDescription(event, config);

    const variables: Record<string, unknown> = {
      input: {
        teamId: config.teamId,
        title,
        description,
        priority: PRIORITY_MAP[event.severity],
      },
    };
    if (config.projectId) {
      (variables["input"] as Record<string, unknown>)["projectId"] = config.projectId;
    }

    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.apiKey,
      },
      body: JSON.stringify({
        query: CREATE_ISSUE_MUTATION,
        variables,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(`Linear API returned ${response.status}: ${text}`);
    }

    const json = (await response.json()) as {
      data?: { issueCreate?: { success: boolean } };
      errors?: Array<{ message: string }>;
    };

    if (json.errors && json.errors.length > 0) {
      throw new Error(`Linear API error: ${json.errors[0]?.message}`);
    }

    if (!json.data?.issueCreate?.success) {
      throw new Error("Linear issue creation returned success=false");
    }
  }
}

/** Linear priority values: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low */
const PRIORITY_MAP: Record<string, number> = {
  critical: 1, // Urgent
  high: 2,
  medium: 3,
  low: 4,
};

const EVENT_LABEL: Record<string, string> = {
  agent_failure: "Agent Failure",
  anomaly_detected: "Anomaly Detected",
  cost_spike: "Cost Spike",
  compliance_violation: "Compliance Violation",
  cost_budget_exceeded: "Cost Budget Exceeded",
  sla_duration_breach: "SLA Duration Breach",
  sla_success_rate_breach: "SLA Success Rate Breach",
  behavior_regression: "Behavior Regression Detected",
};

function buildIssueTitle(event: AlertEvent): string {
  const label = EVENT_LABEL[event.type] ?? event.type;
  return `[Foxhound] ${label}: ${truncate(event.message, 100)}`;
}

function buildIssueDescription(event: AlertEvent, config: LinearChannelConfig): string {
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

  lines.push(
    "",
    "### Suggested Investigation Steps",
    "",
    `1. [Open the trace in Foxhound](${traceUrl ?? "#"}) and inspect the failing span`,
    "2. Check recent deployments or code changes for this agent",
    "3. Review agent logs and tool call inputs/outputs around the failure time",
    "4. If a compliance violation, audit the full conversation replay for policy adherence",
  );

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
    `*Created automatically by [Foxhound](${config.dashboardBaseUrl ?? "https://foxhound.ai"}) observability platform.*`,
  );

  return lines.join("\n");
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}
