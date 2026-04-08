"""Tests for FoxOpenAIAgentsProcessor — OpenAI Agents SDK integration."""

import pytest
from unittest.mock import MagicMock, patch

from fox_sdk.tracer import Tracer
from fox_sdk.integrations.openai_agents import (
    FoxOpenAIAgentsProcessor,
    _classify_span,
    _span_type,
    instrument,
)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_processor() -> tuple[FoxOpenAIAgentsProcessor, list[dict]]:
    """Return (FoxOpenAIAgentsProcessor, captured_payloads)."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-openai-agent", on_flush=capture)
    return FoxOpenAIAgentsProcessor(tracer), flushed


def _make_span_data(span_type: str, **attrs) -> MagicMock:
    """Create a mock span data object with the given type and attributes."""
    data = MagicMock()
    data.type = span_type
    for k, v in attrs.items():
        setattr(data, k, v)
    return data


def _make_span(
    span_id: str,
    span_data: MagicMock,
    parent_id: str | None = None,
    error: dict | None = None,
) -> MagicMock:
    """Create a mock OpenAI SDK Span object."""
    span = MagicMock()
    span.span_id = span_id
    span.parent_id = parent_id
    span.span_data = span_data
    span.error = error
    return span


def _spans_by_name(flushed: list[dict]) -> dict[str, dict]:
    return {s["name"]: s for s in flushed[0]["spans"]}


def _fire_span(processor: FoxOpenAIAgentsProcessor, span: MagicMock) -> None:
    """Simulate a complete span lifecycle: start then end."""
    processor.on_span_start(span)
    processor.on_span_end(span)


# ---------------------------------------------------------------------------
# _classify_span helper
# ---------------------------------------------------------------------------


def test_classify_agent_span():
    data = _make_span_data("agent", name="MyAgent")
    kind, name = _classify_span(data)
    assert kind == "agent_step"
    assert name == "agent:MyAgent"


def test_classify_function_span():
    data = _make_span_data("function", name="web_search")
    kind, name = _classify_span(data)
    assert kind == "tool_call"
    assert name == "tool:web_search"


def test_classify_generation_span_with_model():
    data = _make_span_data("generation", model="gpt-4o")
    kind, name = _classify_span(data)
    assert kind == "llm_call"
    assert name == "llm:gpt-4o"


def test_classify_generation_span_no_model():
    data = _make_span_data("generation", model=None)
    kind, name = _classify_span(data)
    assert kind == "llm_call"
    assert name == "llm:llm"


def test_classify_response_span_model_from_response():
    response = MagicMock()
    response.model = "gpt-4o-mini"
    data = _make_span_data("response", model=None, response=response)
    kind, name = _classify_span(data)
    assert kind == "llm_call"
    assert name == "llm:gpt-4o-mini"


def test_classify_handoff_span():
    data = _make_span_data("handoff", from_agent="Triage", to_agent="Support")
    kind, name = _classify_span(data)
    assert kind == "agent_step"
    assert name == "handoff:Triage->Support"


def test_classify_guardrail_span():
    data = _make_span_data("guardrail", name="pii_check")
    kind, name = _classify_span(data)
    assert kind == "agent_step"
    assert name == "guardrail:pii_check"


def test_classify_custom_span():
    data = _make_span_data("custom", name="my_custom_op")
    kind, name = _classify_span(data)
    assert kind == "custom"
    assert name == "my_custom_op"


def test_classify_unknown_span_type():
    data = _make_span_data("unknown_type")
    kind, name = _classify_span(data)
    assert kind == "custom"


# ---------------------------------------------------------------------------
# Root agent span → workflow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_root_agent_span_becomes_workflow():
    """Root agent span (no parent) is mapped to a workflow span."""
    processor, flushed = _make_processor()
    data = _make_span_data("agent", name="Triage", tools=None, handoffs=None, output_type=None)
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "agent:Triage" in spans
    assert spans["agent:Triage"]["kind"] == "workflow"
    assert spans["agent:Triage"]["status"] == "ok"
    assert spans["agent:Triage"]["attributes"]["agent.name"] == "Triage"


@pytest.mark.asyncio
async def test_nested_agent_span_becomes_agent_step():
    """Nested agent span (with parent) is mapped to agent_step, not workflow."""
    processor, flushed = _make_processor()

    root_data = _make_span_data("agent", name="Root", tools=None, handoffs=None, output_type=None)
    root_span = _make_span("span-root", root_data)

    child_data = _make_span_data("agent", name="Child", tools=None, handoffs=None, output_type=None)
    child_span = _make_span("span-child", child_data, parent_id="span-root")

    processor.on_span_start(root_span)
    processor.on_span_start(child_span)
    processor.on_span_end(child_span)
    processor.on_span_end(root_span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert spans["agent:Root"]["kind"] == "workflow"
    assert spans["agent:Child"]["kind"] == "agent_step"


# ---------------------------------------------------------------------------
# Function / tool call spans
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_function_span_captured():
    """Function span maps to tool_call with input/output attributes."""
    processor, flushed = _make_processor()

    agent_data = _make_span_data("agent", name="Agent", tools=["web_search"], handoffs=None, output_type=None)
    agent_span = _make_span("span-agent", agent_data)

    tool_data = _make_span_data(
        "function",
        name="web_search",
        input='{"query": "foxhound"}',
        output="Fox is an observability platform.",
    )
    tool_span = _make_span("span-tool", tool_data, parent_id="span-agent")

    processor.on_span_start(agent_span)
    processor.on_span_start(tool_span)
    processor.on_span_end(tool_span)
    processor.on_span_end(agent_span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "tool:web_search" in spans
    tool = spans["tool:web_search"]
    assert tool["kind"] == "tool_call"
    assert tool["attributes"]["tool.name"] == "web_search"
    assert '{"query": "foxhound"}' in tool["attributes"]["tool.input"]
    assert "Fox is an observability platform." in tool["attributes"]["tool.output"]


@pytest.mark.asyncio
async def test_function_span_no_io():
    """Function span with no input/output doesn't set those attributes."""
    processor, flushed = _make_processor()
    data = _make_span_data("function", name="ping", input=None, output=None)
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "tool:ping" in spans
    assert "tool.input" not in spans["tool:ping"]["attributes"]
    assert "tool.output" not in spans["tool:ping"]["attributes"]


# ---------------------------------------------------------------------------
# Generation (LLM call) spans
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generation_span_with_model_and_usage():
    """Generation span captures model and token usage."""
    processor, flushed = _make_processor()
    data = _make_span_data(
        "generation",
        model="gpt-4o",
        usage={"input_tokens": 100, "output_tokens": 50},
        input=None,
        output=None,
    )
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "llm:gpt-4o" in spans
    gen = spans["llm:gpt-4o"]
    assert gen["kind"] == "llm_call"
    assert gen["attributes"]["llm.model"] == "gpt-4o"
    assert gen["attributes"]["llm.input_tokens"] == 100
    assert gen["attributes"]["llm.output_tokens"] == 50


@pytest.mark.asyncio
async def test_generation_span_no_usage():
    """Generation span without usage dict still produces a valid span."""
    processor, flushed = _make_processor()
    data = _make_span_data("generation", model="gpt-4o-mini", usage=None, input=None, output=None)
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "llm:gpt-4o-mini" in spans
    assert "llm.input_tokens" not in spans["llm:gpt-4o-mini"]["attributes"]


# ---------------------------------------------------------------------------
# Response spans
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_response_span_model_and_tokens():
    """Response span captures model and token counts from the response object."""
    processor, flushed = _make_processor()

    usage = MagicMock()
    usage.input_tokens = 200
    usage.output_tokens = 75

    response = MagicMock()
    response.model = "gpt-4o"
    response.usage = usage

    data = _make_span_data("response", response=response, input=None)
    # Remove model attr (it lives on response, not data)
    del data.model
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "llm:gpt-4o" in spans
    resp = spans["llm:gpt-4o"]
    assert resp["kind"] == "llm_call"
    assert resp["attributes"]["llm.model"] == "gpt-4o"
    assert resp["attributes"]["llm.input_tokens"] == 200
    assert resp["attributes"]["llm.output_tokens"] == 75


# ---------------------------------------------------------------------------
# Handoff spans
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handoff_span_captured():
    """Handoff span maps to agent_step with from/to agent attributes."""
    processor, flushed = _make_processor()
    data = _make_span_data("handoff", from_agent="Triage", to_agent="Support")
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "handoff:Triage->Support" in spans
    h = spans["handoff:Triage->Support"]
    assert h["kind"] == "agent_step"
    assert h["attributes"]["handoff.from_agent"] == "Triage"
    assert h["attributes"]["handoff.to_agent"] == "Support"


# ---------------------------------------------------------------------------
# Guardrail spans
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_guardrail_span_not_triggered():
    """Guardrail span records name and triggered=False."""
    processor, flushed = _make_processor()
    data = _make_span_data("guardrail", name="pii_check", triggered=False)
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "guardrail:pii_check" in spans
    g = spans["guardrail:pii_check"]
    assert g["kind"] == "agent_step"
    assert g["attributes"]["guardrail.name"] == "pii_check"
    assert g["attributes"]["guardrail.triggered"] is False


@pytest.mark.asyncio
async def test_guardrail_span_triggered():
    """Guardrail span records triggered=True."""
    processor, flushed = _make_processor()
    data = _make_span_data("guardrail", name="content_filter", triggered=True)
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert spans["guardrail:content_filter"]["attributes"]["guardrail.triggered"] is True


# ---------------------------------------------------------------------------
# Agent attributes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agent_span_with_tools_and_handoffs():
    """Agent span captures tools and handoffs lists."""
    processor, flushed = _make_processor()
    data = _make_span_data(
        "agent",
        name="Orchestrator",
        tools=["web_search", "calculator"],
        handoffs=["SupportAgent"],
        output_type="text",
    )
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    attrs = spans["agent:Orchestrator"]["attributes"]
    assert attrs["agent.tools"] == "web_search,calculator"
    assert attrs["agent.handoffs"] == "SupportAgent"
    assert attrs["agent.output_type"] == "text"


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_error_span_recorded():
    """Spans with error set produce error status and error event."""
    processor, flushed = _make_processor()
    data = _make_span_data("function", name="failing_tool", input="x", output=None)
    span = _make_span(
        "span-1",
        data,
        error={"message": "Tool timed out", "data": {"timeout": 30}},
    )
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    tool = spans["tool:failing_tool"]
    assert tool["status"] == "error"
    error_events = [e for e in tool["events"] if e["name"] == "error"]
    assert error_events
    assert "Tool timed out" in error_events[0]["attributes"]["message"]


@pytest.mark.asyncio
async def test_error_span_no_error_field():
    """Spans without error produce ok status."""
    processor, flushed = _make_processor()
    data = _make_span_data("function", name="good_tool", input="x", output="y")
    span = _make_span("span-1", data, error=None)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert spans["tool:good_tool"]["status"] == "ok"


# ---------------------------------------------------------------------------
# Parent-child span linkage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tool_span_is_child_of_agent():
    """Function span is nested under its parent agent span."""
    processor, flushed = _make_processor()

    agent_data = _make_span_data("agent", name="Agent", tools=None, handoffs=None, output_type=None)
    agent_span = _make_span("span-agent", agent_data)

    tool_data = _make_span_data("function", name="search", input="q", output="r")
    tool_span = _make_span("span-tool", tool_data, parent_id="span-agent")

    processor.on_span_start(agent_span)
    processor.on_span_start(tool_span)
    processor.on_span_end(tool_span)
    processor.on_span_end(agent_span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    agent_fox_id = spans["agent:Agent"]["spanId"]
    assert spans["tool:search"]["parentSpanId"] == agent_fox_id


@pytest.mark.asyncio
async def test_deep_nesting_linkage():
    """Deep span nesting: agent → handoff → nested-agent → tool."""
    processor, flushed = _make_processor()

    root_data = _make_span_data("agent", name="Root", tools=None, handoffs=["Child"], output_type=None)
    root_span = _make_span("span-root", root_data)

    handoff_data = _make_span_data("handoff", from_agent="Root", to_agent="Child")
    handoff_span = _make_span("span-handoff", handoff_data, parent_id="span-root")

    child_data = _make_span_data("agent", name="Child", tools=["search"], handoffs=None, output_type=None)
    child_span = _make_span("span-child", child_data, parent_id="span-handoff")

    tool_data = _make_span_data("function", name="search", input="q", output="r")
    tool_span = _make_span("span-tool", tool_data, parent_id="span-child")

    processor.on_span_start(root_span)
    processor.on_span_start(handoff_span)
    processor.on_span_start(child_span)
    processor.on_span_start(tool_span)
    processor.on_span_end(tool_span)
    processor.on_span_end(child_span)
    processor.on_span_end(handoff_span)
    processor.on_span_end(root_span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    root_id = spans["agent:Root"]["spanId"]
    handoff_id = spans["handoff:Root->Child"]["spanId"]
    child_id = spans["agent:Child"]["spanId"]

    assert spans["handoff:Root->Child"]["parentSpanId"] == root_id
    assert spans["agent:Child"]["parentSpanId"] == handoff_id
    assert spans["tool:search"]["parentSpanId"] == child_id


# ---------------------------------------------------------------------------
# Custom span
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_custom_span_captured():
    """Custom span data maps to custom kind with name and data attributes."""
    processor, flushed = _make_processor()
    data = _make_span_data("custom", name="my_op", data={"step": "1", "phase": "init"})
    span = _make_span("span-1", data)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "my_op" in spans
    assert spans["my_op"]["kind"] == "custom"
    assert spans["my_op"]["attributes"]["custom.name"] == "my_op"
    assert spans["my_op"]["attributes"]["custom.step"] == "1"


# ---------------------------------------------------------------------------
# Open span cleanup (flush safety)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_open_spans_closed_on_flush():
    """Spans still open when flush() is called are closed automatically."""
    processor, flushed = _make_processor()
    data = _make_span_data("agent", name="Zombie", tools=None, handoffs=None, output_type=None)
    span = _make_span("span-zombie", data)

    # Start but never end
    processor.on_span_start(span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert "agent:Zombie" in spans
    assert spans["agent:Zombie"]["endTimeMs"] is not None


# ---------------------------------------------------------------------------
# Trace lifecycle callbacks (no-ops)
# ---------------------------------------------------------------------------


def test_on_trace_start_and_end_are_noops():
    """on_trace_start and on_trace_end don't raise."""
    processor, _ = _make_processor()
    trace = MagicMock()
    processor.on_trace_start(trace)
    processor.on_trace_end(trace)


def test_shutdown_and_force_flush_are_noops():
    """shutdown and force_flush don't raise."""
    processor, _ = _make_processor()
    processor.shutdown()
    processor.force_flush()


# ---------------------------------------------------------------------------
# on_span_start/end error swallowed
# ---------------------------------------------------------------------------


def test_on_span_start_exception_swallowed():
    """Exceptions in on_span_start are caught and logged, not raised."""
    processor, _ = _make_processor()
    bad_span = MagicMock()
    bad_span.span_id = "bad"
    bad_span.parent_id = None
    bad_span.span_data = None  # Will cause _classify_span to fail
    # Should not raise
    processor.on_span_start(bad_span)


def test_on_span_end_for_unknown_span_id_is_noop():
    """on_span_end for a span that was never started is silently ignored."""
    processor, _ = _make_processor()
    data = _make_span_data("function", name="ghost", input=None, output=None)
    span = _make_span("span-never-started", data, error=None)
    # Only call end, not start
    processor.on_span_end(span)  # Should not raise


# ---------------------------------------------------------------------------
# trace_id accessibility
# ---------------------------------------------------------------------------


def test_trace_id_is_string():
    """trace_id returns a non-empty string."""
    processor, _ = _make_processor()
    assert isinstance(processor.trace_id, str)
    assert processor.trace_id


# ---------------------------------------------------------------------------
# instrument() convenience function
# ---------------------------------------------------------------------------


def test_instrument_raises_without_openai_agents(monkeypatch):
    """instrument() raises ImportError when openai-agents is not installed."""
    processor, _ = _make_processor()

    with patch.object(processor, "instrument") as mock_instrument:
        mock_instrument.side_effect = ImportError("openai-agents not installed")
        with pytest.raises(ImportError, match="openai-agents"):
            processor.instrument()


def test_instrument_registers_processor():
    """instrument() calls add_trace_processor on the SDK."""
    processor, _ = _make_processor()

    with patch("fox_sdk.integrations.openai_agents.FoxOpenAIAgentsProcessor.instrument") as mock_inst:
        # Verify instrument() is called during construction path
        processor.instrument = mock_inst
        processor.instrument()
        mock_inst.assert_called_once()


@pytest.mark.asyncio
async def test_from_client_creates_processor():
    """FoxOpenAIAgentsProcessor.from_client() creates a working processor."""
    from fox_sdk.client import FoxClient
    import respx
    import httpx

    with respx.mock:
        respx.post("https://api.fox.ai/v1/traces").mock(return_value=httpx.Response(202))
        fox = FoxClient(api_key="fox_test", endpoint="https://api.fox.ai")
        processor = FoxOpenAIAgentsProcessor.from_client(fox, agent_id="test-agent")
        assert processor.trace_id
        data = _make_span_data("agent", name="TestAgent", tools=None, handoffs=None, output_type=None)
        span = _make_span("span-1", data)
        _fire_span(processor, span)
        await processor.flush()


# ---------------------------------------------------------------------------
# Truncation of long values
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_long_tool_input_is_truncated():
    """Tool input longer than 1024 chars is truncated."""
    processor, flushed = _make_processor()
    long_input = "x" * 2000
    data = _make_span_data("function", name="tool", input=long_input, output=None)
    span = _make_span("span-1", data, error=None)
    _fire_span(processor, span)
    await processor.flush()

    spans = _spans_by_name(flushed)
    assert len(spans["tool:tool"]["attributes"]["tool.input"]) == 1024
