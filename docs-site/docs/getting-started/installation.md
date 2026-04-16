---
title: Installation
sidebar_label: Installation
---

# Installation

Foxhound provides SDKs for Python and TypeScript, plus an MCP server for IDE integration.

## Python SDK

```bash
pip install foxhound-ai                   # core only
pip install foxhound-ai[langgraph]        # + LangGraph / LangChain support
pip install foxhound-ai[crewai]           # + CrewAI support
pip install foxhound-ai[opentelemetry]    # + OTel bridge (Pydantic AI, Bedrock, Google ADK)
```

## TypeScript / Node.js SDK

```bash
npm install @foxhound-ai/sdk
# or
pnpm add @foxhound-ai/sdk
```

For the OpenTelemetry bridge you also need the OTel packages:

```bash
npm install @foxhound-ai/sdk @opentelemetry/api @opentelemetry/sdk-node
```

## MCP Server (IDE integration)

The Foxhound MCP server lets Claude Code, Cursor, Windsurf, and any other MCP-connected IDE query your traces directly from your AI assistant.

### Claude Code

```bash
# Install directly from npm
claude mcp add foxhound -e FOXHOUND_API_KEY=fox_your_key -e FOXHOUND_ENDPOINT=https://api.foxhound.caleb-love.com -- npx @foxhound-ai/mcp-server
```

### Cursor / Windsurf

Add to your MCP config (`.cursor/mcp.json` or equivalent):

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

## Environment Variables

| Variable            | Required | Default                 | Description           |
| ------------------- | -------- | ----------------------- | --------------------- |
| `FOXHOUND_API_KEY`  | Yes      | —                       | Your Foxhound API key |
| `FOXHOUND_ENDPOINT` | No       | `http://localhost:3001` | Foxhound API base URL |

## Next Steps

- [Quickstart →](./quickstart) — send your first trace in minutes
- [MCP Server Setup →](../mcp-server/setup) — connect your IDE
