#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FoxhoundApiClient } from "@foxhound/api-client";
import packageJson from "../package.json" with { type: "json" };
import { getConfig } from "./lib/config.js";
import { registerTools } from "./tools/registry.js";

async function main(): Promise<void> {
  const config = getConfig();
  const api = new FoxhoundApiClient(config);

  const server = new McpServer({
    name: "foxhound",
    version: packageJson.version,
  });

  registerTools(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
