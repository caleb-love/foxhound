# Multi-Agent Demo — `agent_id` as a First-Class Dimension

**What this demo shows (WP15)**

A single orchestrator agent that delegates to three subagents —
a **researcher**, a **coder**, and an **evaluator** — and produces one
Foxhound trace in which every span is attributed to the correct subagent
on the wire. At query time, a dashboard or SQL console running against
ClickHouse can `GROUP BY agent_id` and see three distinct series for
the same trace.

This is the concrete answer to the Amber ↔ Mick Slack thread
(Pendo, 2026-03-13) about how to distinguish subagent spans without
walking the `parent_span_id` tree at read time.

## Why this matters

Before WP15, Foxhound had `agent_id` at the **trace** level only. A
single trace that invoked three subagents all got tagged with the
orchestrator's `agent_id`, and pulling "errors by subagent" required
parsing span names or walking the tree. After WP15, each span carries
its own `agent_id` in a nullable first-class column (see RFC-015), so
aggregate queries are sub-second even on billions of rows.

## Architecture

```
orchestrator                    agent_id="orchestrator"
  ├── plan                      agent_id="orchestrator"
  ├── researcher.search         agent_id="researcher"
  │    ├── web.search           agent_id="researcher"
  │    └── fetch.docs           agent_id="researcher"
  ├── coder.generate            agent_id="coder"
  │    ├── tool.write_file      agent_id="coder"
  │    └── tool.run_tests       agent_id="coder"
  └── evaluator.grade           agent_id="evaluator"
       └── llm.judge            agent_id="evaluator"
```

All eight spans live in **one trace**. The span tree is preserved
(`parent_span_id`) so replay still works, and the `agent_id` column
lets dashboards slice instantly.

## How to run

### TypeScript

```bash
cd examples/multi-agent-demo
FOXHOUND_API_KEY=<your key> \
  FOXHOUND_ENDPOINT=http://localhost:3000 \
  pnpm dlx tsx demo.ts
```

### Python

```bash
cd examples/multi-agent-demo
FOXHOUND_API_KEY=<your key> \
  FOXHOUND_ENDPOINT=http://localhost:3000 \
  python3 demo.py
```

## What to check in the dashboard

After ingesting, run against ClickHouse:

```sql
SELECT agent_id, count() AS spans, countIf(status = 'error') AS errors
FROM spans
WHERE org_id = {orgId:String}
  AND trace_id = {traceId:String}
GROUP BY agent_id
ORDER BY spans DESC;
```

Expected result: four rows, one per subagent + orchestrator, each
with the correct span count.

## Implementation notes

Both SDKs expose the same `agent_id` scoping primitive:

- **TypeScript**: `withAgent(tracer, "researcher", () => { ... })`
  around the block that produces researcher spans. Nested
  `withAgent` calls stack; the innermost wins.
- **Python**: `with with_agent(tracer, "researcher"):` same contract.

Explicit over magical: the SDK does **not** attempt to infer subagent
identity from span names, framework callbacks, or role tags. Callers
wrap the spans they want tagged. See RFC-015 for the rationale.

For framework integrations (LangGraph, CrewAI, OpenAI Agents,
Claude Agent SDK, AutoGen), pass the subagent name from the framework's
node/agent identifier into `with_agent(...)`. A follow-up WP will add
framework-aware wrappers that do this automatically for the common
patterns; today the wrapping is explicit.
