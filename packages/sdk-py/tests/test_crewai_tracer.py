"""Tests for FoxCrewTracer — CrewAI integration."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from foxhound.tracer import Tracer
from foxhound.integrations.crewai import FoxCrewTracer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tracer() -> tuple[FoxCrewTracer, list[dict]]:
    """Return (FoxCrewTracer, captured_payloads)."""
    flushed: list[dict] = []

    async def capture(payload: dict) -> None:
        flushed.append(payload)

    tracer = Tracer(agent_id="test-crew", on_flush=capture)
    return FoxCrewTracer(tracer), flushed


def _mock_crew_with_step(fox_tracer: FoxCrewTracer, step_payload: object) -> MagicMock:
    """Return a mock Crew whose kickoff fires on_step once."""

    def kickoff(inputs=None):
        fox_tracer.on_step(step_payload)
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    return crew


def _mock_crew_with_task(fox_tracer: FoxCrewTracer, task_payload: object) -> MagicMock:
    """Return a mock Crew whose kickoff fires on_task once."""

    def kickoff(inputs=None):
        fox_tracer.on_task(task_payload)
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    return crew


def _spans_by_name(flushed: list[dict]) -> dict[str, dict]:
    return {s["name"]: s for s in flushed[0]["spans"]}


# ---------------------------------------------------------------------------
# kickoff / workflow span
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kickoff_creates_workflow_span():
    """kickoff() wraps crew execution in a workflow span."""
    fox_tracer, flushed = _make_tracer()

    mock_crew = MagicMock()
    mock_crew.kickoff.return_value = "final answer"

    result = fox_tracer.kickoff(mock_crew, inputs={"topic": "AI"})
    assert result == "final answer"

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert "crew" in spans
    assert spans["crew"]["kind"] == "workflow"
    assert spans["crew"]["status"] == "ok"
    assert spans["crew"]["attributes"]["crew.input_keys"] == "topic"


@pytest.mark.asyncio
async def test_kickoff_no_inputs():
    """kickoff() without inputs still produces a clean workflow span."""
    fox_tracer, flushed = _make_tracer()

    mock_crew = MagicMock()
    mock_crew.kickoff.return_value = "result"

    fox_tracer.kickoff(mock_crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert spans["crew"]["kind"] == "workflow"
    assert "crew.input_keys" not in spans["crew"]["attributes"]


@pytest.mark.asyncio
async def test_kickoff_error_recorded():
    """kickoff() records an error span when the crew raises."""
    fox_tracer, flushed = _make_tracer()

    mock_crew = MagicMock()
    mock_crew.kickoff.side_effect = RuntimeError("crew exploded")

    with pytest.raises(RuntimeError, match="crew exploded"):
        fox_tracer.kickoff(mock_crew, inputs={})

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["crew"]["status"] == "error"
    error_events = [e for e in spans["crew"]["events"] if e["name"] == "error"]
    assert error_events
    assert "crew exploded" in error_events[0]["attributes"]["message"]


@pytest.mark.asyncio
async def test_async_kickoff():
    """kickoff_async() wraps async crew execution in a workflow span."""
    fox_tracer, flushed = _make_tracer()

    mock_crew = AsyncMock()
    mock_crew.kickoff_async.return_value = "async result"

    result = await fox_tracer.kickoff_async(mock_crew, inputs={"x": 1})
    assert result == "async result"

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["crew"]["kind"] == "workflow"
    assert spans["crew"]["status"] == "ok"
    assert spans["crew"]["attributes"]["crew.input_keys"] == "x"


@pytest.mark.asyncio
async def test_async_kickoff_error_recorded():
    """kickoff_async() records error span when crew raises."""
    fox_tracer, flushed = _make_tracer()

    mock_crew = AsyncMock()
    mock_crew.kickoff_async.side_effect = ValueError("async boom")

    with pytest.raises(ValueError):
        await fox_tracer.kickoff_async(mock_crew)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["crew"]["status"] == "error"


# ---------------------------------------------------------------------------
# on_step — dict payload
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_on_step_tool_call_from_action_dict():
    """on_step() with dict using 'action' key creates a tool_call span."""
    fox_tracer, flushed = _make_tracer()
    crew = _mock_crew_with_step(
        fox_tracer,
        {"action": "web_search", "action_input": "crewai docs", "observation": "Found docs."},
    )
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "tool:web_search" in spans
    span = spans["tool:web_search"]
    assert span["kind"] == "tool_call"
    assert span["status"] == "ok"
    assert span["attributes"]["tool.input"] == "crewai docs"
    assert span["attributes"]["tool.output"] == "Found docs."


@pytest.mark.asyncio
async def test_on_step_tool_call_from_tool_dict():
    """on_step() with dict using 'tool' key creates a tool_call span."""
    fox_tracer, flushed = _make_tracer()
    crew = _mock_crew_with_step(
        fox_tracer,
        {"tool": "calculator", "tool_input": "2+2", "output": "4"},
    )
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "tool:calculator" in spans
    assert spans["tool:calculator"]["attributes"]["tool.output"] == "4"


@pytest.mark.asyncio
async def test_on_step_unknown_dict_is_agent_step():
    """on_step() with a dict that has no tool key falls back to agent_step."""
    fox_tracer, flushed = _make_tracer()
    crew = _mock_crew_with_step(fox_tracer, {"data": "something"})
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    step_spans = [s for s in flushed[0]["spans"] if s["kind"] == "agent_step"]
    assert step_spans  # at least one fallback step


# ---------------------------------------------------------------------------
# on_step — object payload (AgentAction-like)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_on_step_agent_action_object():
    """on_step() handles AgentAction-like objects with .tool attribute."""
    fox_tracer, flushed = _make_tracer()

    step = MagicMock(spec=["tool", "tool_input", "log"])
    step.tool = "read_file"
    step.tool_input = "data.txt"
    step.log = "I need to read the file."

    crew = _mock_crew_with_step(fox_tracer, step)
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "tool:read_file" in spans
    assert spans["tool:read_file"]["attributes"]["tool.input"] == "data.txt"
    assert spans["tool:read_file"]["attributes"]["agent.thought"] == "I need to read the file."


@pytest.mark.asyncio
async def test_on_step_agent_finish_object():
    """on_step() handles AgentFinish-like objects with .return_values."""
    fox_tracer, flushed = _make_tracer()

    step = MagicMock(spec=["return_values", "log"])
    step.return_values = {"output": "Final answer here"}
    step.log = "I am done."

    crew = _mock_crew_with_step(fox_tracer, step)
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = flushed[0]["spans"]
    finish_spans = [s for s in spans if "finish" in s["name"]]
    assert finish_spans
    assert "agent.return_values" in finish_spans[0]["attributes"]
    assert finish_spans[0]["attributes"]["agent.thought"] == "I am done."


# ---------------------------------------------------------------------------
# on_task
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_on_task_from_object():
    """on_task() records a task-completion span from an object payload."""
    fox_tracer, flushed = _make_tracer()

    task_output = MagicMock(spec=["description", "raw"])
    task_output.description = "Research the topic"
    task_output.raw = "Comprehensive research summary."

    crew = _mock_crew_with_task(fox_tracer, task_output)
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    task_span = spans.get("task:Research the topic")
    assert task_span is not None
    assert task_span["kind"] == "agent_step"
    assert task_span["attributes"]["task.output"] == "Comprehensive research summary."


@pytest.mark.asyncio
async def test_on_task_from_dict():
    """on_task() handles a dict payload."""
    fox_tracer, flushed = _make_tracer()
    crew = _mock_crew_with_task(
        fox_tracer,
        {"description": "Write report", "raw": "Report content here."},
    )
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "task:Write report" in spans
    assert spans["task:Write report"]["attributes"]["task.output"] == "Report content here."


@pytest.mark.asyncio
async def test_on_task_no_output():
    """on_task() handles a task with no raw output without crashing."""
    fox_tracer, flushed = _make_tracer()

    task_output = MagicMock(spec=["description"])
    task_output.description = "Simple task"

    crew = _mock_crew_with_task(fox_tracer, task_output)
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "task:Simple task" in spans
    assert "task.output" not in spans["task:Simple task"]["attributes"]


# ---------------------------------------------------------------------------
# Parent span linkage (legacy — no agent attribution)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_step_is_child_of_workflow():
    """Steps without agent info are linked to the workflow span."""
    fox_tracer, flushed = _make_tracer()
    crew = _mock_crew_with_step(
        fox_tracer,
        {"action": "web_search", "action_input": "foxhound"},
    )
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    workflow_id = spans["crew"]["spanId"]
    assert spans["tool:web_search"]["parentSpanId"] == workflow_id


@pytest.mark.asyncio
async def test_task_is_child_of_workflow():
    """Tasks without agent info are linked to the workflow span."""
    fox_tracer, flushed = _make_tracer()
    crew = _mock_crew_with_task(
        fox_tracer,
        {"description": "Summarise docs", "raw": "Summary here."},
    )
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    workflow_id = spans["crew"]["spanId"]
    assert spans["task:Summarise docs"]["parentSpanId"] == workflow_id


@pytest.mark.asyncio
async def test_step_outside_kickoff_has_no_parent():
    """on_step() called outside kickoff produces a root-level span (no parent)."""
    fox_tracer, flushed = _make_tracer()
    fox_tracer.on_step({"action": "standalone_tool", "action_input": "x"})
    await fox_tracer.flush()

    spans = flushed[0]["spans"]
    tool_span = next(s for s in spans if s["name"] == "tool:standalone_tool")
    assert "parentSpanId" not in tool_span


# ---------------------------------------------------------------------------
# Cross-agent trace correlation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_multi_agent_creates_agent_spans():
    """Steps from different agents produce agent-level spans under workflow."""
    fox_tracer, flushed = _make_tracer()

    researcher_agent = MagicMock()
    researcher_agent.role = "Researcher"

    writer_agent = MagicMock()
    writer_agent.role = "Writer"

    def kickoff(inputs=None):
        # Researcher does work
        fox_tracer.on_step({"action": "web_search", "action_input": "topic", "agent": researcher_agent})
        fox_tracer.on_task(MagicMock(description="Research topic", raw="Found info", agent=researcher_agent))
        # Writer does work
        fox_tracer.on_step({"action": "file_write", "action_input": "report.md", "agent": writer_agent})
        fox_tracer.on_task(MagicMock(description="Write report", raw="Report done", agent=writer_agent))
        return "complete"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)

    # Agent-level spans exist
    assert "agent:Researcher" in spans
    assert "agent:Writer" in spans

    # Agent spans are children of workflow
    workflow_id = spans["crew"]["spanId"]
    assert spans["agent:Researcher"]["parentSpanId"] == workflow_id
    assert spans["agent:Writer"]["parentSpanId"] == workflow_id

    # Steps are children of their respective agent spans
    researcher_id = spans["agent:Researcher"]["spanId"]
    writer_id = spans["agent:Writer"]["spanId"]
    assert spans["tool:web_search"]["parentSpanId"] == researcher_id
    assert spans["task:Research topic"]["parentSpanId"] == researcher_id
    assert spans["tool:file_write"]["parentSpanId"] == writer_id
    assert spans["task:Write report"]["parentSpanId"] == writer_id


@pytest.mark.asyncio
async def test_agent_span_reused_for_same_agent():
    """Multiple steps from the same agent reuse the same agent span."""
    fox_tracer, flushed = _make_tracer()

    agent = MagicMock()
    agent.role = "Researcher"

    def kickoff(inputs=None):
        fox_tracer.on_step({"action": "search_1", "action_input": "q1", "agent": agent})
        fox_tracer.on_step({"action": "search_2", "action_input": "q2", "agent": agent})
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = flushed[0]["spans"]
    agent_spans = [s for s in spans if s["name"] == "agent:Researcher"]
    assert len(agent_spans) == 1  # only one agent span created

    agent_id = agent_spans[0]["spanId"]
    tool_spans = [s for s in spans if s["kind"] == "tool_call"]
    for ts in tool_spans:
        assert ts["parentSpanId"] == agent_id


@pytest.mark.asyncio
async def test_set_active_agent_explicit():
    """set_active_agent() creates agent span and parents subsequent steps."""
    fox_tracer, flushed = _make_tracer()

    def kickoff(inputs=None):
        fox_tracer.set_active_agent("CustomAgent")
        fox_tracer.on_step({"action": "tool_a", "action_input": "x"})
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "agent:CustomAgent" in spans
    agent_id = spans["agent:CustomAgent"]["spanId"]
    assert spans["tool:tool_a"]["parentSpanId"] == agent_id


@pytest.mark.asyncio
async def test_agent_name_from_task_output_object():
    """Agent name extracted from TaskOutput.agent.role."""
    fox_tracer, flushed = _make_tracer()

    task_output = MagicMock()
    task_output.description = "Analyze data"
    task_output.raw = "Analysis complete"
    task_output.agent = MagicMock()
    task_output.agent.role = "DataAnalyst"

    crew = _mock_crew_with_task(fox_tracer, task_output)
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "agent:DataAnalyst" in spans
    assert spans["task:Analyze data"]["parentSpanId"] == spans["agent:DataAnalyst"]["spanId"]
    assert spans["task:Analyze data"]["attributes"]["task.agent"] == "DataAnalyst"


@pytest.mark.asyncio
async def test_agent_name_from_dict_string():
    """Agent name extracted from dict payload with string agent value."""
    fox_tracer, flushed = _make_tracer()

    def kickoff(inputs=None):
        fox_tracer.on_step({"action": "search", "action_input": "q", "agent": "Researcher"})
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert "agent:Researcher" in spans
    assert spans["tool:search"]["parentSpanId"] == spans["agent:Researcher"]["spanId"]


@pytest.mark.asyncio
async def test_agent_spans_ended_on_kickoff_completion():
    """Agent spans are properly ended when kickoff completes."""
    fox_tracer, flushed = _make_tracer()

    agent = MagicMock()
    agent.role = "Worker"

    def kickoff(inputs=None):
        fox_tracer.on_step({"action": "work", "action_input": "x", "agent": agent})
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    assert spans["agent:Worker"]["status"] == "ok"
    assert spans["agent:Worker"]["endTimeMs"] is not None


@pytest.mark.asyncio
async def test_agent_spans_ended_on_error():
    """Agent spans are ended even when kickoff fails."""
    fox_tracer, flushed = _make_tracer()

    agent = MagicMock()
    agent.role = "Worker"

    def kickoff(inputs=None):
        fox_tracer.on_step({"action": "work", "action_input": "x", "agent": agent})
        raise RuntimeError("boom")

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff

    with pytest.raises(RuntimeError):
        fox_tracer.kickoff(crew)

    await fox_tracer.flush()
    spans = _spans_by_name(flushed)
    assert spans["agent:Worker"]["status"] == "ok"
    assert spans["agent:Worker"]["endTimeMs"] is not None


@pytest.mark.asyncio
async def test_mixed_agent_and_no_agent_steps():
    """Steps with and without agent info coexist correctly."""
    fox_tracer, flushed = _make_tracer()

    agent = MagicMock()
    agent.role = "Researcher"

    def kickoff(inputs=None):
        # Step without agent info → child of workflow
        fox_tracer.on_step({"action": "global_tool", "action_input": "x"})
        # Step with agent info → child of agent span
        fox_tracer.on_step({"action": "agent_tool", "action_input": "y", "agent": agent})
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    workflow_id = spans["crew"]["spanId"]
    researcher_id = spans["agent:Researcher"]["spanId"]

    # global_tool has no agent → parented to workflow
    assert spans["tool:global_tool"]["parentSpanId"] == workflow_id
    # agent_tool has agent → parented to agent span
    assert spans["tool:agent_tool"]["parentSpanId"] == researcher_id


@pytest.mark.asyncio
async def test_active_agent_carries_forward():
    """Once an agent is set, subsequent steps without explicit agent use it."""
    fox_tracer, flushed = _make_tracer()

    agent = MagicMock()
    agent.role = "Writer"

    def kickoff(inputs=None):
        # First step sets the active agent
        fox_tracer.on_step({"action": "draft", "action_input": "x", "agent": agent})
        # Second step has no agent but should use the active one
        fox_tracer.on_step({"action": "edit", "action_input": "y"})
        return "done"

    crew = MagicMock()
    crew.kickoff.side_effect = kickoff
    fox_tracer.kickoff(crew)
    await fox_tracer.flush()

    spans = _spans_by_name(flushed)
    writer_id = spans["agent:Writer"]["spanId"]
    assert spans["tool:draft"]["parentSpanId"] == writer_id
    assert spans["tool:edit"]["parentSpanId"] == writer_id


# ---------------------------------------------------------------------------
# Trace ID accessibility
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trace_id_accessible():
    """trace_id returns a non-empty string."""
    fox_tracer, _ = _make_tracer()
    assert isinstance(fox_tracer.trace_id, str)
    assert fox_tracer.trace_id
