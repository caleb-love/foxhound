/**
 * Multi-agent demo (TypeScript) — WP15.
 *
 * Produces one Foxhound trace with eight spans attributed to three
 * subagents plus the orchestrator. Every span carries the correct
 * `agent_id` on the wire so ClickHouse aggregation by `agent_id`
 * produces four distinct series.
 *
 * Prereqs:
 *   - Foxhound API reachable at `FOXHOUND_ENDPOINT` (default
 *     http://localhost:3000)
 *   - A valid API key in `FOXHOUND_API_KEY`
 *
 * Run with `pnpm dlx tsx demo.ts` from this directory.
 */
import { FoxhoundClient, withAgent, startAgentSpan } from "@foxhound-ai/sdk";

async function main(): Promise<void> {
  const endpoint = process.env["FOXHOUND_ENDPOINT"] ?? "http://localhost:3000";
  const apiKey = process.env["FOXHOUND_API_KEY"];
  if (!apiKey) {
    throw new Error("Set FOXHOUND_API_KEY before running this demo.");
  }

  const fox = new FoxhoundClient({ endpoint, apiKey });
  const tracer = fox.startTrace({
    agentId: "orchestrator",
    metadata: { demo: "multi-agent-wp15" },
  });

  // ── Plan ───────────────────────────────────────────────────────────
  // Orchestrator's own planning span. Inherits trace-level agent_id.
  const plan = tracer.startSpan({ name: "plan", kind: "agent_step" });
  plan.setAttribute("task", "solve the user's request");
  plan.end();

  // ── Researcher subagent ────────────────────────────────────────────
  // All spans opened inside withAgent(tracer, "researcher", …) carry
  // agent_id="researcher" on the wire, overriding the trace-level.
  await withAgent(tracer, "researcher", async () => {
    const root = tracer.startSpan({ name: "researcher.search", kind: "agent_step" });
    const web = tracer.startSpan({
      name: "web.search",
      kind: "tool_call",
      parentSpanId: root.spanId,
    });
    web.setAttribute("query", "protobuf wire schemas 2026");
    web.end();
    const docs = tracer.startSpan({
      name: "fetch.docs",
      kind: "tool_call",
      parentSpanId: root.spanId,
    });
    docs.setAttribute("count", 3);
    docs.end();
    root.end();
  });

  // ── Coder subagent ─────────────────────────────────────────────────
  await withAgent(tracer, "coder", async () => {
    const root = tracer.startSpan({ name: "coder.generate", kind: "agent_step" });
    const write = tracer.startSpan({
      name: "tool.write_file",
      kind: "tool_call",
      parentSpanId: root.spanId,
    });
    write.setAttribute("path", "src/new-feature.ts");
    write.end();
    const run = tracer.startSpan({
      name: "tool.run_tests",
      kind: "tool_call",
      parentSpanId: root.spanId,
    });
    run.setAttribute("suite", "unit");
    run.end();
    root.end();
  });

  // ── Evaluator subagent (using the explicit startAgentSpan form) ────
  const gradeSpan = startAgentSpan(tracer, {
    agentId: "evaluator",
    name: "evaluator.grade",
    kind: "agent_step",
  });
  const judge = startAgentSpan(tracer, {
    agentId: "evaluator",
    name: "llm.judge",
    kind: "llm_call",
    parentSpanId: gradeSpan.spanId,
  });
  judge.setAttribute("gen_ai.request.model", "claude-sonnet-4");
  judge.end();
  gradeSpan.end();

  await tracer.flush();
  console.log(`Trace ${tracer.traceId} flushed with four agent_id series.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
