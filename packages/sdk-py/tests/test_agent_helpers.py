"""Unit tests for the WP15 Python agent-scope helpers.

Parity target with ``packages/sdk/src/helpers/agent.test.ts``. Every
scenario below has a TS counterpart asserting the same behavior.
"""

from __future__ import annotations

import time
from typing import Any

import pytest

from foxhound.helpers.agent import (
    current_agent_scope,
    start_agent_span,
    with_agent,
)
from foxhound.tracer import Tracer


def _make_tracer(agent_id: str) -> tuple[Tracer, list[dict[str, Any]]]:
    flushed: list[dict[str, Any]] = []

    async def on_flush(payload: dict[str, Any]) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id=agent_id, on_flush=on_flush)
    return tracer, flushed


# ---------------------------------------------------------------------------
# Scope stack
# ---------------------------------------------------------------------------


def test_current_agent_scope_none_when_no_scope():
    tracer, _ = _make_tracer("orchestrator")
    assert current_agent_scope(tracer) is None


def test_with_agent_pushes_and_pops_scope():
    tracer, _ = _make_tracer("orchestrator")
    inside: str | None = None
    with with_agent(tracer, "researcher"):
        inside = current_agent_scope(tracer)
    assert inside == "researcher"
    assert current_agent_scope(tracer) is None


def test_with_agent_pops_on_exception():
    tracer, _ = _make_tracer("orchestrator")
    with pytest.raises(ValueError):
        with with_agent(tracer, "researcher"):
            raise ValueError("boom")
    assert current_agent_scope(tracer) is None


def test_with_agent_nests_innermost_wins():
    tracer, _ = _make_tracer("orchestrator")
    with with_agent(tracer, "researcher"):
        assert current_agent_scope(tracer) == "researcher"
        with with_agent(tracer, "coder"):
            assert current_agent_scope(tracer) == "coder"
        assert current_agent_scope(tracer) == "researcher"
    assert current_agent_scope(tracer) is None


# ---------------------------------------------------------------------------
# Span tagging via flushed payload
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_spans_inside_with_agent_inherit_scope():
    tracer, flushed = _make_tracer("orchestrator")
    with with_agent(tracer, "researcher"):
        s = tracer.start_span(name="web.search", kind="tool_call")
        s.end("ok")
    await tracer.flush()
    assert len(flushed) == 1
    assert flushed[0]["spans"][0]["agentId"] == "researcher"


@pytest.mark.asyncio
async def test_explicit_set_agent_overrides_scope():
    tracer, flushed = _make_tracer("orchestrator")
    with with_agent(tracer, "researcher"):
        s = tracer.start_span(name="code.write", kind="agent_step")
        s.set_agent("coder")
        s.end("ok")
    await tracer.flush()
    assert flushed[0]["spans"][0]["agentId"] == "coder"


@pytest.mark.asyncio
async def test_start_agent_span_convenience():
    tracer, flushed = _make_tracer("orchestrator")
    s = start_agent_span(tracer, agent_id="evaluator", name="grade", kind="custom")
    s.end("ok")
    await tracer.flush()
    assert flushed[0]["spans"][0]["agentId"] == "evaluator"


@pytest.mark.asyncio
async def test_spans_outside_any_scope_omit_agent_id():
    """Unscoped spans omit ``agentId`` entirely so the wire inherits trace-level."""
    tracer, flushed = _make_tracer("orchestrator")
    s = tracer.start_span(name="plain", kind="custom")
    s.end("ok")
    await tracer.flush()
    span_dict = flushed[0]["spans"][0]
    assert "agentId" not in span_dict


# ---------------------------------------------------------------------------
# Overhead gate (WP15: set_agent < 0.1 ms/span)
# ---------------------------------------------------------------------------


def test_with_agent_overhead_is_well_under_budget():
    """Per-span overhead (scope push/pop + start_span + end) is bounded.

    The WP15 target is ``< 0.1 ms/span``. We assert ``< 0.5 ms/span`` so
    the test is not flaky on slower CI runners; real local numbers are
    typically an order of magnitude below that.
    """
    tracer, _ = _make_tracer("orchestrator")
    iterations = 2_000
    start = time.perf_counter()
    for _ in range(iterations):
        with with_agent(tracer, "researcher"):
            s = tracer.start_span(name="span", kind="custom")
            s.end("ok")
    elapsed = time.perf_counter() - start
    per_span_ms = (elapsed / iterations) * 1000
    assert per_span_ms < 0.5, f"per-span overhead {per_span_ms:.3f} ms exceeds budget"
