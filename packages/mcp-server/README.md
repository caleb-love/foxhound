# @foxhound/mcp-server

MCP server for querying Foxhound traces from Claude Code, Cursor, Windsurf, or any MCP-connected IDE.

## Setup

### Claude Code

```bash
claude mcp add foxhound -e FOXHOUND_API_KEY=fox_your_key -e FOXHOUND_ENDPOINT=https://api.foxhound.dev -- npx @foxhound/mcp-server
```

### Cursor / Windsurf

Add to your MCP config (`.cursor/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "foxhound": {
      "command": "npx",
      "args": ["@foxhound/mcp-server"],
      "env": {
        "FOXHOUND_API_KEY": "fox_your_key",
        "FOXHOUND_ENDPOINT": "https://api.foxhound.dev"
      }
    }
  }
}
```

### Environment Variables

| Variable            | Required | Default                 | Description           |
| ------------------- | -------- | ----------------------- | --------------------- |
| `FOXHOUND_API_KEY`  | Yes      | —                       | Your Foxhound API key |
| `FOXHOUND_ENDPOINT` | No       | `http://localhost:3001` | Foxhound API base URL |

## Tools

### foxhound_search_traces

Search traces by agent name, time range, and status.

```
"Show me all traces for agent billing-bot in the last hour"
"Find error traces from the past 24 hours"
```

**Parameters:** `agent_name`, `status` (ok/error), `from`, `to` (ISO 8601 or epoch ms), `limit`

### foxhound_get_trace

Get the full trace with its complete span tree.

```
"Get trace abc-123 and show me the span tree"
"What happened in trace def-456?"
```

**Parameters:** `trace_id`

### foxhound_replay_span

Reconstruct agent state at a specific span — LLM context, tool inputs, and memory.

```
"Replay span xyz in trace abc-123 — what was the agent's context?"
```

**Parameters:** `trace_id`, `span_id`

### foxhound_diff_runs

Compare two agent runs side-by-side and surface divergence points.

```
"Compare runs abc and def — why did the second one fail?"
```

**Parameters:** `trace_id_a`, `trace_id_b`

### foxhound_get_anomalies

Surface behavioral anomalies — slow spans, error spikes, or unusual tool usage patterns.

```
"Any anomalies for billing-bot in the last 12 hours?"
"Show me error spikes for the onboarding agent"
```

**Parameters:** `agent_name`, `hours` (lookback window, default 24)

### foxhound_get_cost_summary

Get span usage and billing period summary.

```
"How many spans have we used this period?"
```

**Parameters:** `agent_name` (optional, org-level by default)

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

## License

MIT
