import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FoxhoundApiClient } from "@foxhound/api-client";

export function registerChannelAndApiKeyTools(server: McpServer, api: FoxhoundApiClient): void {
  server.tool(
    "foxhound_list_channels",
    "List all notification channels (e.g. Slack webhooks) configured for your organization.",
    {},
    async () => {
      const data = await api.listChannels();
      const channels = data.data;
      if (!channels.length) {
        return { content: [{ type: "text", text: "No notification channels configured." }] };
      }

      const lines = channels.map(
        (c) => `- **${c.id}** | ${c.kind} | "${c.name}" | created ${c.createdAt}`,
      );
      return {
        content: [{ type: "text", text: `## Notification Channels (${channels.length})\n\n${lines.join("\n")}` }],
      };
    },
  );

  server.tool(
    "foxhound_create_channel",
    "Create a new Slack notification channel. This is a write operation.",
    {
      name: z.string().describe("A human-readable name for the channel"),
      webhook_url: z.string().describe("The Slack incoming webhook URL"),
      slack_channel: z.string().optional().describe("Optional Slack channel override"),
    },
    async (params) => {
      const channel = await api.createChannel({
        name: params.name,
        kind: "slack",
        config: { webhookUrl: params.webhook_url, channel: params.slack_channel },
      });
      return {
        content: [{ type: "text", text: `Channel created: **${channel.id}** ("${channel.name}", ${channel.kind})` }],
      };
    },
  );

  server.tool(
    "foxhound_test_channel",
    "Send a test alert through a notification channel to verify it works.",
    { channel_id: z.string().describe("The channel ID to test") },
    async (params) => {
      await api.testChannel(params.channel_id);
      return { content: [{ type: "text", text: `Test alert sent to channel **${params.channel_id}**.` }] };
    },
  );

  server.tool(
    "foxhound_delete_channel",
    "Delete a notification channel by ID. This may also delete associated alert rules. Set confirm=true to execute.",
    {
      channel_id: z.string().describe("The channel ID to delete"),
      confirm: z.boolean().optional().describe("Set to true to confirm deletion. Omit to preview."),
    },
    async (params) => {
      if (!params.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `**Preview:** Will delete channel **${params.channel_id}** and any alert rules routing to it.\n\nCall again with \`confirm: true\` to execute.`,
            },
          ],
        };
      }
      await api.deleteChannel(params.channel_id);
      return { content: [{ type: "text", text: `Channel **${params.channel_id}** deleted.` }] };
    },
  );

  server.tool(
    "foxhound_list_api_keys",
    "List active API keys for your organization. Keys are masked — only the prefix is shown.",
    {},
    async () => {
      const data = await api.listApiKeys();
      const keys = data.data;
      if (!keys.length) return { content: [{ type: "text", text: "No API keys found." }] };

      const lines = keys.map(
        (k) => `- **${k.id}** | "${k.name}" | prefix: ${k.prefix}... | created ${k.createdAt}`,
      );
      return { content: [{ type: "text", text: `## API Keys (${keys.length})\n\n${lines.join("\n")}` }] };
    },
  );

  server.tool(
    "foxhound_create_api_key",
    "Create a new API key. For security, the plaintext key is NOT returned through MCP — use the CLI (`foxhound keys create`) or dashboard to retrieve it.",
    { name: z.string().describe("A human-readable name for the key") },
    async (params) => {
      const result = await api.createApiKey(params.name);
      return {
        content: [
          {
            type: "text",
            text:
              `API key created: **${result.id}** ("${result.name}", prefix: ${result.prefix}...)\n\n` +
              `The plaintext key is not shown in MCP for security reasons.\n` +
              `Retrieve it from the CLI output or dashboard. It cannot be shown again after creation.`,
          },
        ],
      };
    },
  );

  server.tool(
    "foxhound_revoke_api_key",
    "Revoke an API key by ID. The key will immediately stop working. Set confirm=true to execute.",
    {
      key_id: z.string().describe("The API key ID to revoke"),
      confirm: z.boolean().optional().describe("Set to true to confirm revocation. Omit to preview."),
    },
    async (params) => {
      if (!params.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `**Preview:** Will revoke API key **${params.key_id}**. Any integrations using this key will immediately stop working.\n\nCall again with \`confirm: true\` to execute.`,
            },
          ],
        };
      }
      await api.revokeApiKey(params.key_id);
      return { content: [{ type: "text", text: `API key **${params.key_id}** revoked.` }] };
    },
  );
}
