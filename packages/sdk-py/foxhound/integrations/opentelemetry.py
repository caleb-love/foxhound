"""
OpenTelemetry SpanProcessor bridge for the Foxhound observability SDK.

This module bridges the OpenTelemetry SDK's ``SpanProcessor`` interface to
Foxhound's native trace model, enabling automatic instrumentation of any
framework that emits OpenTelemetry GenAI semantic convention spans.

Supported frameworks (single import, zero framework code changes):

**Pydantic AI**::

    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from foxhound import FoxhoundClient
    from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
    processor = FoxhoundSpanProcessor.from_client(fox, agent_id="my-pydantic-agent")

    provider = TracerProvider()
    provider.add_span_processor(processor)

    from opentelemetry import trace
    trace.set_tracer_provider(provider)

    # Run Pydantic AI agents normally — spans are captured automatically

**Amazon Bedrock AgentCore / AWS ADOT**::

    from foxhound import FoxhoundClient
    from foxhound.integrations.opentelemetry import (
        FoxhoundSpanProcessor,
        configure_adot_for_foxhound,
    )

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
    processor = FoxhoundSpanProcessor.from_client(fox, agent_id="bedrock-agent")

    # Or use the ADOT convenience helper:
    configure_adot_for_foxhound(
        agent_id="bedrock-agent",
        foxhound_endpoint="https://your-foxhound-instance.com",
        api_key="fox_...",
    )

**Google ADK**::

    from opentelemetry.sdk.trace import TracerProvider
    from foxhound import FoxhoundClient
    from foxhound.integrations.opentelemetry import FoxhoundSpanProcessor

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")
    processor = FoxhoundSpanProcessor.from_client(fox, agent_id="google-adk-agent")

    provider = TracerProvider()
    provider.add_span_processor(processor)

    from opentelemetry import trace
    trace.set_tracer_provider(provider)

Requires: ``pip install foxhound-ai[opentelemetry]``

GenAI semantic convention mapping
----------------------------------
The bridge maps OpenTelemetry GenAI semantic conventions
(https://opentelemetry.io/docs/specs/semconv/gen-ai/) to Foxhound span kinds:

- ``gen_ai.operation.name == "chat"``              → ``"llm_call"``
- ``gen_ai.operation.name == "text_completion"``   → ``"llm_call"``
- ``gen_ai.operation.name == "embeddings"``        → ``"tool_call"``
- span name starts with ``"agent"``                → ``"agent_step"``
- span name starts with ``"tool"``                 → ``"tool_call"``
- all others                                       → ``"workflow"``

Attribute mapping
-----------------
- ``gen_ai.request.model``      → ``llm.model``
- ``gen_ai.usage.input_tokens`` → ``llm.prompt_tokens``
- ``gen_ai.usage.output_tokens``→ ``llm.completion_tokens``
- ``gen_ai.usage.total_tokens`` → ``llm.total_tokens``
- ``gen_ai.prompt``             → ``agent.prompt`` (truncated to 512 chars)
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from foxhound.tracer import ActiveSpan, SpanKind, Tracer

if TYPE_CHECKING:
    from foxhound.client import FoxhoundClient

logger = logging.getLogger(__name__)

# Maximum length for prompt content stored in spans — matches the existing
# integration truncation pattern used across other bridge modules.
_PROMPT_MAX_LEN = 512


class FoxhoundSpanProcessor:
    """
    OpenTelemetry ``SpanProcessor`` that maps GenAI semantic convention spans
    to Foxhound trace spans.

    Span-kind mapping
    -----------------
    - ``gen_ai.operation.name == "chat"``            → ``"llm_call"``
    - ``gen_ai.operation.name == "text_completion"`` → ``"llm_call"``
    - ``gen_ai.operation.name == "embeddings"``      → ``"tool_call"``
    - span name prefix ``"agent"``                   → ``"agent_step"``
    - span name prefix ``"tool"``                    → ``"tool_call"``
    - all others                                     → ``"workflow"``

    Thread safety
    -------------
    OTel SDK may call span processor methods from multiple threads.  Span state
    is stored in a plain ``dict`` keyed by OTel span_id (an integer).  On
    CPython, dict reads and writes are GIL-safe for concurrent access.  Use
    one processor instance per logical agent session (same pattern as
    :class:`~foxhound.integrations.langgraph.FoxCallbackHandler`).

    Observability
    -------------
    Span mapping decisions are logged at ``DEBUG`` level via
    ``logging.getLogger(__name__)``.  Errors in ``on_end`` are logged as
    ``ERROR`` with span name and error detail so they are visible without
    crashing the caller.  Malformed spans (missing trace_id) are logged as
    ``WARNING`` and skipped.
    """

    def __init__(self, tracer: Tracer) -> None:
        self._tracer = tracer
        # OTel span_id (int) → Fox ActiveSpan (in-flight)
        self._span_map: dict[int, ActiveSpan] = {}

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
    ) -> "FoxhoundSpanProcessor":
        """Create a processor from a :class:`~foxhound.client.FoxhoundClient` instance.

        Args:
            client:     An initialised :class:`~foxhound.client.FoxhoundClient`.
            agent_id:   Identifier for the agent or service being traced.
            session_id: Optional session / conversation identifier.
            metadata:   Optional key-value metadata attached to the trace.

        Returns:
            A :class:`FoxhoundSpanProcessor` ready to be registered with an
            OpenTelemetry :class:`~opentelemetry.sdk.trace.TracerProvider`.
        """
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
        await self._tracer.flush()

    def flush_sync(self) -> None:
        """Flush the trace to the Fox API (sync)."""
        self._tracer.flush_sync()

    @property
    def trace_id(self) -> str:
        return self._tracer.trace_id

    # ------------------------------------------------------------------
    # SpanProcessor protocol
    # ------------------------------------------------------------------

    def on_start(self, span: Any, parent_context: Any = None) -> None:
        """Called when an OTel span starts.

        Creates a corresponding Fox span and stores the mapping keyed by the
        OTel span's integer ``span_id``.

        Args:
            span:           The OTel :class:`~opentelemetry.sdk.trace.ReadWriteSpan`.
            parent_context: The OTel :class:`~opentelemetry.context.Context`
                            in which the span started (may be ``None``).
        """
        try:
            ctx = span.get_span_context()
            if ctx is None or not ctx.trace_id:
                logger.warning(
                    "FoxhoundSpanProcessor: span '%s' has no trace_id — skipping",
                    getattr(span, "name", "<unknown>"),
                )
                return

            otel_span_id: int = ctx.span_id
            parent_fox_id = self._resolve_parent(span)
            kind = self._semantic_to_fox_kind(span)
            name = getattr(span, "name", None) or "span"

            logger.debug(
                "FoxhoundSpanProcessor.on_start: span=%r kind=%r parent_fox_id=%r otel_id=%s",
                name,
                kind,
                parent_fox_id,
                otel_span_id,
            )

            fox_span = self._tracer.start_span(
                name=name,
                kind=kind,
                parent_span_id=parent_fox_id,
            )
            self._span_map[otel_span_id] = fox_span
        except Exception:
            logger.exception(
                "FoxhoundSpanProcessor: error in on_start for span '%s'",
                getattr(span, "name", "<unknown>"),
            )

    def on_end(self, span: Any) -> None:
        """Called when an OTel span ends.

        Looks up the corresponding Fox span, applies GenAI semantic convention
        attribute mappings, propagates error status, and ends the Fox span.

        Args:
            span: The completed OTel :class:`~opentelemetry.sdk.trace.ReadableSpan`.
        """
        try:
            ctx = span.get_span_context()
            if ctx is None:
                return
            otel_span_id: int = ctx.span_id
            fox_span = self._span_map.pop(otel_span_id, None)
            if fox_span is None:
                return

            attrs = self._extract_attributes(span)
            for key, value in attrs.items():
                fox_span.set_attribute(key, value)

            # Propagate OTel status to Fox span status
            status = _otel_status(span)
            logger.debug(
                "FoxhoundSpanProcessor.on_end: span=%r status=%r",
                getattr(span, "name", "<unknown>"),
                status,
            )
            fox_span.end(status)
        except Exception:
            logger.exception(
                "FoxhoundSpanProcessor: error in on_end for span '%s'",
                getattr(span, "name", "<unknown>"),
            )

    def shutdown(self) -> None:
        """Called when the SDK is shutting down — flushes remaining spans."""
        self._tracer.flush_sync()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        """Force-flush pending data.  Returns ``True`` on success."""
        self._tracer.flush_sync()
        return True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_parent(self, span: Any) -> str | None:
        """Resolve the Fox span ID for the OTel span's parent, if known."""
        # OTel SDK exposes the parent span context on the span itself.
        # The parent may be accessed via span.parent (SpanContext) in SDK spans.
        parent = getattr(span, "parent", None)
        if parent is None:
            return None
        parent_otel_id = getattr(parent, "span_id", None)
        if parent_otel_id is None:
            return None
        active = self._span_map.get(parent_otel_id)
        return active.span_id if active is not None else None

    def _semantic_to_fox_kind(self, span: Any) -> SpanKind:
        """Map OTel GenAI semantic conventions to a Foxhound :data:`SpanKind`.

        Priority:
        1. ``gen_ai.operation.name`` attribute → precise operation mapping
        2. Span name prefix heuristics (``agent``, ``tool``)
        3. Default: ``"workflow"``

        Mapping table:

        +---------------------+-------------+
        | gen_ai.operation    | Fox kind    |
        +=====================+=============+
        | chat                | llm_call    |
        | text_completion     | llm_call    |
        | embeddings          | tool_call   |
        | agent / invoke      | agent_step  |
        | tool / execute      | tool_call   |
        | (missing / other)   | workflow    |
        +---------------------+-------------+
        """
        attributes: dict[str, Any] = dict(getattr(span, "attributes", None) or {})
        operation = attributes.get("gen_ai.operation.name", "")
        name: str = getattr(span, "name", "") or ""

        op_lower = str(operation).lower() if operation else ""
        name_lower = name.lower()

        if op_lower in ("chat", "text_completion"):
            return "llm_call"
        if op_lower == "embeddings":
            return "tool_call"
        if op_lower in ("agent", "invoke"):
            return "agent_step"
        if op_lower in ("tool", "execute"):
            return "tool_call"

        # Name-based heuristics when no gen_ai.operation.name is set
        if name_lower.startswith("agent"):
            return "agent_step"
        if name_lower.startswith("tool"):
            return "tool_call"

        return "workflow"

    def _extract_attributes(self, span: Any) -> dict[str, Any]:
        """Extract Foxhound attributes from OTel GenAI semantic convention attributes.

        Mapping:
        - ``gen_ai.request.model``       → ``llm.model``
        - ``gen_ai.usage.input_tokens``  → ``llm.prompt_tokens``
        - ``gen_ai.usage.output_tokens`` → ``llm.completion_tokens``
        - ``gen_ai.usage.total_tokens``  → ``llm.total_tokens``
        - ``gen_ai.prompt``              → ``agent.prompt`` (truncated to 512 chars)
        """
        raw: dict[str, Any] = dict(getattr(span, "attributes", None) or {})
        result: dict[str, Any] = {}

        model = raw.get("gen_ai.request.model")
        if model is not None:
            result["llm.model"] = model

        input_tokens = raw.get("gen_ai.usage.input_tokens")
        if input_tokens is not None:
            result["llm.prompt_tokens"] = input_tokens

        output_tokens = raw.get("gen_ai.usage.output_tokens")
        if output_tokens is not None:
            result["llm.completion_tokens"] = output_tokens

        total_tokens = raw.get("gen_ai.usage.total_tokens")
        if total_tokens is not None:
            result["llm.total_tokens"] = total_tokens

        prompt = raw.get("gen_ai.prompt")
        if prompt is not None:
            result["agent.prompt"] = _truncate(str(prompt), _PROMPT_MAX_LEN)

        return result


# ---------------------------------------------------------------------------
# AWS ADOT convenience helper
# ---------------------------------------------------------------------------


def configure_adot_for_foxhound(
    agent_id: str,
    foxhound_endpoint: str,
    api_key: str,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> "FoxhoundSpanProcessor":
    """Configure AWS Distro for OpenTelemetry (ADOT) to export spans to Foxhound.

    This helper creates a :class:`FoxhoundSpanProcessor`, attaches it to a new
    :class:`~opentelemetry.sdk.trace.TracerProvider`, and sets that provider as
    the global OTel tracer provider.  Suitable for Amazon Bedrock AgentCore and
    other AWS ADOT-instrumented applications.

    Args:
        agent_id:            Identifier for the agent being traced.
        foxhound_endpoint:   Base URL of your Foxhound instance
                             (e.g. ``"https://your-foxhound-instance.com"``).
        api_key:             Foxhound API key (``"fox_..."``).
        session_id:          Optional session identifier.
        metadata:            Optional key-value metadata for the trace.

    Returns:
        The registered :class:`FoxhoundSpanProcessor`.

    Raises:
        ImportError: If ``opentelemetry-sdk`` is not installed.

    Usage::

        from foxhound.integrations.opentelemetry import configure_adot_for_foxhound

        processor = configure_adot_for_foxhound(
            agent_id="bedrock-agent",
            foxhound_endpoint="https://your-foxhound-instance.com",
            api_key="fox_...",
        )
        # Run Bedrock AgentCore normally — all spans are captured automatically
        await processor.flush()
    """
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
    except ImportError as exc:
        raise ImportError(
            "opentelemetry-sdk is required for configure_adot_for_foxhound: "
            "pip install foxhound-ai[opentelemetry]"
        ) from exc

    from foxhound.client import FoxhoundClient

    fox = FoxhoundClient(api_key=api_key, endpoint=foxhound_endpoint)
    processor = FoxhoundSpanProcessor.from_client(
        fox,
        agent_id=agent_id,
        session_id=session_id,
        metadata=metadata,
    )
    provider = TracerProvider()
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    return processor


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _truncate(s: str, max_len: int) -> str:
    """Truncate string *s* to at most *max_len* characters."""
    return s[:max_len] if len(s) > max_len else s


def _otel_status(span: Any) -> str:
    """Return the Fox status string (``'ok'`` or ``'error'``) for an OTel span.

    Reads the OTel ``StatusCode`` from ``span.status.status_code``.  Attempts
    to compare against the ``StatusCode.ERROR`` enum member; falls back to
    string comparison if the OTel SDK is not installed in the test environment.
    """
    status_obj = getattr(span, "status", None)
    if status_obj is None:
        return "ok"
    status_code = getattr(status_obj, "status_code", None)
    if status_code is None:
        return "ok"
    # Compare by name to avoid a hard dependency on opentelemetry-sdk in tests
    code_name = getattr(status_code, "name", str(status_code))
    return "error" if code_name == "ERROR" else "ok"
