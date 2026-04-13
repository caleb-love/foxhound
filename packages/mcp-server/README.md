# @foxhound-ai/mcp-server

MCP server for querying and debugging Foxhound traces from Claude Code, Cursor, Windsurf, and other MCP-compatible clients.

This package exposes Foxhound data through MCP tools so you can inspect traces, replay execution context, compare runs, and investigate anomalous behavior without leaving your editor.

## Install

### From npm

```bash
npx @foxhound-ai/mcp-server
```

### In Claude Code

```bash
claude mcp add foxhound \
  -e FOXHOUND_API_KEY=fox_your_key \
  -e FOXHOUND_ENDPOINT=http://localhost:3000 \
  -- npx @foxhound-ai/mcp-server
```

### In Cursor or Windsurf

Add an MCP server entry to your MCP configuration:

```json
{
  "mcpServers": {
    "foxhound": {
      "command": "npx",
      "args": ["@foxhound-ai/mcp-server"],
      "env": {
        "FOXHOUND_API_KEY": "fox_your_key",
        "FOXHOUND_ENDPOINT": "http://localhost:3000"
      }
    }
  }
}
```

### From the MCP Registry

If you are using registry-based install flows, use the published server name:

```bash
claude mcp add io.github.caleb-love/foxhound
```

## Required environment variables

| Variable            | Required | Default                 | Description           |
| ------------------- | -------- | ----------------------- | --------------------- |
| `FOXHOUND_API_KEY`  | Yes      | none                    | Your Foxhound API key |
| `FOXHOUND_ENDPOINT` | No       | `http://localhost:3001` | Foxhound API base URL |

If your local API runs on a different port or host, set `FOXHOUND_ENDPOINT` explicitly.

## What this package provides

The MCP server exposes Foxhound operations as tools that MCP clients can call during debugging and investigation workflows.

Common use cases:

- inspect recent traces for a specific agent
- fetch a full trace and view the span tree
- replay a specific span to recover context
- compare two runs to understand behavioral drift
- inspect anomalies and usage patterns

## Tool overview

### `foxhound_search_traces`

Search traces by agent name, time range, and pagination.

Example prompts:

- "Show me all traces for billing-bot in the last hour"
- "Find failed traces from the past day"

### `foxhound_get_trace`

Fetch a full trace with its span tree.

Example prompts:

- "Get trace abc-123 and show the full execution tree"
- "What happened in trace def-456?"

### `foxhound_replay_span`

Replay a span to inspect execution context, model inputs, and tool state.

Example prompts:

- "Replay span xyz in trace abc-123"

### `foxhound_diff_runs`

Compare two traces and highlight divergence points.

Example prompts:

- "Compare trace A and trace B and tell me why they differ"

### `foxhound_get_anomalies`

Surface abnormal behavior such as spikes in latency or unusual tool usage.

Example prompts:

- "Any anomalies for onboarding-agent in the last 12 hours?"

### `foxhound_get_cost_summary`

Return span usage and billing-period summary information.

Example prompts:

- "How many spans have we used this billing period?"

## Local development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Publishing

This package also includes:

- `server.json` for MCP registry metadata
- `PUBLISH.md` for MCP registry publication steps

## License

MIT
