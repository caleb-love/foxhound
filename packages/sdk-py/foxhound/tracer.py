"""Core tracer primitives — Tracer, ActiveSpan, and associated data types."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

SpanKind = Literal["tool_call", "llm_call", "agent_step", "workflow", "custom"]
SpanStatus = Literal["ok", "error", "unset"]


@dataclass
class SpanEvent:
    time_ms: int
    name: str
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass
class Span:
    trace_id: str
    span_id: str
    name: str
    kind: SpanKind
    start_time_ms: int
    status: SpanStatus = "unset"
    parent_span_id: str | None = None
    end_time_ms: int | None = None
    attributes: dict[str, Any] = field(default_factory=dict)
    events: list[SpanEvent] = field(default_factory=list)
    # WP15: per-span subagent attribution. When set, overrides the parent
    # Tracer's agent_id at wire-encode time. Absent when the span
    # inherits the trace-level agent_id.
    agent_id: str | None = None


class ActiveSpan:
    """A live span that can be annotated and ended."""

    def __init__(self, span: Span, registry: dict[str, Span]) -> None:
        self._span = span
        self._registry = registry
        self.span_id = span.span_id

    def set_attribute(self, key: str, value: str | int | float | bool | None) -> "ActiveSpan":
        self._span.attributes[key] = value
        return self

    def set_agent(self, agent_id: str) -> "ActiveSpan":
        """Attach this span to a specific subagent (WP15).

        Overrides any trace-level or scope-based ``agent_id`` for this
        span only. Idempotent; the last call wins.
        """
        self._span.agent_id = agent_id
        return self

    def add_event(self, name: str, attributes: dict[str, Any] | None = None) -> "ActiveSpan":
        self._span.events.append(
            SpanEvent(
                time_ms=_now_ms(),
                name=name,
                attributes=attributes or {},
            )
        )
        return self

    def end(self, status: SpanStatus = "ok") -> None:
        self._span.status = status
        self._span.end_time_ms = _now_ms()


class Tracer:
    """Manages a single trace (a collection of spans for one agent invocation)."""

    def __init__(
        self,
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        on_flush: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
    ) -> None:
        self.trace_id = str(uuid.uuid4())
        self._agent_id = agent_id
        self._session_id = session_id
        self._metadata = metadata or {}
        self._on_flush = on_flush
        self._spans: dict[str, Span] = {}
        self._start_time_ms = _now_ms()
        # WP15: per-tracer agent scope stack consulted by start_span().
        # Maintained by the ``with_agent`` context manager in
        # ``foxhound.helpers.agent``.
        self._agent_scope_stack: list[str] = []

    def start_span(
        self,
        name: str,
        kind: SpanKind,
        parent_span_id: str | None = None,
        attributes: dict[str, Any] | None = None,
        agent_id: str | None = None,
    ) -> ActiveSpan:
        # Resolution order (WP15): explicit kwarg > with_agent(...) scope
        # > unset (inherits the trace-level agent_id at wire-encode time).
        scoped_agent_id = agent_id
        if scoped_agent_id is None and self._agent_scope_stack:
            scoped_agent_id = self._agent_scope_stack[-1]
        span = Span(
            trace_id=self.trace_id,
            span_id=str(uuid.uuid4()),
            name=name,
            kind=kind,
            start_time_ms=_now_ms(),
            parent_span_id=parent_span_id,
            attributes=attributes or {},
            agent_id=scoped_agent_id,
        )
        self._spans[span.span_id] = span
        return ActiveSpan(span, self._spans)

    def set_prompt(
        self,
        *,
        name: str,
        version: int,
        label: str | None = None,
    ) -> "Tracer":
        """Attach prompt version info to this trace's metadata.

        Called after resolving a prompt to link the trace to the prompt version used.

        Usage::

            prompt = await fox.prompts.get(name="support-agent")
            tracer = fox.start_trace(agent_id="my-agent")
            tracer.set_prompt(name=prompt["name"], version=prompt["version"], label=prompt["label"])
        """
        self._metadata["prompt_name"] = name
        self._metadata["prompt_version"] = version
        if label is not None:
            self._metadata["prompt_label"] = label
        return self

    def to_payload(self) -> dict[str, Any]:
        """Serialize the trace to the Fox API payload format."""
        return {
            "id": self.trace_id,
            "agentId": self._agent_id,
            "sessionId": self._session_id,
            "spans": [_span_to_dict(s) for s in self._spans.values()],
            "startTimeMs": self._start_time_ms,
            "endTimeMs": _now_ms(),
            "metadata": self._metadata,
        }

    async def flush(self) -> None:
        """Send the trace to the Fox ingestion endpoint (async)."""
        if self._on_flush:
            await self._on_flush(self.to_payload())

    def flush_sync(self) -> None:
        """Send the trace synchronously (for non-async entry points)."""
        if not self._on_flush:
            return
        import asyncio

        payload = self.to_payload()

        async def _run() -> None:
            await self._on_flush(payload)  # type: ignore[misc]

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(_run())
        else:
            # Running inside an existing event loop — use a thread-safe bridge.
            import concurrent.futures

            future = asyncio.run_coroutine_threadsafe(_run(), loop)
            future.result(timeout=30)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_ms() -> int:
    return int(time.time() * 1000)


def _span_to_dict(span: Span) -> dict[str, Any]:
    d: dict[str, Any] = {
        "traceId": span.trace_id,
        "spanId": span.span_id,
        "name": span.name,
        "kind": span.kind,
        "startTimeMs": span.start_time_ms,
        "status": span.status,
        "attributes": span.attributes,
        "events": [
            {"timeMs": e.time_ms, "name": e.name, "attributes": e.attributes}
            for e in span.events
        ],
    }
    if span.parent_span_id is not None:
        d["parentSpanId"] = span.parent_span_id
    if span.end_time_ms is not None:
        d["endTimeMs"] = span.end_time_ms
    # WP15: per-span subagent attribution, emitted only when set so
    # the wire carries proto3 field absence for unscoped spans.
    if span.agent_id is not None and span.agent_id != "":
        d["agentId"] = span.agent_id
    return d
