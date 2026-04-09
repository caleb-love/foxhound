"""Unit tests for the core Tracer / ActiveSpan primitives."""

import pytest
from foxhound.tracer import Tracer


@pytest.mark.asyncio
async def test_trace_round_trip():
    """A complete trace with one span serializes to a valid payload."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-agent", on_flush=capture)
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "hello")
    span.add_event("cache_miss")
    span.end("ok")

    await tracer.flush()

    assert len(flushed) == 1
    payload = flushed[0]

    assert payload["agentId"] == "test-agent"
    assert payload["id"] == tracer.trace_id
    assert len(payload["spans"]) == 1

    s = payload["spans"][0]
    assert s["name"] == "tool:search"
    assert s["kind"] == "tool_call"
    assert s["status"] == "ok"
    assert s["attributes"]["query"] == "hello"
    assert s["events"][0]["name"] == "cache_miss"
    assert "endTimeMs" in s


@pytest.mark.asyncio
async def test_nested_spans():
    """Parent/child span IDs are wired correctly."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="a", on_flush=capture)
    root = tracer.start_span(name="root", kind="workflow")
    child = tracer.start_span(name="child", kind="agent_step", parent_span_id=root.span_id)
    child.end()
    root.end()

    await tracer.flush()

    spans = {s["spanId"]: s for s in flushed[0]["spans"]}
    assert spans[child.span_id]["parentSpanId"] == root.span_id
    assert "parentSpanId" not in spans[root.span_id]


@pytest.mark.asyncio
async def test_error_span():
    """Ending a span with 'error' status is reflected in the payload."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="a", on_flush=capture)
    span = tracer.start_span(name="llm:gpt-4o", kind="llm_call")
    span.add_event("error", {"message": "context window exceeded"})
    span.end("error")

    await tracer.flush()

    s = flushed[0]["spans"][0]
    assert s["status"] == "error"
    assert s["events"][0]["name"] == "error"
