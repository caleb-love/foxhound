"""
Unit tests for FoxhoundSpanProcessor — OpenTelemetry bridge integration.

Tests use MagicMock to simulate OTel SDK span objects so the opentelemetry-sdk
package is NOT required to run the test suite (the bridge module itself only
imports OTel types at runtime when the SDK is present).
"""

import logging
import pytest
from unittest.mock import MagicMock, patch

from foxhound.tracer import Tracer
from foxhound.integrations.opentelemetry import (
    FoxhoundSpanProcessor,
    _truncate,
    _otel_status,
)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_processor() -> tuple[FoxhoundSpanProcessor, list[dict]]:
    """Return (FoxhoundSpanProcessor, captured_payloads)."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-otel-agent", on_flush=capture)
    return FoxhoundSpanProcessor(tracer), flushed


def _make_span_ctx(span_id: int = 1, trace_id: int = 42) -> MagicMock:
    """Create a mock OTel SpanContext."""
    ctx = MagicMock()
    ctx.span_id = span_id
    ctx.trace_id = trace_id
    return ctx


def _make_otel_span(
    name: str,
    span_id: int = 1,
    trace_id: int = 42,
    attributes: dict | None = None,
    parent_span_id: int | None = None,
    status_code_name: str = "OK",
) -> MagicMock:
    """Create a mock OTel ReadableSpan."""
    span = MagicMock()
    span.name = name
    span.attributes = attributes or {}

    ctx = _make_span_ctx(span_id, trace_id)
    span.get_span_context.return_value = ctx

    # Parent span context
    if parent_span_id is not None:
        parent_ctx = MagicMock()
        parent_ctx.span_id = parent_span_id
        span.parent = parent_ctx
    else:
        span.parent = None

    # OTel status
    status = MagicMock()
    status_code = MagicMock()
    status_code.name = status_code_name
    status.status_code = status_code
    span.status = status

    return span


def _spans_by_name(flushed: list[dict]) -> dict[str, dict]:
    """Index the first flushed trace's spans by name."""
    return {s["name"]: s for s in flushed[0]["spans"]}


def _fire_span(
    processor: FoxhoundSpanProcessor,
    span: MagicMock,
    parent_ctx: MagicMock = None,
) -> None:
    """Simulate a complete span lifecycle: on_start then on_end."""
    processor.on_start(span, parent_ctx)
    processor.on_end(span)


# ---------------------------------------------------------------------------
# _truncate helper
# ---------------------------------------------------------------------------


def test_truncate_short_string():
    assert _truncate("hello", 10) == "hello"


def test_truncate_exact_length():
    assert _truncate("hello", 5) == "hello"


def test_truncate_long_string():
    result = _truncate("x" * 600, 512)
    assert len(result) == 512


def test_truncate_empty_string():
    assert _truncate("", 512) == ""


# ---------------------------------------------------------------------------
# _otel_status helper
# ---------------------------------------------------------------------------


def test_otel_status_ok():
    span = _make_otel_span("test", status_code_name="OK")
    assert _otel_status(span) == "ok"


def test_otel_status_error():
    span = _make_otel_span("test", status_code_name="ERROR")
    assert _otel_status(span) == "error"


def test_otel_status_unset():
    span = _make_otel_span("test", status_code_name="UNSET")
    assert _otel_status(span) == "ok"


def test_otel_status_no_status_attr():
    span = MagicMock()
    del span.status
    span.status = None
    assert _otel_status(span) == "ok"


def test_otel_status_no_status_code():
    span = MagicMock()
    span.status = MagicMock()
    span.status.status_code = None
    assert _otel_status(span) == "ok"


# ---------------------------------------------------------------------------
# _semantic_to_fox_kind mapping
# ---------------------------------------------------------------------------


def test_kind_chat_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("my-llm", attributes={"gen_ai.operation.name": "chat"})
    assert proc._semantic_to_fox_kind(span) == "llm_call"


def test_kind_text_completion_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("completion", attributes={"gen_ai.operation.name": "text_completion"})
    assert proc._semantic_to_fox_kind(span) == "llm_call"


def test_kind_embeddings_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("embed", attributes={"gen_ai.operation.name": "embeddings"})
    assert proc._semantic_to_fox_kind(span) == "tool_call"


def test_kind_agent_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("agent-run", attributes={"gen_ai.operation.name": "agent"})
    assert proc._semantic_to_fox_kind(span) == "agent_step"


def test_kind_invoke_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("agent-invoke", attributes={"gen_ai.operation.name": "invoke"})
    assert proc._semantic_to_fox_kind(span) == "agent_step"


def test_kind_tool_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("tool-run", attributes={"gen_ai.operation.name": "tool"})
    assert proc._semantic_to_fox_kind(span) == "tool_call"


def test_kind_execute_operation():
    proc, _ = _make_processor()
    span = _make_otel_span("exec", attributes={"gen_ai.operation.name": "execute"})
    assert proc._semantic_to_fox_kind(span) == "tool_call"


def test_kind_unknown_operation_defaults_to_workflow():
    proc, _ = _make_processor()
    span = _make_otel_span("mystery", attributes={"gen_ai.operation.name": "some_unknown_op"})
    assert proc._semantic_to_fox_kind(span) == "workflow"


def test_kind_missing_operation_defaults_to_workflow():
    proc, _ = _make_processor()
    span = _make_otel_span("plain-span", attributes={})
    assert proc._semantic_to_fox_kind(span) == "workflow"


def test_kind_agent_name_prefix_heuristic():
    """Span name starting with 'agent' maps to agent_step without explicit operation."""
    proc, _ = _make_processor()
    span = _make_otel_span("agent:my-agent", attributes={})
    assert proc._semantic_to_fox_kind(span) == "agent_step"


def test_kind_tool_name_prefix_heuristic():
    """Span name starting with 'tool' maps to tool_call without explicit operation."""
    proc, _ = _make_processor()
    span = _make_otel_span("tool:web_search", attributes={})
    assert proc._semantic_to_fox_kind(span) == "tool_call"


def test_kind_operation_takes_precedence_over_name_heuristic():
    """gen_ai.operation.name overrides name-based heuristics."""
    proc, _ = _make_processor()
    # Name says agent but operation says embeddings → tool_call
    span = _make_otel_span(
        "agent-embedding",
        attributes={"gen_ai.operation.name": "embeddings"},
    )
    assert proc._semantic_to_fox_kind(span) == "tool_call"


# ---------------------------------------------------------------------------
# _extract_attributes
# ---------------------------------------------------------------------------


def test_extract_model():
    proc, _ = _make_processor()
    span = _make_otel_span("llm", attributes={"gen_ai.request.model": "gpt-4o"})
    attrs = proc._extract_attributes(span)
    assert attrs["llm.model"] == "gpt-4o"


def test_extract_input_tokens():
    proc, _ = _make_processor()
    span = _make_otel_span("llm", attributes={"gen_ai.usage.input_tokens": 100})
    attrs = proc._extract_attributes(span)
    assert attrs["llm.prompt_tokens"] == 100


def test_extract_output_tokens():
    proc, _ = _make_processor()
    span = _make_otel_span("llm", attributes={"gen_ai.usage.output_tokens": 50})
    attrs = proc._extract_attributes(span)
    assert attrs["llm.completion_tokens"] == 50


def test_extract_total_tokens():
    proc, _ = _make_processor()
    span = _make_otel_span("llm", attributes={"gen_ai.usage.total_tokens": 150})
    attrs = proc._extract_attributes(span)
    assert attrs["llm.total_tokens"] == 150


def test_extract_prompt_truncated():
    proc, _ = _make_processor()
    long_prompt = "A" * 600
    span = _make_otel_span("llm", attributes={"gen_ai.prompt": long_prompt})
    attrs = proc._extract_attributes(span)
    assert "agent.prompt" in attrs
    assert len(attrs["agent.prompt"]) == 512


def test_extract_prompt_short_not_truncated():
    proc, _ = _make_processor()
    span = _make_otel_span("llm", attributes={"gen_ai.prompt": "hello"})
    attrs = proc._extract_attributes(span)
    assert attrs["agent.prompt"] == "hello"


def test_extract_all_attributes_together():
    proc, _ = _make_processor()
    span = _make_otel_span(
        "llm",
        attributes={
            "gen_ai.request.model": "claude-3-5-sonnet",
            "gen_ai.usage.input_tokens": 200,
            "gen_ai.usage.output_tokens": 75,
            "gen_ai.usage.total_tokens": 275,
            "gen_ai.prompt": "What is 2+2?",
        },
    )
    attrs = proc._extract_attributes(span)
    assert attrs["llm.model"] == "claude-3-5-sonnet"
    assert attrs["llm.prompt_tokens"] == 200
    assert attrs["llm.completion_tokens"] == 75
    assert attrs["llm.total_tokens"] == 275
    assert attrs["agent.prompt"] == "What is 2+2?"


def test_extract_empty_attributes():
    proc, _ = _make_processor()
    span = _make_otel_span("plain", attributes={})
    attrs = proc._extract_attributes(span)
    assert attrs == {}


def test_extract_unknown_attributes_ignored():
    proc, _ = _make_processor()
    span = _make_otel_span("llm", attributes={"unrelated.attr": "value"})
    attrs = proc._extract_attributes(span)
    assert attrs == {}


# ---------------------------------------------------------------------------
# on_start + on_end round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_on_start_end_produces_fox_span():
    """on_start + on_end produce a completed Fox span with correct kind."""
    proc, flushed = _make_processor()
    span = _make_otel_span(
        "llm:gpt-4o",
        span_id=1,
        attributes={"gen_ai.operation.name": "chat", "gen_ai.request.model": "gpt-4o"},
    )
    _fire_span(proc, span)
    await proc.flush()

    assert len(flushed) == 1
    spans = _spans_by_name(flushed)
    assert "llm:gpt-4o" in spans
    fox = spans["llm:gpt-4o"]
    assert fox["kind"] == "llm_call"
    assert fox["status"] == "ok"
    assert fox["attributes"]["llm.model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_on_start_end_stores_token_counts():
    """Token counts from OTel attributes are stored on the Fox span."""
    proc, flushed = _make_processor()
    span = _make_otel_span(
        "llm-span",
        span_id=2,
        attributes={
            "gen_ai.operation.name": "chat",
            "gen_ai.usage.input_tokens": 50,
            "gen_ai.usage.output_tokens": 20,
            "gen_ai.usage.total_tokens": 70,
        },
    )
    _fire_span(proc, span)
    await proc.flush()

    spans = _spans_by_name(flushed)
    attrs = spans["llm-span"]["attributes"]
    assert attrs["llm.prompt_tokens"] == 50
    assert attrs["llm.completion_tokens"] == 20
    assert attrs["llm.total_tokens"] == 70


# ---------------------------------------------------------------------------
# Error status propagation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_error_status_propagated():
    """OTel StatusCode.ERROR maps to Fox 'error' status."""
    proc, flushed = _make_processor()
    span = _make_otel_span("failing-llm", span_id=1, status_code_name="ERROR")
    _fire_span(proc, span)
    await proc.flush()

    spans = _spans_by_name(flushed)
    assert spans["failing-llm"]["status"] == "error"


@pytest.mark.asyncio
async def test_ok_status_propagated():
    """OTel StatusCode.OK maps to Fox 'ok' status."""
    proc, flushed = _make_processor()
    span = _make_otel_span("good-llm", span_id=1, status_code_name="OK")
    _fire_span(proc, span)
    await proc.flush()

    spans = _spans_by_name(flushed)
    assert spans["good-llm"]["status"] == "ok"


# ---------------------------------------------------------------------------
# Parent-child span propagation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_parent_span_id_propagated():
    """Nested OTel spans map to Fox parent-child relationship."""
    proc, flushed = _make_processor()

    # Parent: workflow span
    parent_span = _make_otel_span(
        "agent:my-agent",
        span_id=10,
        attributes={"gen_ai.operation.name": "agent"},
    )
    # Child: llm call
    child_span = _make_otel_span(
        "llm:gpt-4o",
        span_id=20,
        attributes={"gen_ai.operation.name": "chat"},
        parent_span_id=10,
    )

    proc.on_start(parent_span)
    proc.on_start(child_span)
    proc.on_end(child_span)
    proc.on_end(parent_span)
    await proc.flush()

    spans = _spans_by_name(flushed)
    parent_fox_id = spans["agent:my-agent"]["spanId"]
    child = spans["llm:gpt-4o"]
    assert child["parentSpanId"] == parent_fox_id


@pytest.mark.asyncio
async def test_root_span_has_no_parent():
    """OTel root span (no parent) produces a Fox span with no parentSpanId."""
    proc, flushed = _make_processor()
    span = _make_otel_span("workflow:root", span_id=1)
    _fire_span(proc, span)
    await proc.flush()

    spans = _spans_by_name(flushed)
    assert "parentSpanId" not in spans["workflow:root"]


@pytest.mark.asyncio
async def test_three_level_nesting():
    """agent → llm → tool nesting is preserved through three levels."""
    proc, flushed = _make_processor()

    agent = _make_otel_span(
        "agent:orchestrator",
        span_id=1,
        attributes={"gen_ai.operation.name": "agent"},
    )
    llm = _make_otel_span(
        "llm:gpt-4o",
        span_id=2,
        attributes={"gen_ai.operation.name": "chat"},
        parent_span_id=1,
    )
    tool = _make_otel_span(
        "tool:web_search",
        span_id=3,
        attributes={"gen_ai.operation.name": "tool"},
        parent_span_id=2,
    )

    proc.on_start(agent)
    proc.on_start(llm)
    proc.on_start(tool)
    proc.on_end(tool)
    proc.on_end(llm)
    proc.on_end(agent)
    await proc.flush()

    spans = _spans_by_name(flushed)
    agent_id = spans["agent:orchestrator"]["spanId"]
    llm_id = spans["llm:gpt-4o"]["spanId"]
    tool_id = spans["tool:web_search"]["spanId"]

    assert spans["llm:gpt-4o"]["parentSpanId"] == agent_id
    assert spans["tool:web_search"]["parentSpanId"] == llm_id
    # Sanity check: each span has a unique Fox ID
    assert agent_id != llm_id != tool_id


# ---------------------------------------------------------------------------
# Malformed spans — missing trace_id
# ---------------------------------------------------------------------------


def test_on_start_missing_trace_id_logs_warning(caplog):
    """Spans with missing trace_id are skipped with a WARNING log."""
    proc, _ = _make_processor()
    span = MagicMock()
    span.name = "bad-span"
    ctx = MagicMock()
    ctx.trace_id = 0  # falsy → treated as missing
    span.get_span_context.return_value = ctx

    with caplog.at_level(logging.WARNING, logger="foxhound.integrations.opentelemetry"):
        proc.on_start(span)

    assert "bad-span" in caplog.text or "no trace_id" in caplog.text


def test_on_start_null_context_skipped():
    """Spans whose get_span_context() returns None are silently skipped."""
    proc, _ = _make_processor()
    span = MagicMock()
    span.name = "null-ctx"
    span.get_span_context.return_value = None
    # Should not raise
    proc.on_start(span)
    assert len(proc._span_map) == 0


def test_on_end_null_context_is_noop():
    """on_end for a span whose context is None does not raise."""
    proc, _ = _make_processor()
    span = MagicMock()
    span.get_span_context.return_value = None
    proc.on_end(span)  # Should not raise


def test_on_end_unknown_span_id_is_noop():
    """on_end for a span that was never started is silently ignored."""
    proc, _ = _make_processor()
    span = _make_otel_span("never-started", span_id=999)
    proc.on_end(span)  # Should not raise


# ---------------------------------------------------------------------------
# on_start exception swallowed
# ---------------------------------------------------------------------------


def test_on_start_exception_swallowed(caplog):
    """Exceptions inside on_start are caught and logged, not raised."""
    proc, _ = _make_processor()
    bad_span = MagicMock()
    bad_span.name = "exploding-span"
    bad_span.get_span_context.side_effect = RuntimeError("boom")

    with caplog.at_level(logging.ERROR, logger="foxhound.integrations.opentelemetry"):
        proc.on_start(bad_span)  # Should not raise

    assert "exploding-span" in caplog.text or "error in on_start" in caplog.text


def test_on_end_exception_swallowed(caplog):
    """Exceptions inside on_end are caught and logged, not raised."""
    proc, _ = _make_processor()
    bad_span = MagicMock()
    bad_span.name = "exploding-end"
    bad_span.get_span_context.side_effect = RuntimeError("boom")

    with caplog.at_level(logging.ERROR, logger="foxhound.integrations.opentelemetry"):
        proc.on_end(bad_span)  # Should not raise

    assert "exploding-end" in caplog.text or "error in on_end" in caplog.text


# ---------------------------------------------------------------------------
# shutdown() and force_flush() call through to tracer
# ---------------------------------------------------------------------------


def test_shutdown_calls_flush_sync():
    """shutdown() delegates to tracer.flush_sync()."""
    proc, _ = _make_processor()
    proc._tracer.flush_sync = MagicMock()
    proc.shutdown()
    proc._tracer.flush_sync.assert_called_once()


def test_force_flush_calls_flush_sync():
    """force_flush() delegates to tracer.flush_sync() and returns True."""
    proc, _ = _make_processor()
    proc._tracer.flush_sync = MagicMock()
    result = proc.force_flush()
    proc._tracer.flush_sync.assert_called_once()
    assert result is True


# ---------------------------------------------------------------------------
# from_client factory
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_from_client_creates_working_processor():
    """FoxhoundSpanProcessor.from_client() creates a functional processor."""
    import respx
    import httpx
    from foxhound.client import FoxhoundClient

    with respx.mock:
        respx.post("https://api.fox.ai/v1/traces").mock(return_value=httpx.Response(202))
        fox = FoxhoundClient(api_key="fox_test", endpoint="https://api.fox.ai")
        proc = FoxhoundSpanProcessor.from_client(fox, agent_id="test-agent")
        assert proc.trace_id
        assert isinstance(proc.trace_id, str)

        span = _make_otel_span(
            "llm:gpt-4o",
            span_id=1,
            attributes={"gen_ai.operation.name": "chat"},
        )
        _fire_span(proc, span)
        await proc.flush()


# ---------------------------------------------------------------------------
# DEBUG logging of span mapping decisions
# ---------------------------------------------------------------------------


def test_on_start_debug_logged(caplog):
    """on_start logs span mapping decisions at DEBUG level."""
    proc, _ = _make_processor()
    span = _make_otel_span(
        "llm:claude",
        span_id=5,
        attributes={"gen_ai.operation.name": "chat"},
    )
    with caplog.at_level(logging.DEBUG, logger="foxhound.integrations.opentelemetry"):
        proc.on_start(span)

    # At least one DEBUG record should mention the span name or kind
    assert any("llm:claude" in r.message or "llm_call" in r.message for r in caplog.records)


def test_on_end_debug_logged(caplog):
    """on_end logs span name and status at DEBUG level."""
    proc, _ = _make_processor()
    span = _make_otel_span("tool:search", span_id=6, attributes={})

    proc.on_start(span)
    with caplog.at_level(logging.DEBUG, logger="foxhound.integrations.opentelemetry"):
        proc.on_end(span)

    assert any("tool:search" in r.message or "ok" in r.message for r in caplog.records)


# ---------------------------------------------------------------------------
# Prompt truncation at exactly 512 chars
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prompt_truncated_at_512_chars():
    """gen_ai.prompt attribute is stored truncated to 512 chars on the Fox span."""
    proc, flushed = _make_processor()
    long_prompt = "P" * 1000
    span = _make_otel_span(
        "llm-with-prompt",
        span_id=1,
        attributes={
            "gen_ai.operation.name": "chat",
            "gen_ai.prompt": long_prompt,
        },
    )
    _fire_span(proc, span)
    await proc.flush()

    spans = _spans_by_name(flushed)
    stored = spans["llm-with-prompt"]["attributes"]["agent.prompt"]
    assert len(stored) == 512
    assert stored == "P" * 512


# ---------------------------------------------------------------------------
# trace_id property
# ---------------------------------------------------------------------------


def test_trace_id_is_non_empty_string():
    proc, _ = _make_processor()
    assert isinstance(proc.trace_id, str)
    assert proc.trace_id


# ---------------------------------------------------------------------------
# configure_adot_for_foxhound — ImportError path
# ---------------------------------------------------------------------------


def test_configure_adot_raises_without_otel_sdk(monkeypatch):
    """configure_adot_for_foxhound raises ImportError when OTel SDK is absent."""
    import sys
    from foxhound.integrations.opentelemetry import configure_adot_for_foxhound

    # Temporarily hide the opentelemetry packages
    otel_modules = {k: v for k, v in sys.modules.items() if k.startswith("opentelemetry")}
    for mod in otel_modules:
        monkeypatch.delitem(sys.modules, mod, raising=False)
    monkeypatch.setitem(sys.modules, "opentelemetry", None)
    monkeypatch.setitem(sys.modules, "opentelemetry.sdk", None)
    monkeypatch.setitem(sys.modules, "opentelemetry.sdk.trace", None)

    with pytest.raises((ImportError, AttributeError)):
        configure_adot_for_foxhound(
            agent_id="test",
            foxhound_endpoint="https://example.com",
            api_key="fox_test",
        )
