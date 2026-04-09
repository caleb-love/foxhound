"""Tests for FoxAutogenTracer — Autogen / AG2 integration."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from foxhound.tracer import Tracer
from foxhound.integrations.autogen import FoxAutogenTracer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tracer() -> tuple[FoxAutogenTracer, list[dict]]:
    """Return (FoxAutogenTracer, captured_payloads)."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-autogen", on_flush=capture)
    return FoxAutogenTracer(tracer), flushed


def _mock_agent(name: str) -> MagicMock:
    """Return a mock ConversableAgent with a name and stub reply methods."""
    agent = MagicMock()
    agent.name = name
    return agent


def _spans_by_name(flushed: list[dict]) -> dict[str, dict]:
    return {s["name"]: s for s in flushed[0]["spans"]}


def _all_spans(flushed: list[dict]) -> list[dict]:
    return flushed[0]["spans"]


# ---------------------------------------------------------------------------
# traced_initiate_chat — workflow span
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_traced_initiate_chat_creates_workflow_span():
    """traced_initiate_chat wraps the conversation in a workflow span."""
    fox_tracer, flushed = _make_tracer()

    initiator = _mock_agent("UserProxy")
    recipient = _mock_agent("Assistant")
    initiator.initiate_chat.return_value = "chat result"

    result = fox_tracer.traced_initiate_chat(initiator, recipient, message="Hello!")
    assert result == "chat result"

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "conversation" in spans
    assert spans["conversation"]["kind"] == "workflow"
    assert spans["conversation"]["status"] == "ok"
    assert spans["conversation"]["attributes"]["autogen.initiator"] == "UserProxy"
    assert "Hello!" in spans["conversation"]["attributes"]["autogen.initial_message"]


@pytest.mark.asyncio
async def test_traced_initiate_chat_error():
    """traced_initiate_chat records an error span when initiate_chat raises."""
    fox_tracer, flushed = _make_tracer()

    initiator = _mock_agent("UserProxy")
    recipient = _mock_agent("Assistant")
    initiator.initiate_chat.side_effect = RuntimeError("conversation failed")

    with pytest.raises(RuntimeError, match="conversation failed"):
        fox_tracer.traced_initiate_chat(initiator, recipient, message="Hello!")

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["conversation"]["status"] == "error"
    error_events = [e for e in spans["conversation"]["events"] if e["name"] == "error"]
    assert error_events
    assert "conversation failed" in error_events[0]["attributes"]["message"]


@pytest.mark.asyncio
async def test_traced_initiate_chat_async():
    """traced_initiate_chat_async wraps async conversation in a workflow span."""
    fox_tracer, flushed = _make_tracer()

    initiator = _mock_agent("UserProxy")
    recipient = _mock_agent("Assistant")
    initiator.a_initiate_chat = AsyncMock(return_value="async result")

    result = await fox_tracer.traced_initiate_chat_async(initiator, recipient, message="Async hello!")
    assert result == "async result"

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["conversation"]["kind"] == "workflow"
    assert spans["conversation"]["status"] == "ok"


# ---------------------------------------------------------------------------
# start_workflow / end_workflow manual API
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_end_workflow():
    """Manual start_workflow / end_workflow create a workflow span."""
    fox_tracer, flushed = _make_tracer()

    fox_tracer.start_workflow(initiator_name="MyAgent", message="Starting")
    fox_tracer.end_workflow("ok")

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "conversation" in spans
    assert spans["conversation"]["kind"] == "workflow"
    assert spans["conversation"]["status"] == "ok"
    assert spans["conversation"]["attributes"]["autogen.initiator"] == "MyAgent"


# ---------------------------------------------------------------------------
# instrument / generate_reply patching
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_instrument_patches_generate_reply():
    """instrument() patches agent.generate_reply to emit llm_call spans."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("AssistantAgent")
    original_reply = MagicMock(return_value=(True, "The answer is 42."))
    agent.generate_reply = original_reply

    fox_tracer.instrument([agent])

    # Set up workflow span context
    fox_tracer.start_workflow(initiator_name="UserProxy", message="What is 6*7?")

    # Simulate Autogen calling generate_reply on the agent
    messages = [{"role": "user", "content": "What is 6*7?"}]
    result = agent.generate_reply(messages=messages, sender=None)

    assert result == (True, "The answer is 42.")
    # Original was called
    original_reply.assert_called_once()

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "reply:AssistantAgent" in spans
    reply_span = spans["reply:AssistantAgent"]
    assert reply_span["kind"] == "llm_call"
    assert reply_span["status"] == "ok"
    assert reply_span["attributes"]["agent.name"] == "AssistantAgent"
    assert reply_span["attributes"]["llm.message_count"] == 1


@pytest.mark.asyncio
async def test_instrument_patches_generate_reply_with_content():
    """generate_reply span captures last message content."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("Writer")
    agent.generate_reply = MagicMock(return_value=(True, "Here is the draft."))
    fox_tracer.instrument([agent])

    fox_tracer.start_workflow(initiator_name="UserProxy")
    messages = [
        {"role": "user", "content": "Write a story"},
        {"role": "assistant", "content": "Let me think..."},
    ]
    agent.generate_reply(messages=messages, sender=None)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    reply_span = spans["reply:Writer"]
    assert reply_span["attributes"]["llm.message_count"] == 2
    assert "Let me think..." in reply_span["attributes"]["llm.last_message"]


@pytest.mark.asyncio
async def test_instrument_generate_reply_error():
    """generate_reply span is marked error when original raises."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("BrokenAgent")
    agent.generate_reply = MagicMock(side_effect=ValueError("LLM timeout"))
    fox_tracer.instrument([agent])

    fox_tracer.start_workflow("UserProxy")

    with pytest.raises(ValueError, match="LLM timeout"):
        agent.generate_reply(messages=[], sender=None)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["reply:BrokenAgent"]["status"] == "error"


@pytest.mark.asyncio
async def test_instrument_patches_async_generate_reply():
    """instrument() patches a_generate_reply for async agents."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("AsyncAssistant")
    original_async_reply = AsyncMock(return_value=(True, "Async reply here."))
    agent.a_generate_reply = original_async_reply

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    result = await agent.a_generate_reply(messages=[{"role": "user", "content": "Hello"}], sender=None)
    assert result == (True, "Async reply here.")

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "reply:AsyncAssistant" in spans
    assert spans["reply:AsyncAssistant"]["kind"] == "llm_call"
    assert spans["reply:AsyncAssistant"]["status"] == "ok"


# ---------------------------------------------------------------------------
# execute_function patching — tool calls
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_instrument_patches_execute_function():
    """instrument() patches execute_function to emit tool_call spans."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("ToolAgent")
    func_call = {"name": "web_search", "arguments": '{"query": "autogen docs"}'}
    original_exec = MagicMock(return_value=(True, "Found results: ..."))
    agent.execute_function = original_exec

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    result = agent.execute_function(func_call)
    assert result == (True, "Found results: ...")
    original_exec.assert_called_once_with(func_call)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "tool:web_search" in spans
    tool_span = spans["tool:web_search"]
    assert tool_span["kind"] == "tool_call"
    assert tool_span["status"] == "ok"
    assert tool_span["attributes"]["tool.name"] == "web_search"
    assert '{"query": "autogen docs"}' in tool_span["attributes"]["tool.input"]
    assert "Found results:" in tool_span["attributes"]["tool.output"]


@pytest.mark.asyncio
async def test_execute_function_error():
    """execute_function span records error when function raises."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("ToolAgent")
    func_call = {"name": "bad_tool", "arguments": "{}"}
    agent.execute_function = MagicMock(side_effect=RuntimeError("tool failed"))

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    with pytest.raises(RuntimeError, match="tool failed"):
        agent.execute_function(func_call)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["tool:bad_tool"]["status"] == "error"


# ---------------------------------------------------------------------------
# generate_code_execution_reply patching — code exec spans
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_instrument_patches_code_execution():
    """instrument() patches generate_code_execution_reply for code exec spans."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("UserProxyAgent")
    original_code_exec = MagicMock(
        return_value=(True, {"exit_code": 0, "output": "Hello, world!\n"})
    )
    agent.generate_code_execution_reply = original_code_exec

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    messages = [{"role": "assistant", "content": "```python\nprint('Hello, world!')\n```"}]
    result = agent.generate_code_execution_reply(messages=messages, sender=None)

    assert result == (True, {"exit_code": 0, "output": "Hello, world!\n"})

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "code_exec:UserProxyAgent" in spans
    code_span = spans["code_exec:UserProxyAgent"]
    assert code_span["kind"] == "tool_call"
    assert code_span["attributes"]["code.exec"] is True
    assert code_span["attributes"]["code.exit_code"] == 0
    assert "Hello, world!" in code_span["attributes"]["code.output"]
    assert code_span["status"] == "ok"


@pytest.mark.asyncio
async def test_code_execution_error():
    """generate_code_execution_reply span records error on exception."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("UserProxy")
    agent.generate_code_execution_reply = MagicMock(side_effect=RuntimeError("sandbox crash"))

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    with pytest.raises(RuntimeError, match="sandbox crash"):
        agent.generate_code_execution_reply(messages=[], sender=None)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["code_exec:UserProxy"]["status"] == "error"


# ---------------------------------------------------------------------------
# Cross-agent trace correlation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_multi_agent_creates_separate_agent_spans():
    """Different agents produce separate agent-level spans under workflow."""
    fox_tracer, flushed = _make_tracer()

    assistant = _mock_agent("AssistantAgent")
    assistant.generate_reply = MagicMock(return_value=(True, "Assistant reply."))

    user_proxy = _mock_agent("UserProxyAgent")
    user_proxy.generate_reply = MagicMock(return_value=(True, "User proxy reply."))
    user_proxy.initiate_chat = MagicMock(side_effect=lambda recipient, **kw: (
        assistant.generate_reply(messages=[{"role": "user", "content": kw.get("message", "")}], sender=user_proxy),
        user_proxy.generate_reply(messages=[{"role": "assistant", "content": "response"}], sender=assistant),
    ))

    fox_tracer.instrument([assistant, user_proxy])
    fox_tracer.traced_initiate_chat(user_proxy, assistant, message="Hello!")

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)

    # Agent-level spans exist for each participant
    assert "agent:AssistantAgent" in spans
    assert "agent:UserProxyAgent" in spans

    # Both agent spans are children of workflow
    workflow_id = spans["conversation"]["spanId"]
    assert spans["agent:AssistantAgent"]["parentSpanId"] == workflow_id
    assert spans["agent:UserProxyAgent"]["parentSpanId"] == workflow_id


@pytest.mark.asyncio
async def test_reply_spans_are_children_of_agent_spans():
    """Reply spans are children of their respective agent spans."""
    fox_tracer, flushed = _make_tracer()

    assistant = _mock_agent("Assistant")
    assistant.generate_reply = MagicMock(return_value=(True, "LLM output."))

    fox_tracer.instrument([assistant])
    fox_tracer.start_workflow("UserProxy", message="Go!")

    assistant.generate_reply(messages=[{"role": "user", "content": "Go!"}], sender=None)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)

    agent_id = spans["agent:Assistant"]["spanId"]
    assert spans["reply:Assistant"]["parentSpanId"] == agent_id


@pytest.mark.asyncio
async def test_tool_spans_are_children_of_agent_spans():
    """Tool spans are children of their respective agent spans."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("ToolAgent")
    agent.execute_function = MagicMock(return_value=(True, "result"))

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    agent.execute_function({"name": "my_tool", "arguments": '{"x": 1}'})

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    agent_id = spans["agent:ToolAgent"]["spanId"]
    assert spans["tool:my_tool"]["parentSpanId"] == agent_id


@pytest.mark.asyncio
async def test_agent_span_reused_across_multiple_calls():
    """Multiple calls from the same agent reuse the same agent span."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("ResearchAgent")
    agent.generate_reply = MagicMock(return_value=(True, "answer"))

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")

    # Three separate reply calls from the same agent
    for _ in range(3):
        agent.generate_reply(messages=[{"role": "user", "content": "q"}], sender=None)

    await fox_tracer.flush()
    spans = _all_spans(flushed)
    agent_spans = [s for s in spans if s["name"] == "agent:ResearchAgent"]
    assert len(agent_spans) == 1  # only one agent span

    reply_spans = [s for s in spans if s["name"] == "reply:ResearchAgent"]
    assert len(reply_spans) == 3
    for rs in reply_spans:
        assert rs["parentSpanId"] == agent_spans[0]["spanId"]


# ---------------------------------------------------------------------------
# uninstrument
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_uninstrument_restores_original_methods():
    """uninstrument() restores original methods on agents."""
    fox_tracer, flushed = _make_tracer()

    original = MagicMock(return_value=(True, "original"))
    agent = _mock_agent("Agent")
    agent.generate_reply = original

    fox_tracer.instrument([agent])
    assert agent.generate_reply is not original  # patched

    fox_tracer.uninstrument([agent])
    assert agent.generate_reply is original  # restored


@pytest.mark.asyncio
async def test_instrument_idempotent():
    """Calling instrument() twice on the same agent does not double-patch."""
    fox_tracer, flushed = _make_tracer()

    original = MagicMock(return_value=(True, "ok"))
    agent = _mock_agent("Agent")
    agent.generate_reply = original

    fox_tracer.instrument([agent])
    patched_once = agent.generate_reply
    fox_tracer.instrument([agent])
    assert agent.generate_reply is patched_once  # not double-wrapped


# ---------------------------------------------------------------------------
# Agent spans cleanup
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agent_spans_ended_on_flush():
    """Agent spans are properly ended when flush is called."""
    fox_tracer, flushed = _make_tracer()

    agent = _mock_agent("Agent")
    agent.generate_reply = MagicMock(return_value=(True, "reply"))

    fox_tracer.instrument([agent])
    fox_tracer.start_workflow("UserProxy")
    agent.generate_reply(messages=[], sender=None)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["agent:Agent"]["endTimeMs"] is not None
    assert spans["agent:Agent"]["status"] == "ok"


@pytest.mark.asyncio
async def test_agent_spans_ended_on_conversation_error():
    """Agent spans are ended even when traced_initiate_chat fails."""
    fox_tracer, flushed = _make_tracer()

    assistant = _mock_agent("Assistant")
    assistant.generate_reply = MagicMock(return_value=(True, "reply"))

    initiator = _mock_agent("UserProxy")

    def exploding_initiate_chat(recipient, **kw):
        assistant.generate_reply(messages=[], sender=initiator)
        raise RuntimeError("mid-conversation crash")

    initiator.initiate_chat = MagicMock(side_effect=exploding_initiate_chat)

    fox_tracer.instrument([assistant])

    with pytest.raises(RuntimeError, match="mid-conversation crash"):
        fox_tracer.traced_initiate_chat(initiator, assistant, message="Go!")

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["agent:Assistant"]["endTimeMs"] is not None


# ---------------------------------------------------------------------------
# Sender attribution
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reply_span_captures_sender_name():
    """The reply span records the sender agent name."""
    fox_tracer, flushed = _make_tracer()

    assistant = _mock_agent("AssistantAgent")
    assistant.generate_reply = MagicMock(return_value=(True, "reply"))
    user_proxy = _mock_agent("UserProxy")

    fox_tracer.instrument([assistant])
    fox_tracer.start_workflow("UserProxy")

    assistant.generate_reply(messages=[], sender=user_proxy)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["reply:AssistantAgent"]["attributes"]["agent.sender"] == "UserProxy"


# ---------------------------------------------------------------------------
# _get_agent_name fallback
# ---------------------------------------------------------------------------


def test_get_agent_name_fallback_to_class_name():
    """_get_agent_name falls back to type name when agent has no .name."""
    from foxhound.integrations.autogen import _get_agent_name

    class MyCustomAgent:
        pass

    agent = MyCustomAgent()
    assert _get_agent_name(agent) == "MyCustomAgent"


def test_get_agent_name_from_name_attr():
    """_get_agent_name uses .name when present."""
    from foxhound.integrations.autogen import _get_agent_name

    agent = MagicMock()
    agent.name = "ResearchBot"
    assert _get_agent_name(agent) == "ResearchBot"


# ---------------------------------------------------------------------------
# _extract_func_name / _extract_func_args helpers
# ---------------------------------------------------------------------------


def test_extract_func_name_from_dict():
    from foxhound.integrations.autogen import _extract_func_name

    assert _extract_func_name({"name": "my_tool", "arguments": "{}"}) == "my_tool"


def test_extract_func_name_from_nested_dict():
    from foxhound.integrations.autogen import _extract_func_name

    assert _extract_func_name({"function": {"name": "nested_tool"}}) == "nested_tool"


def test_extract_func_name_unknown():
    from foxhound.integrations.autogen import _extract_func_name

    assert _extract_func_name({}) == "unknown"


def test_extract_func_args_from_dict():
    from foxhound.integrations.autogen import _extract_func_args

    result = _extract_func_args({"name": "tool", "arguments": '{"x": 1}'})
    assert result == '{"x": 1}'


# ---------------------------------------------------------------------------
# trace_id accessibility
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trace_id_accessible():
    """trace_id returns a non-empty string."""
    fox_tracer, _ = _make_tracer()
    assert isinstance(fox_tracer.trace_id, str)
    assert fox_tracer.trace_id


# ---------------------------------------------------------------------------
# instrument() module-level function (with autogen import patched)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_instrument_function_raises_if_autogen_missing():
    """The module-level instrument() raises ImportError if autogen is absent."""
    from foxhound.integrations import autogen as autogen_module

    with patch.object(autogen_module, "_check_autogen_installed", side_effect=ImportError("not installed")):
        with pytest.raises(ImportError):
            autogen_module.instrument(
                client=MagicMock(),
                agent_id="test",
                agents=[],
            )


@pytest.mark.asyncio
async def test_instrument_function_returns_tracer():
    """The module-level instrument() returns a FoxAutogenTracer."""
    from foxhound.integrations import autogen as autogen_module

    mock_client = MagicMock()
    mock_client.start_trace.return_value = Tracer(agent_id="x")

    with patch.object(autogen_module, "_check_autogen_installed", return_value=None):
        tracer = autogen_module.instrument(
            client=mock_client,
            agent_id="test",
            agents=[],
        )

    assert isinstance(tracer, FoxAutogenTracer)
