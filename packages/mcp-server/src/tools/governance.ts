import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FoxhoundApiClient } from "@foxhound/api-client";

export function registerGovernanceTools(server: McpServer, api: FoxhoundApiClient): void {
  server.tool(
    "foxhound_get_cost_summary",
    "Get token usage and cost breakdown. Shows current billing period span usage and limits.",
    {},
    async () => {
      const data = await api.getUsage();
      const pct = data.spansLimit > 0 ? ((data.spansUsed / data.spansLimit) * 100).toFixed(1) : "∞";
      const lines = [
        `## Usage Summary`,
        `- Period: ${data.period}`,
        `- Spans used: ${data.spansUsed.toLocaleString()} / ${data.spansLimit > 0 ? data.spansLimit.toLocaleString() : "unlimited"}`,
        `- Usage: ${pct}%`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "foxhound_status",
    "Check the Foxhound API health and show usage summary for the current billing period.",
    {},
    async () => {
      const [health, usage] = await Promise.all([api.getHealth(), api.getUsage()]);
      const pct =
        usage.spansLimit > 0 ? ((usage.spansUsed / usage.spansLimit) * 100).toFixed(1) : "∞";
      const lines = [
        `## Foxhound Status`,
        `- API: ${health.status} (v${health.version})`,
        `- Period: ${usage.period}`,
        `- Spans: ${usage.spansUsed.toLocaleString()} / ${usage.spansLimit > 0 ? usage.spansLimit.toLocaleString() : "unlimited"} (${pct}%)`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "foxhound_get_agent_budget",
    "Get the cost budget configuration and current spend status for a specific agent.",
    { agentId: z.string().describe("The agent ID to retrieve budget for") },
    async (params) => {
      try {
        const data = await api.getBudget(params.agentId);
        const lines = [
          `## Budget: ${params.agentId}`,
          `- Budget amount: ${data.costBudgetUsd != null ? `$${data.costBudgetUsd}` : "not set"}`,
          `- Period: ${data.budgetPeriod ?? "not set"}`,
          `- Alert threshold: ${data.costAlertThresholdPct != null ? `${data.costAlertThresholdPct}%` : "not set"}`,
          `- Current spend status: ${data.lastCostStatus != null ? JSON.stringify(data.lastCostStatus) : "no data"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error fetching budget for agent "${params.agentId}": ${msg}` },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_check_sla_status",
    "Check SLA targets and compliance status for a specific agent, including p95 duration and success rate.",
    { agentId: z.string().describe("The agent ID to check SLA status for") },
    async (params) => {
      try {
        const data = await api.getSla(params.agentId);
        const slaStatus = data.lastSlaStatus;
        const lines = [
          `## SLA Status: ${params.agentId}`,
          `### Targets`,
          `- Max duration: ${data.maxDurationMs != null ? `${data.maxDurationMs}ms` : "not set"}`,
          `- Min success rate: ${data.minSuccessRate != null ? `${data.minSuccessRate}%` : "not set"}`,
          `- Evaluation window: ${data.evaluationWindowMs != null ? `${data.evaluationWindowMs}ms` : "not set"}`,
          `- Min sample size: ${data.minSampleSize ?? "not set"}`,
          `### Compliance`,
          `- Status: ${slaStatus != null ? JSON.stringify(slaStatus) : "no data"}`,
          slaStatus != null && typeof slaStatus["p95DurationMs"] !== "undefined"
            ? `- p95 duration: ${String(slaStatus["p95DurationMs"])}ms`
            : null,
          slaStatus != null && typeof slaStatus["successRate"] !== "undefined"
            ? `- Success rate: ${String(slaStatus["successRate"])}%`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        return { content: [{ type: "text", text: lines }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error fetching SLA for agent "${params.agentId}": ${msg}` },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_detect_regression",
    "Compare two versions of an agent and detect span-level regressions — missing or newly added spans between versions.",
    {
      agentId: z.string().describe("The agent ID to analyze"),
      versionA: z.string().describe("The baseline version (before)"),
      versionB: z.string().describe("The comparison version (after)"),
    },
    async (params) => {
      try {
        const data = await api.compareVersions(params.agentId, params.versionA, params.versionB);
        const lines: string[] = [
          `## Regression Report: ${params.agentId}`,
          `- Comparing: **${data.previousVersion}** → **${data.newVersion}**`,
          `- Sample sizes: before=${data.sampleSize.before}, after=${data.sampleSize.after}`,
          "",
        ];

        if (!data.regressions.length) {
          lines.push("No regressions detected between these versions.");
        } else {
          lines.push(`### Regressions (${data.regressions.length})`);
          for (const r of data.regressions) {
            if (r.type === "missing") {
              lines.push(
                `- **MISSING** \`${r.span}\` — was present in ${data.previousVersion} (freq: ${r.previousFrequency ?? "?"}) but absent in ${data.newVersion}`,
              );
            } else {
              lines.push(
                `- **NEW** \`${r.span}\` — appeared in ${data.newVersion} (freq: ${r.newFrequency ?? "?"}) but absent in ${data.previousVersion}`,
              );
            }
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error comparing versions for agent "${params.agentId}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_list_baselines",
    "List all stored baseline snapshots for an agent, showing version, sample size, and creation date.",
    { agentId: z.string().describe("The agent ID to list baselines for") },
    async (params) => {
      try {
        const data = await api.listBaselines(params.agentId);
        if (!data.data.length) {
          return {
            content: [{ type: "text", text: `No baselines found for agent "${params.agentId}".` }],
          };
        }

        const lines = [
          `## Baselines: ${params.agentId} (${data.data.length})`,
          "",
          ...data.data.map(
            (b) =>
              `- **v${b.agentVersion}** | sample size: ${b.sampleSize} | created: ${new Date(b.createdAt).toISOString()}`,
          ),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching baselines for agent "${params.agentId}": ${msg}`,
            },
          ],
        };
      }
    },
  );
}
