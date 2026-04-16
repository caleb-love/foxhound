---
title: MCP Server Setup
sidebar_label: Setup
---

# MCP Server Setup

The Foxhound MCP server exposes your traces and observability data to Claude Code, Cursor, Windsurf, and any other MCP-connected IDE, letting your AI assistant query traces, surface anomalies, explain failures, and score runs — all without leaving your editor.

## Claude Code

```bash
claude mcp add foxhound \
  -e FOXHOUND_API_KEY=fox_your_key \
  -e FOXHOUND_ENDPOINT=https://api.foxhound.caleb-love.com \
  -- npx @foxhound-ai/mcp-server
```

Once added, the server starts automatically when Claude Code launches. Verify it's running:

```bash
claude mcp list
```

## Cursor / Windsurf

Add to your MCP config (`.cursor/mcp.json` for Cursor, or the equivalent for Windsurf):

```json
{
  "mcpServers": {
    "foxhound": {
      "command": "npx",
      "args": ["@foxhound-ai/mcp-server"],
      "env": {
        "FOXHOUND_API_KEY": "fox_your_key",
        "FOXHOUND_ENDPOINT": "https://api.foxhound.caleb-love.com"
      }
    }
  }
}
```

Restart your IDE after saving the config.

## Other MCP clients

Run the server directly via npx — any MCP client that supports the stdio transport can connect:

```bash
FOXHOUND_API_KEY=fox_... FOXHOUND_ENDPOINT=https://api.foxhound.caleb-love.com npx @foxhound-ai/mcp-server
```

## Environment Variables

| Variable            | Required | Default                 | Description           |
| ------------------- | -------- | ----------------------- | --------------------- |
| `FOXHOUND_API_KEY`  | Yes      | —                       | Your Foxhound API key |
| `FOXHOUND_ENDPOINT` | No       | `http://localhost:3001` | Foxhound API base URL |

## Example prompts

Once connected, try these prompts in your AI assistant:

```
Show me all error traces from billing-bot in the last hour
```

```
Compare runs abc-123 and def-456 — why did the second one fail?
```

```
Any anomalies for the onboarding agent in the last 24 hours?
```

```
Explain the failure in trace xyz-789
```

## Next Steps

- [Tool Reference →](./tool-reference) — all 30 MCP tools with parameters and examples
