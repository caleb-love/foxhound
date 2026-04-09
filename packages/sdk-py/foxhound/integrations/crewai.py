"""
CrewAI integration for the Fox observability SDK.

Instruments CrewAI crews by hooking into the step/task callback system
and wrapping the kickoff call to produce structured Fox traces.

Cross-agent trace correlation
-----------------------------
When a crew contains multiple agents, each agent gets its own ``"agent_step"``
span under the root ``"workflow"`` span.  Steps and tasks produced by that
agent are recorded as children of the agent span, producing a trace tree::

    workflow (crew)
    ├── agent:Researcher
    │   ├── tool:web_search
    │   └── task:Research the topic
    └── agent:Writer
        ├── tool:file_write
        └── task:Write the report

Agent identity is extracted from CrewAI callback payloads (``agent`` attribute
on TaskOutput, ``agent`` key in dicts) or can be set explicitly via
:meth:`set_active_agent`.

Usage::

    from foxhound import FoxhoundClient
    from foxhound.integrations.crewai import FoxCrewTracer

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
    tracer = FoxCrewTracer.from_client(fox, agent_id="my-crew")

    crew = Crew(
        agents=[researcher, writer],
        tasks=[research_task, write_task],
        step_callback=tracer.on_step,
        task_callback=tracer.on_task,
    )

    # Synchronous kickoff
    result = tracer.kickoff(crew, inputs={"topic": "AI safety"})
    tracer.flush_sync()

    # Async kickoff
    result = await tracer.kickoff_async(crew, inputs={"topic": "AI safety"})
    await tracer.flush()

Requires: ``pip install foxhound-ai[crewai]``
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from foxhound.tracer import ActiveSpan, Tracer

if TYPE_CHECKING:
    from foxhound.client import FoxhoundClient

logger = logging.getLogger(__name__)


class FoxCrewTracer:
    """
    Instruments a CrewAI Crew to emit Fox traces.

    Span-kind mapping
    -----------------
    - Crew kickoff        → ``"workflow"`` (root)
    - Agent execution     → ``"agent_step"`` (per-agent, child of workflow)
    - Task completion     → ``"agent_step"`` (child of agent span)
    - Agent step / tool   → ``"tool_call"`` or ``"agent_step"`` (child of agent span)

    Thread / async safety
    ---------------------
    One ``FoxCrewTracer`` instance should be used per crew invocation.
    CrewAI may call step/task callbacks from threads; span writes are
    safe on CPython due to the GIL.

    Usage
    -----
    Pass ``tracer.on_step`` as ``step_callback`` and ``tracer.on_task`` as
    ``task_callback`` when constructing your Crew, then run the crew
    through ``tracer.kickoff()`` or ``tracer.kickoff_async()`` so the
    top-level workflow span is properly opened and closed.
    """

    def __init__(self, tracer: Tracer) -> None:
        self._tracer = tracer
        self._workflow_span: ActiveSpan | None = None
        self._step_count: int = 0
        # Cross-agent correlation: agent_name → ActiveSpan
        self._agent_spans: dict[str, ActiveSpan] = {}
        self._active_agent: str | None = None

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_client(
        cls,
        client: "FoxhoundClient",
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "FoxCrewTracer":
        """Create a tracer from a ``FoxhoundClient`` instance."""
        tracer = client.start_trace(
            agent_id=agent_id,
            session_id=session_id,
            metadata=metadata,
        )
        return cls(tracer)

    # ------------------------------------------------------------------
    # Public flush API
    # ------------------------------------------------------------------

    async def flush(self) -> None:
        """Flush the trace to the Fox API (async)."""
        self._end_all_agent_spans()
        await self._tracer.flush()

    def flush_sync(self) -> None:
        """Flush the trace to the Fox API (sync)."""
        self._end_all_agent_spans()
        self._tracer.flush_sync()

    @property
    def trace_id(self) -> str:
        return self._tracer.trace_id

    # ------------------------------------------------------------------
    # Agent tracking
    # ------------------------------------------------------------------

    def set_active_agent(self, agent_name: str) -> None:
        """Explicitly set the currently active agent for span parenting."""
        self._active_agent = agent_name
        self._get_or_create_agent_span(agent_name)

    def _get_or_create_agent_span(self, agent_name: str) -> ActiveSpan:
        """Lazily create an agent-level span as a child of the workflow."""
        if agent_name in self._agent_spans:
            return self._agent_spans[agent_name]

        parent_span_id = self._workflow_span.span_id if self._workflow_span else None
        span = self._tracer.start_span(
            name=f"agent:{agent_name}",
            kind="agent_step",
            parent_span_id=parent_span_id,
        )
        span.set_attribute("agent.name", agent_name)
        self._agent_spans[agent_name] = span
        return span

    def _end_all_agent_spans(self) -> None:
        """End any still-open agent spans before flushing."""
        for span in self._agent_spans.values():
            if span._span.end_time_ms is None:
                span.end("ok")
        self._agent_spans.clear()
        self._active_agent = None

    def _resolve_parent_span_id(self, agent_name: str | None = None) -> str | None:
        """Determine the parent span ID for a step/task span.

        If an agent name is provided or active, the step becomes a child of
        that agent's span.  Otherwise falls back to the workflow span.
        """
        name = agent_name or self._active_agent
        if name:
            agent_span = self._get_or_create_agent_span(name)
            return agent_span.span_id
        if self._workflow_span:
            return self._workflow_span.span_id
        return None

    # ------------------------------------------------------------------
    # Kickoff wrappers
    # ------------------------------------------------------------------

    def kickoff(self, crew: Any, inputs: dict[str, Any] | None = None) -> Any:
        """
        Wrap ``crew.kickoff()`` with a top-level ``"workflow"`` span.

        The span is open for the entire duration of kickoff, so any
        ``on_step`` / ``on_task`` callbacks fired during execution are
        recorded as children.
        """
        span = self._tracer.start_span(name="crew", kind="workflow")
        self._workflow_span = span
        if inputs:
            span.set_attribute("crew.input_keys", ",".join(str(k) for k in inputs.keys()))
        try:
            result = crew.kickoff(inputs=inputs or {})
            self._end_all_agent_spans()
            span.end("ok")
            return result
        except Exception as exc:
            self._end_all_agent_spans()
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise
        finally:
            self._workflow_span = None

    async def kickoff_async(self, crew: Any, inputs: dict[str, Any] | None = None) -> Any:
        """Async variant of :meth:`kickoff`."""
        span = self._tracer.start_span(name="crew", kind="workflow")
        self._workflow_span = span
        if inputs:
            span.set_attribute("crew.input_keys", ",".join(str(k) for k in inputs.keys()))
        try:
            result = await crew.kickoff_async(inputs=inputs or {})
            self._end_all_agent_spans()
            span.end("ok")
            return result
        except Exception as exc:
            self._end_all_agent_spans()
            span.add_event("error", {"message": str(exc), "type": type(exc).__name__})
            span.end("error")
            raise
        finally:
            self._workflow_span = None

    # ------------------------------------------------------------------
    # CrewAI callbacks
    # ------------------------------------------------------------------

    def on_step(self, step_output: Any) -> None:
        """
        ``step_callback`` for CrewAI.

        CrewAI calls this after each agent action.  The payload varies
        by version:

        - dict with ``"action"`` / ``"observation"`` keys (older versions)
        - ``AgentAction``-like object with ``tool``, ``tool_input``, ``log``
        - ``AgentFinish``-like object with ``return_values``
        - CrewAI-internal step objects (0.80+)

        When a tool name is detectable the span gets kind ``"tool_call"``;
        otherwise it falls back to ``"agent_step"``.

        Agent attribution is extracted from the payload when available,
        otherwise the current ``_active_agent`` is used.
        """
        agent_name = _extract_agent_name(step_output)
        if agent_name:
            self._active_agent = agent_name

        parent_span_id = self._resolve_parent_span_id(agent_name)
        self._step_count += 1
        step_name, kind, attributes = _parse_step_output(step_output, self._step_count)

        span = self._tracer.start_span(
            name=step_name,
            kind=kind,
            parent_span_id=parent_span_id,
        )
        for key, value in attributes.items():
            span.set_attribute(key, value)
        span.end("ok")

    def on_task(self, task_output: Any) -> None:
        """
        ``task_callback`` for CrewAI.

        Called when a task finishes.  Records an ``"agent_step"`` span
        summarising the task result.  If the task output contains agent
        information, the span is nested under that agent's span.
        """
        agent_name = _extract_agent_name(task_output)
        if agent_name:
            self._active_agent = agent_name

        parent_span_id = self._resolve_parent_span_id(agent_name)
        description, raw_output = _parse_task_output(task_output)
        span = self._tracer.start_span(
            name=f"task:{_truncate(description, 64)}",
            kind="agent_step",
            parent_span_id=parent_span_id,
        )
        if raw_output:
            span.set_attribute("task.output", _truncate(raw_output, 1024))
        if agent_name:
            span.set_attribute("task.agent", agent_name)
        span.end("ok")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_agent_name(payload: Any) -> str | None:
    """Try to extract an agent name from a CrewAI callback payload.

    CrewAI TaskOutput objects have an ``agent`` attribute (the agent's role
    string or an Agent object with a ``role`` attribute).  Dict payloads
    may contain an ``"agent"`` key.
    """
    if isinstance(payload, dict):
        agent = payload.get("agent")
        if agent is not None:
            # Could be an Agent object or a string
            role = getattr(agent, "role", None)
            return str(role) if role else str(agent) if agent else None
        return None

    # Object-based payload (TaskOutput, step objects)
    agent = getattr(payload, "agent", None)
    if agent is not None:
        role = getattr(agent, "role", None)
        return str(role) if role else str(agent) if agent else None

    return None


def _parse_step_output(
    step_output: Any,
    step_index: int,
) -> tuple[str, str, dict[str, Any]]:
    """
    Extract ``(name, kind, attributes)`` from a CrewAI step callback payload.

    Handles the most common representations found across CrewAI versions.
    Unknown types fall back to a generic ``agent_step`` span.
    """
    attributes: dict[str, Any] = {}

    # --- dict-based payload (some CrewAI versions / custom wrappers) ---
    if isinstance(step_output, dict):
        tool = (
            step_output.get("action")
            or step_output.get("tool")
            or step_output.get("name")
        )
        if tool:
            attributes["tool.name"] = str(tool)
            tool_input = (
                step_output.get("action_input")
                or step_output.get("tool_input")
                or step_output.get("input")
            )
            if tool_input is not None:
                attributes["tool.input"] = _truncate(str(tool_input), 1024)
            observation = step_output.get("observation") or step_output.get("output")
            if observation is not None:
                attributes["tool.output"] = _truncate(str(observation), 1024)
            return f"tool:{tool}", "tool_call", attributes

        return f"step:{step_index}", "agent_step", attributes

    # --- object with .tool (LangChain AgentAction-like) ---
    tool = getattr(step_output, "tool", None)
    if tool:
        attributes["tool.name"] = str(tool)
        tool_input = getattr(step_output, "tool_input", None)
        if tool_input is not None:
            attributes["tool.input"] = _truncate(str(tool_input), 1024)
        observation = getattr(step_output, "observation", None) or getattr(
            step_output, "output", None
        )
        if observation is not None:
            attributes["tool.output"] = _truncate(str(observation), 1024)
        log = getattr(step_output, "log", None)
        if log:
            attributes["agent.thought"] = _truncate(str(log), 1024)
        return f"tool:{tool}", "tool_call", attributes

    # --- object with .return_values (LangChain AgentFinish-like) ---
    return_values = getattr(step_output, "return_values", None)
    if return_values is not None:
        attributes["agent.return_values"] = _truncate(str(return_values), 1024)
        log = getattr(step_output, "log", None)
        if log:
            attributes["agent.thought"] = _truncate(str(log), 512)
        return f"step:{step_index}:finish", "agent_step", attributes

    # --- Unknown payload — record as generic step ---
    try:
        attributes["raw"] = _truncate(str(step_output), 512)
    except Exception:
        pass
    return f"step:{step_index}", "agent_step", attributes


def _parse_task_output(task_output: Any) -> tuple[str, str]:
    """Return ``(description, raw_output)`` from a CrewAI TaskOutput or dict."""
    if isinstance(task_output, dict):
        description = (
            task_output.get("description") or task_output.get("name") or "task"
        )
        raw_output = task_output.get("raw") or task_output.get("output") or ""
        return str(description), str(raw_output)

    description = (
        getattr(task_output, "description", None)
        or getattr(task_output, "name", None)
        or "task"
    )
    raw_output = (
        getattr(task_output, "raw", None) or getattr(task_output, "output", None) or ""
    )
    return str(description), str(raw_output)


def _truncate(s: str, max_len: int) -> str:
    return s[:max_len] if len(s) > max_len else s
