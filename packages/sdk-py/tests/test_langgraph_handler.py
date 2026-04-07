"""Integration tests for FoxCallbackHandler simulating LangGraph events."""

import uuid
import pytest
from unittest.mock import MagicMock

from langchain_core.outputs import LLMResult, Generation

from fox_sdk.tracer import Tracer
from fox_sdk.integrations.langgraph import FoxCallbackHandler


def _handler() -> tuple[FoxCallbackHandler, list[dict]]:
    """Return (handler, captured_payloads)."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-agent", on_flush=capture)
    return FoxCallbackHandler(tracer), flushed


@pytest.mark.asyncio
async def test_llm_call_captured():
    """on_llm_start / on_llm_end produce an llm_call span."""
    handler, flushed = _handler()

    run_id = uuid.uuid4()
    parent_id = uuid.uuid4()

    # Simulate graph root
    handler.on_chain_start(
        {"id": ["StateGraph"], "name": "StateGraph"},
        {"messages": []},
        run_id=parent_id,
        parent_run_id=None,
    )

    handler.on_llm_start(
        {"name": "gpt-4o", "kwargs": {"model_name": "gpt-4o"}},
        ["Hello"],
        run_id=run_id,
        parent_run_id=parent_id,
    )
    handler.on_llm_end(
        LLMResult(
            generations=[[Generation(text="Hi")]],
            llm_output={"token_usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8}},
        ),
        run_id=run_id,
        parent_run_id=parent_id,
    )

    handler.on_chain_end({}, run_id=parent_id, parent_run_id=None)

    await handler.flush()

    spans = {s["name"]: s for s in flushed[0]["spans"]}
    assert "llm:gpt-4o" in spans

    llm_span = spans["llm:gpt-4o"]
    assert llm_span["kind"] == "llm_call"
    assert llm_span["status"] == "ok"
    assert llm_span["attributes"]["llm.prompt_tokens"] == 5
    assert llm_span["attributes"]["llm.total_tokens"] == 8


@pytest.mark.asyncio
async def test_tool_call_captured():
    """on_tool_start / on_tool_end produce a tool_call span."""
    handler, flushed = _handler()

    root_id = uuid.uuid4()
    tool_id = uuid.uuid4()

    handler.on_chain_start({"id": ["StateGraph"]}, {}, run_id=root_id, parent_run_id=None)

    handler.on_tool_start(
        {"name": "web_search"},
        "fox observability",
        run_id=tool_id,
        parent_run_id=root_id,
    )
    handler.on_tool_end("Search results...", run_id=tool_id, parent_run_id=root_id)
    handler.on_chain_end({}, run_id=root_id, parent_run_id=None)

    await handler.flush()

    spans = {s["name"]: s for s in flushed[0]["spans"]}
    assert "tool:web_search" in spans

    tool_span = spans["tool:web_search"]
    assert tool_span["kind"] == "tool_call"
    assert tool_span["status"] == "ok"
    assert tool_span["attributes"]["tool.input"] == "fox observability"
    assert tool_span["parentSpanId"] == spans["StateGraph"]["spanId"]


@pytest.mark.asyncio
async def test_error_propagation():
    """A tool error produces an error-status span with an error event."""
    handler, flushed = _handler()

    root_id = uuid.uuid4()
    tool_id = uuid.uuid4()

    handler.on_chain_start({"id": ["StateGraph"]}, {}, run_id=root_id, parent_run_id=None)
    handler.on_tool_start({"name": "broken_tool"}, "input", run_id=tool_id, parent_run_id=root_id)
    handler.on_tool_error(ValueError("tool exploded"), run_id=tool_id, parent_run_id=root_id)
    handler.on_chain_end({}, run_id=root_id, parent_run_id=None)

    await handler.flush()

    spans = {s["name"]: s for s in flushed[0]["spans"]}
    err_span = spans["tool:broken_tool"]
    assert err_span["status"] == "error"
    assert err_span["events"][0]["name"] == "error"
    assert "tool exploded" in err_span["events"][0]["attributes"]["message"]


@pytest.mark.asyncio
async def test_root_span_is_workflow():
    """The outermost chain gets kind='workflow'; nested chains get 'agent_step'."""
    handler, flushed = _handler()

    root_id = uuid.uuid4()
    node_id = uuid.uuid4()

    handler.on_chain_start({"id": ["StateGraph"]}, {}, run_id=root_id, parent_run_id=None)
    handler.on_chain_start({"name": "call_model"}, {}, run_id=node_id, parent_run_id=root_id)
    handler.on_chain_end({}, run_id=node_id, parent_run_id=root_id)
    handler.on_chain_end({}, run_id=root_id, parent_run_id=None)

    await handler.flush()

    spans = {s["name"]: s for s in flushed[0]["spans"]}
    assert spans["StateGraph"]["kind"] == "workflow"
    assert spans["call_model"]["kind"] == "agent_step"
