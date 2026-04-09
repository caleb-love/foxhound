"""
OpenAI Agents SDK integration for the Fox observability SDK.

Instruments OpenAI Agents SDK runs by hooking into the SDK's ``TracingProcessor``
system to produce structured Fox traces.

Cross-agent trace correlation
-----------------------------
The OpenAI Agents SDK nests spans hierarchically.  Fox preserves that
hierarchy by mapping OpenAI span IDs to Fox span IDs as spans open and close::

    workflow  (root agent)
    ├── llm_call  (generation / response)
    ├── tool_call  (function call)
    ├── agent_step  (handoff target)
    │   ├── llm_call
    │   └── tool_call
    └── agent_step  (guardrail)

Usage::

    from foxhound import FoxhoundClient
    from foxhound.integrations.openai_agents import instrument

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

    # One-line auto-instrumentation
    processor = instrument(fox, agent_id="my-openai-agent")

    # Run agents normally — all spans are captured automatically
    from agents import Runner
    result = await Runner.run(my_agent, "Hello!")
    await processor.flush()

    # Or use the class for more control
    from foxhound.integrations.openai_agents import FoxOpenAIAgentsProcessor
    processor = FoxOpenAIAgentsProcessor.from_client(fox, agent_id="my-agent")
    processor.instrument()
    result = await Runner.run(my_agent, "Hello!")
    await processor.flush()

Requires: ``pip install foxhound-ai[openai-agents]``
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from foxhound.tracer import ActiveSpan, SpanKind, Tracer

if TYPE_CHECKING:
    from foxhound.client import FoxhoundClient

logger = logging.getLogger(__name__)


class FoxOpenAIAgentsProcessor:
    """
    OpenAI Agents SDK ``TracingProcessor`` that maps SDK spans to Fox trace spans.

    Span-kind mapping
    -----------------
    - Root agent execution        → ``"workflow"``
    - Nested agent execution      → ``"agent_step"``
    - Function / tool calls       → ``"tool_call"``
    - LLM generations / responses → ``"llm_call"``
    - Handoffs between agents     → ``"agent_step"``
    - Guardrail evaluations       → ``"agent_step"``

    Thread / async safety
    ---------------------
    The OpenAI Agents SDK may call processor methods from threads or async
    contexts.  Span state is stored in plain dicts which are safe on CPython
    due to the GIL.  Use one processor instance per logical agent session.

    Usage
    -----
    Call :meth:`instrument` once to register this processor globally with the
    OpenAI Agents SDK.  Run your agents normally; every span is captured
    automatically.  Call :meth:`flush` or :meth:`flush_sync` to submit the
    trace to Fox.
    """

    def __init__(self, tracer: Tracer) -> None:
        self._tracer = tracer
        # openai span_id → Fox ActiveSpan (in-flight)
        self._active: dict[str, ActiveSpan] = {}
        # openai span_id → Fox span_id (completed, for parent resolution)
        self._completed: dict[str, str] = {}

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
    ) -> "FoxOpenAIAgentsProcessor":
        """Create a processor from a ``FoxhoundClient`` instance."""
        tracer = client.start_trace(
            agent_id=agent_id,
            session_id=session_id,
            metadata=metadata,
        )
        return cls(tracer)

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def instrument(self) -> None:
        """Register this processor with the OpenAI Agents SDK tracing system.

        Raises ``ImportError`` if ``openai-agents`` is not installed.
        """
        try:
            from agents.tracing import add_trace_processor
        except ImportError as exc:
            raise ImportError(
                "openai-agents is required for this integration: "
                "pip install foxhound-ai[openai-agents]"
            ) from exc
        add_trace_processor(self)

    # ------------------------------------------------------------------
    # Public flush API
    # ------------------------------------------------------------------

    async def flush(self) -> None:
        """Flush the trace to the Fox API (async)."""
        self._end_open_spans()
        await self._tracer.flush()

    def flush_sync(self) -> None:
        """Flush the trace to the Fox API (sync)."""
        self._end_open_spans()
        self._tracer.flush_sync()

    @property
    def trace_id(self) -> str:
        return self._tracer.trace_id

    # ------------------------------------------------------------------
    # TracingProcessor protocol
    # ------------------------------------------------------------------

    def on_trace_start(self, trace: Any) -> None:
        """Called when a new trace context starts."""
        pass  # Fox trace already initialized; nothing to do here.

    def on_trace_end(self, trace: Any) -> None:
        """Called when a trace context ends."""
        pass  # Flush is handled manually via flush() / flush_sync().

    def on_span_start(self, span: Any) -> None:
        """Open a Fox span when the SDK span starts."""
        try:
            fox_span = self._open_span(span)
            self._active[span.span_id] = fox_span
        except Exception:
            logger.exception("FoxOpenAIAgentsProcessor: error in on_span_start")

    def on_span_end(self, span: Any) -> None:
        """Close and annotate the Fox span when the SDK span ends."""
        try:
            fox_span = self._active.pop(span.span_id, None)
            if fox_span is None:
                return
            self._apply_attributes(fox_span, span)
            error = span.error
            if error:
                msg = error.get("message", str(error)) if isinstance(error, dict) else str(error)
                data = error.get("data") if isinstance(error, dict) else None
                event_attrs: dict[str, Any] = {"message": msg}
                if data is not None:
                    event_attrs["data"] = _truncate(str(data), 512)
                fox_span.add_event("error", event_attrs)
            fox_span.end("error" if error else "ok")
            self._completed[span.span_id] = fox_span.span_id
        except Exception:
            logger.exception("FoxOpenAIAgentsProcessor: error in on_span_end")

    def shutdown(self) -> None:
        """Called when the SDK is shutting down."""
        pass

    def force_flush(self) -> None:
        """Force flush pending items."""
        pass

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fox_parent_span_id(self, openai_parent_id: str | None) -> str | None:
        """Resolve an OpenAI span_id to its Fox counterpart."""
        if openai_parent_id is None:
            return None
        active = self._active.get(openai_parent_id)
        if active is not None:
            return active.span_id
        return self._completed.get(openai_parent_id)

    def _open_span(self, span: Any) -> ActiveSpan:
        """Create and return a Fox span for the given OpenAI SDK span."""
        kind, name = _classify_span(span.span_data)
        parent_fox_id = self._fox_parent_span_id(span.parent_id)
        # Root agent spans with no Fox parent → workflow root
        if parent_fox_id is None and _span_type(span.span_data) == "agent":
            kind = "workflow"
        return self._tracer.start_span(
            name=name,
            kind=kind,
            parent_span_id=parent_fox_id,
        )

    def _apply_attributes(self, fox_span: ActiveSpan, span: Any) -> None:
        """Attach span-type-specific metadata to the Fox span."""
        data = span.span_data
        span_type = _span_type(data)

        if span_type == "agent":
            fox_span.set_attribute("agent.name", str(data.name))
            if data.tools:
                fox_span.set_attribute("agent.tools", ",".join(str(t) for t in data.tools))
            if data.handoffs:
                fox_span.set_attribute("agent.handoffs", ",".join(str(h) for h in data.handoffs))
            if data.output_type:
                fox_span.set_attribute("agent.output_type", str(data.output_type))

        elif span_type == "function":
            fox_span.set_attribute("tool.name", str(data.name))
            if data.input is not None:
                fox_span.set_attribute("tool.input", _truncate(str(data.input), 1024))
            if data.output is not None:
                fox_span.set_attribute("tool.output", _truncate(str(data.output), 1024))

        elif span_type == "generation":
            if data.model:
                fox_span.set_attribute("llm.model", str(data.model))
            usage = data.usage
            if isinstance(usage, dict):
                for key in ("input_tokens", "output_tokens"):
                    if key in usage:
                        fox_span.set_attribute(f"llm.{key}", usage[key])

        elif span_type == "response":
            response = data.response
            if response is not None:
                model = getattr(response, "model", None)
                if model:
                    fox_span.set_attribute("llm.model", str(model))
                usage = getattr(response, "usage", None)
                if usage is not None:
                    in_tok = getattr(usage, "input_tokens", None)
                    out_tok = getattr(usage, "output_tokens", None)
                    if in_tok is not None:
                        fox_span.set_attribute("llm.input_tokens", in_tok)
                    if out_tok is not None:
                        fox_span.set_attribute("llm.output_tokens", out_tok)

        elif span_type == "handoff":
            if data.from_agent:
                fox_span.set_attribute("handoff.from_agent", str(data.from_agent))
            if data.to_agent:
                fox_span.set_attribute("handoff.to_agent", str(data.to_agent))

        elif span_type == "guardrail":
            fox_span.set_attribute("guardrail.name", str(data.name))
            fox_span.set_attribute("guardrail.triggered", bool(data.triggered))

        elif span_type == "custom":
            name = getattr(data, "name", None)
            if name:
                fox_span.set_attribute("custom.name", str(name))
            custom_data = getattr(data, "data", None)
            if isinstance(custom_data, dict):
                for k, v in custom_data.items():
                    fox_span.set_attribute(f"custom.{k}", _truncate(str(v), 512))

    def _end_open_spans(self) -> None:
        """End any still-open spans (safety cleanup before flush)."""
        for fox_span in self._active.values():
            if fox_span._span.end_time_ms is None:
                fox_span.end("ok")
        self._active.clear()


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------


def instrument(
    client: "FoxhoundClient",
    agent_id: str,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> FoxOpenAIAgentsProcessor:
    """One-line auto-instrumentation for the OpenAI Agents SDK.

    Registers a :class:`FoxOpenAIAgentsProcessor` with the SDK's global tracing
    system.  Every subsequent agent run is captured automatically.

    Args:
        client:     An initialised :class:`~foxhound.client.FoxhoundClient`.
        agent_id:   Identifier for the agent or service being traced.
        session_id: Optional session / conversation identifier.
        metadata:   Optional key-value metadata attached to the trace.

    Returns:
        The registered processor — call :meth:`~FoxOpenAIAgentsProcessor.flush`
        (or :meth:`~FoxOpenAIAgentsProcessor.flush_sync`) when done.

    Raises:
        ImportError: If ``openai-agents`` is not installed.
    """
    processor = FoxOpenAIAgentsProcessor.from_client(
        client,
        agent_id=agent_id,
        session_id=session_id,
        metadata=metadata,
    )
    processor.instrument()
    return processor


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _span_type(data: Any) -> str:
    """Return the span type string from a span data object."""
    return getattr(data, "type", "") or ""


def _classify_span(data: Any) -> tuple[SpanKind, str]:
    """Return ``(fox_kind, span_name)`` for an OpenAI Agents SDK span data object."""
    span_type = _span_type(data)

    if span_type == "agent":
        name = getattr(data, "name", None) or "agent"
        return "agent_step", f"agent:{name}"

    if span_type == "function":
        name = getattr(data, "name", None) or "tool"
        return "tool_call", f"tool:{name}"

    if span_type in ("generation", "response"):
        model = getattr(data, "model", None)
        if not model and span_type == "response":
            response = getattr(data, "response", None)
            model = getattr(response, "model", None) if response else None
        label = str(model) if model else "llm"
        return "llm_call", f"llm:{label}"

    if span_type == "handoff":
        from_agent = getattr(data, "from_agent", None) or "?"
        to_agent = getattr(data, "to_agent", None) or "?"
        return "agent_step", f"handoff:{from_agent}->{to_agent}"

    if span_type == "guardrail":
        name = getattr(data, "name", None) or "guardrail"
        return "agent_step", f"guardrail:{name}"

    # Custom or unknown
    name = getattr(data, "name", None) or span_type or "span"
    return "custom", str(name)


def _truncate(s: str, max_len: int) -> str:
    return s[:max_len] if len(s) > max_len else s
