import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FoxhoundApiClient } from "@foxhound/api-client";
import { registerAlertTools } from "./alerts.js";
import { registerChannelAndApiKeyTools } from "./channels-api-keys.js";
import { registerGovernanceTools } from "./governance.js";
import { registerWorkflowTools } from "./scores-evaluators-datasets-prompts.js";
import { registerTraceTools } from "./traces.js";

export function registerTools(server: McpServer, api: FoxhoundApiClient): void {
  registerTraceTools(server, api);
  registerAlertTools(server, api);
  registerChannelAndApiKeyTools(server, api);
  registerGovernanceTools(server, api);
  registerWorkflowTools(server, api);
}
