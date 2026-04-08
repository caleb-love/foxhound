"""Tests for FoxClaudeTracer — Claude Agent SDK integration."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from fox_sdk.tracer import Tracer
from fox_sdk.integrations.claude_agent import FoxClaudeTracer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tracer() -> tuple[FoxClaudeTracer, list[dict]]:
    """Return (FoxClaudeTracer, captured_payloads)."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-claude-agent", on_flush=capture)
    return FoxClaudeTracer(tracer), flushed


def _spans_by_name(flushed: list[dict]) -> dict[str, dict]:
    return {s["name"]: s for s in flushed[0]["spans"]}


def _make_assistant_message(
    model: str = "claude-sonnet-4-20250514",
    input_tokens: int = 100,
    output_tokens: int = 50,
    text_blocks: int = 1,
    tool_use_blocks: int = 0,
) -> MagicMock:
    """Create a mock AssistantMessage."""
    msg = MagicMock()
    msg.__class__ = type("AssistantMessage", (), {})
    type(msg).__name__ = "AssistantMessage"
    msg.model = model

    usage = MagicMock()
    usage.input_tokens = input_tokens
    usage.output_tokens = output_tokens
    msg.usage = usage

    content = []
    for _ in range(text_blocks):
        block = MagicMock()
        type(block).__name__ = "TextBlock"
        block.text = "Hello!"
        content.append(block)
    for _ in range(tool_use_blocks):
        block = MagicMock()
        type(block).__name__ = "ToolUseBlock"
        content.append(block)
    msg.content = content

    return msg


def _make_result_message(cost_usd: float = 0.002, duration_ms: int = 1500) -> MagicMock:
    """Create a mock ResultMessage."""
    msg = MagicMock()
    msg.__class__ = type("ResultMessage", (), {})
    type(msg).__name__ = "ResultMessage"
    msg.cost_usd = cost_usd
    msg.duration_ms = duration_ms
    return msg


# ---------------------------------------------------------------------------
# Workflow span management
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_end_workflow():
    """start_workflow() and end_workflow() create a workflow span."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow(prompt="Write hello world")
    tracer.end_workflow("ok")
    await tracer.flush()

    spans = _spans_by_name(flushed)
    assert "claude-agent" in spans
    assert spans["claude-agent"]["kind"] == "workflow"
    assert spans["claude-agent"]["status"] == "ok"
    assert spans["claude-agent"]["attributes"]["agent.prompt"] == "Write hello world"


@pytest.mark.asyncio
async def test_workflow_error():
    """end_workflow('error') records error status."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    tracer.end_workflow("error")
    await tracer.flush()

    spans = _spans_by_name(flushed)
    assert spans["claude-agent"]["status"] == "error"


# ---------------------------------------------------------------------------
# LLM call spans from AssistantMessage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_assistant_message_creates_llm_span():
    """on_message() with AssistantMessage creates an llm_call span."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    tracer.on_message(_make_assistant_message(
        model="claude-sonnet-4-20250514",
        input_tokens=150,
        output_tokens=75,
    ))
    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    llm_span = spans.get("llm:claude:turn-1")
    assert llm_span is not None
    assert llm_span["kind"] == "llm_call"
    assert llm_span["attributes"]["llm.model"] == "claude-sonnet-4-20250514"
    assert llm_span["attributes"]["llm.prompt_tokens"] == 150
    assert llm_span["attributes"]["llm.completion_tokens"] == 75


@pytest.mark.asyncio
async def test_multiple_turns():
    """Multiple assistant messages create sequential turn spans."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    tracer.on_message(_make_assistant_message())
    tracer.on_message(_make_assistant_message())
    tracer.on_message(_make_assistant_message())
    tracer.end_workflow()
    await tracer.flush()

    spans = flushed[0]["spans"]
    llm_spans = [s for s in spans if s["kind"] == "llm_call"]
    assert len(llm_spans) == 3
    assert llm_spans[0]["name"] == "llm:claude:turn-1"
    assert llm_spans[1]["name"] == "llm:claude:turn-2"
    assert llm_spans[2]["name"] == "llm:claude:turn-3"


@pytest.mark.asyncio
async def test_assistant_message_content_block_counts():
    """Content block counts are recorded as attributes."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    tracer.on_message(_make_assistant_message(text_blocks=2, tool_use_blocks=1))
    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    llm_span = spans["llm:claude:turn-1"]
    assert llm_span["attributes"]["llm.text_blocks"] == 2
    assert llm_span["attributes"]["llm.tool_use_blocks"] == 1


@pytest.mark.asyncio
async def test_llm_span_is_child_of_workflow():
    """LLM spans are children of the workflow span."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    tracer.on_message(_make_assistant_message())
    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    workflow_id = spans["claude-agent"]["spanId"]
    assert spans["llm:claude:turn-1"]["parentSpanId"] == workflow_id


# ---------------------------------------------------------------------------
# Tool use spans via hooks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pre_post_tool_hooks():
    """PreToolUse and PostToolUse hooks create and end tool_call spans."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()

    # Simulate PreToolUse
    await tracer._pre_tool_use(
        input_data={"tool_name": "Bash", "tool_input": {"command": "echo hello"}},
        tool_use_id="tu_123",
        context=None,
    )

    # Simulate PostToolUse
    await tracer._post_tool_use(
        input_data={"tool_result": "hello\n"},
        tool_use_id="tu_123",
        context=None,
    )

    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    tool_span = spans.get("tool:Bash")
    assert tool_span is not None
    assert tool_span["kind"] == "tool_call"
    assert tool_span["status"] == "ok"
    assert tool_span["attributes"]["tool.name"] == "Bash"
    assert tool_span["attributes"]["tool.input.command"] == "echo hello"
    assert tool_span["attributes"]["tool.output"] == "hello\n"


@pytest.mark.asyncio
async def test_tool_error():
    """PostToolUse with error records error status."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()

    await tracer._pre_tool_use(
        input_data={"tool_name": "Read", "tool_input": "/missing.txt"},
        tool_use_id="tu_456",
        context=None,
    )

    await tracer._post_tool_use(
        input_data={"error": "File not found"},
        tool_use_id="tu_456",
        context=None,
    )

    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    assert spans["tool:Read"]["status"] == "error"
    error_events = [e for e in spans["tool:Read"]["events"] if e["name"] == "error"]
    assert error_events
    assert "File not found" in error_events[0]["attributes"]["message"]


@pytest.mark.asyncio
async def test_tool_span_is_child_of_workflow():
    """Tool spans are children of the workflow span."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()

    await tracer._pre_tool_use(
        input_data={"tool_name": "Write", "tool_input": {"path": "test.py"}},
        tool_use_id="tu_789",
        context=None,
    )
    await tracer._post_tool_use(
        input_data={},
        tool_use_id="tu_789",
        context=None,
    )

    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    workflow_id = spans["claude-agent"]["spanId"]
    assert spans["tool:Write"]["parentSpanId"] == workflow_id


@pytest.mark.asyncio
async def test_unclosed_tool_spans_ended_on_flush():
    """Unclosed tool spans get ended with error on flush."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    await tracer._pre_tool_use(
        input_data={"tool_name": "Bash", "tool_input": {"command": "sleep 999"}},
        tool_use_id="tu_orphan",
        context=None,
    )
    # No PostToolUse — simulating timeout
    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    assert spans["tool:Bash"]["status"] == "error"
    warning_events = [e for e in spans["tool:Bash"]["events"] if e["name"] == "warning"]
    assert warning_events


# ---------------------------------------------------------------------------
# ResultMessage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_result_message_captures_cost():
    """on_message() with ResultMessage captures cost on workflow span."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow()
    tracer.on_message(_make_result_message(cost_usd=0.005, duration_ms=2000))
    tracer.end_workflow()
    await tracer.flush()

    spans = _spans_by_name(flushed)
    assert spans["claude-agent"]["attributes"]["agent.cost_usd"] == 0.005
    assert spans["claude-agent"]["attributes"]["agent.duration_ms"] == 2000


# ---------------------------------------------------------------------------
# Full agent loop simulation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_agent_loop():
    """Simulate a complete agent loop with LLM calls, tool use, and result."""
    tracer, flushed = _make_tracer()

    tracer.start_workflow(prompt="Create a file")

    # Turn 1: Claude decides to use a tool
    tracer.on_message(_make_assistant_message(tool_use_blocks=1))

    # Tool: Write
    await tracer._pre_tool_use(
        input_data={"tool_name": "Write", "tool_input": {"path": "hello.py", "content": "print('hi')"}},
        tool_use_id="tu_1",
        context=None,
    )
    await tracer._post_tool_use(
        input_data={"tool_result": "File written"},
        tool_use_id="tu_1",
        context=None,
    )

    # Turn 2: Claude responds with text
    tracer.on_message(_make_assistant_message(text_blocks=1, tool_use_blocks=0))

    # Result
    tracer.on_message(_make_result_message(cost_usd=0.003))

    tracer.end_workflow()
    await tracer.flush()

    spans = flushed[0]["spans"]
    assert len(spans) == 4  # workflow + 2 llm turns + 1 tool

    kinds = {s["kind"] for s in spans}
    assert "workflow" in kinds
    assert "llm_call" in kinds
    assert "tool_call" in kinds

    # All non-workflow spans are children of workflow
    workflow_span = next(s for s in spans if s["kind"] == "workflow")
    for s in spans:
        if s["kind"] != "workflow":
            assert s["parentSpanId"] == workflow_span["spanId"]


# ---------------------------------------------------------------------------
# get_hooks()
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_hooks_returns_correct_structure():
    """get_hooks() returns PreToolUse and PostToolUse entries."""
    tracer, _ = _make_tracer()
    hooks = tracer.get_hooks()
    assert "PreToolUse" in hooks
    assert "PostToolUse" in hooks
    assert len(hooks["PreToolUse"]) == 1
    assert len(hooks["PostToolUse"]) == 1


# ---------------------------------------------------------------------------
# Trace ID accessibility
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trace_id_accessible():
    """trace_id returns a non-empty string."""
    tracer, _ = _make_tracer()
    assert isinstance(tracer.trace_id, str)
    assert tracer.trace_id
