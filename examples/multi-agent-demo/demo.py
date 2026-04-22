"""Multi-agent demo (Python) — WP15.

Produces one Foxhound trace with eight spans attributed to three
subagents plus the orchestrator. Every span carries the correct
``agent_id`` on the wire so ClickHouse aggregation by ``agent_id``
produces four distinct series.

Prereqs:
  * Foxhound API reachable at ``FOXHOUND_ENDPOINT`` (default
    http://localhost:3000)
  * A valid API key in ``FOXHOUND_API_KEY``

Run with ``python3 demo.py`` from this directory.
"""

from __future__ import annotations

import asyncio
import os
import sys

from foxhound import FoxhoundClient
from foxhound.helpers import with_agent, start_agent_span


async def main() -> None:
    endpoint = os.environ.get("FOXHOUND_ENDPOINT", "http://localhost:3000")
    api_key = os.environ.get("FOXHOUND_API_KEY")
    if not api_key:
        raise SystemExit("Set FOXHOUND_API_KEY before running this demo.")

    fox = FoxhoundClient(endpoint=endpoint, api_key=api_key)
    tracer = fox.start_trace(
        agent_id="orchestrator",
        metadata={"demo": "multi-agent-wp15"},
    )

    # ── Plan (orchestrator) ───────────────────────────────────────────
    plan = tracer.start_span(name="plan", kind="agent_step")
    plan.set_attribute("task", "solve the user's request")
    plan.end("ok")

    # ── Researcher subagent ──────────────────────────────────────────
    with with_agent(tracer, "researcher"):
        root = tracer.start_span(name="researcher.search", kind="agent_step")
        web = tracer.start_span(
            name="web.search",
            kind="tool_call",
            parent_span_id=root.span_id,
        )
        web.set_attribute("query", "protobuf wire schemas 2026")
        web.end("ok")
        docs = tracer.start_span(
            name="fetch.docs",
            kind="tool_call",
            parent_span_id=root.span_id,
        )
        docs.set_attribute("count", 3)
        docs.end("ok")
        root.end("ok")

    # ── Coder subagent ───────────────────────────────────────────────
    with with_agent(tracer, "coder"):
        root = tracer.start_span(name="coder.generate", kind="agent_step")
        write = tracer.start_span(
            name="tool.write_file",
            kind="tool_call",
            parent_span_id=root.span_id,
        )
        write.set_attribute("path", "src/new_feature.py")
        write.end("ok")
        run = tracer.start_span(
            name="tool.run_tests",
            kind="tool_call",
            parent_span_id=root.span_id,
        )
        run.set_attribute("suite", "unit")
        run.end("ok")
        root.end("ok")

    # ── Evaluator subagent (explicit start_agent_span form) ──────────
    grade_span = start_agent_span(
        tracer,
        agent_id="evaluator",
        name="evaluator.grade",
        kind="agent_step",
    )
    judge = start_agent_span(
        tracer,
        agent_id="evaluator",
        name="llm.judge",
        kind="llm_call",
        parent_span_id=grade_span.span_id,
    )
    judge.set_attribute("gen_ai.request.model", "claude-sonnet-4")
    judge.end("ok")
    grade_span.end("ok")

    await tracer.flush()
    print(f"Trace {tracer.trace_id} flushed with four agent_id series.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
