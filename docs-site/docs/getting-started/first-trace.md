---
title: Your First Trace
sidebar_label: First Trace
---

# Your First Trace

After running the [Quickstart](./quickstart), your trace is visible in the Foxhound UI. This guide walks you through what you'll see.

## Open the Viewer

**Local trace viewer:**

```bash
# Python CLI
foxhound ui

# Or via npx
npx foxhound ui
```

The viewer starts at `http://localhost:4000` by default.

## Understanding the Trace View

A **trace** represents one complete agent run — from the initial input to the final output. Each trace contains a tree of **spans**.

### Span types

| Kind        | Description                                         |
| ----------- | --------------------------------------------------- |
| `tool_call` | An external tool invocation (search, database, API) |
| `llm`       | An LLM completion call                              |
| `chain`     | A multi-step reasoning chain                        |
| `agent`     | A top-level agent turn                              |
| `retrieval` | A vector store or document retrieval                |

### Span tree

The span tree shows the parent-child relationships between operations. A span that calls an LLM will show the LLM span nested beneath it, and so on.

```
agent:my-agent  [350ms]
├── tool:search  [120ms]
│   └── llm:gpt-4o  [98ms]
└── llm:gpt-4o  [210ms]
```

### Attributes

Each span carries attributes — key-value pairs attached at trace time. Common attributes include:

- `query` — the input to a tool or LLM
- `response` — the output
- `model` — the LLM model name
- `tokens` — token counts (prompt, completion, total)
- `status` — `ok` or `error`

## Replaying a Span

On Pro plans, you can replay any span to reconstruct the exact agent state at that moment — LLM context window, tool inputs, and memory. Use the **Replay** button in the UI, or the MCP tool [`foxhound_replay_span`](../mcp-server/tool-reference#foxhound_replay_span).

## Comparing Runs

The **Diff Runs** feature lets you compare two agent executions side-by-side to find where they diverged. This is useful for debugging regressions — use [`foxhound_diff_runs`](../mcp-server/tool-reference#foxhound_diff_runs) from your IDE.

## Next Steps

- [Python SDK Reference →](../sdk/python)
- [TypeScript SDK Reference →](../sdk/typescript)
- [MCP Server →](../mcp-server/setup) — query traces from your IDE
