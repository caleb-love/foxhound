import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FoxhoundApiClient } from "@foxhound/api-client";

export function registerAlertTools(server: McpServer, api: FoxhoundApiClient): void {
  server.tool(
    "foxhound_list_alert_rules",
    "List all alert rules configured for your organization.",
    {},
    async () => {
      const data = await api.listAlertRules();
      const rules = data.data;
      if (!rules.length) return { content: [{ type: "text", text: "No alert rules configured." }] };

      const lines = rules.map(
        (r) =>
          `- **${r.id}** | ${r.eventType} >= ${r.minSeverity} -> channel ${r.channelId} | ${r.enabled ? "enabled" : "disabled"}`,
      );
      return {
        content: [{ type: "text", text: `## Alert Rules (${rules.length})\n\n${lines.join("\n")}` }],
      };
    },
  );

  server.tool(
    "foxhound_create_alert_rule",
    "Create a new alert rule that routes events to a notification channel. This is a write operation.",
    {
      event_type: z
        .enum(["agent_failure", "anomaly_detected", "cost_spike", "compliance_violation"])
        .describe("The event type to trigger on"),
      min_severity: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Minimum severity to trigger (default: high)"),
      channel_id: z.string().describe("The notification channel ID to route alerts to"),
    },
    async (params) => {
      const rule = await api.createAlertRule({
        eventType: params.event_type,
        minSeverity: params.min_severity ?? "high",
        channelId: params.channel_id,
      });
      return {
        content: [
          {
            type: "text",
            text: `Alert rule created: **${rule.id}**\n- Event: ${rule.eventType}\n- Severity >= ${rule.minSeverity}\n- Channel: ${rule.channelId}`,
          },
        ],
      };
    },
  );

  server.tool(
    "foxhound_delete_alert_rule",
    "Delete an alert rule by ID. Set confirm=true to execute. Without confirmation, returns a preview of what will be deleted.",
    {
      rule_id: z.string().describe("The alert rule ID to delete"),
      confirm: z.boolean().optional().describe("Set to true to confirm deletion. Omit to preview."),
    },
    async (params) => {
      return {
        content: [
          {
            type: "text",
            text:
              `Alert rule deletion is not supported by the current Foxhound API. ` +
              `Do not rely on MCP for this operation until the backend route exists. ` +
              `Requested rule: **${params.rule_id}**.`,
          },
        ],
      };
    },
  );
}
