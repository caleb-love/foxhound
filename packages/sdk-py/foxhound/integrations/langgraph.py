"""
LangGraph / LangChain callback integration for the Fox observability SDK.

This module provides ``FoxCallbackHandler``, a ``BaseCallbackHandler`` subclass
that automatically instruments LangGraph agent graphs by hooking into
LangChain's callback system.

Every graph node execution, LLM call, and tool invocation is captured as a
span and emitted as a structured trace to the Fox ingestion API.

Usage::

    from foxhound import FoxhoundClient
    from foxhound.integrations.langgraph import FoxCallbackHandler

    fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

    # --- async graph (most common) ---
    handler = FoxCallbackHandler.from_client(fox, agent_id="my-agent")
    result = await graph.ainvoke(state, config={"callbacks": [handler]})
    await handler.flush()

    # --- sync graph ---
    handler = FoxCallbackHandler.from_client(fox, agent_id="my-agent")
    result = graph.invoke(state, config={"callbacks": [handler]})
    handler.flush_sync()

    # --- decorator ---
    @fox.trace_agent(agent_id="my-agent")           # (see client.py)
    async def run(state):
        return await graph.ainvoke(state)

Requires: ``pip install foxhound-ai[langgraph]``
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from foxhound.tracer import ActiveSpan, SpanKind, Tracer

if TYPE_CHECKING:
    from foxhound.client import FoxhoundClient

logger = logging.getLogger(__name__)


class FoxCallbackHandler(BaseCallbackHandler):
    """
    LangChain ``BaseCallbackHandler`` that maps LangGraph lifecycle events
    to Fox trace spans.

    Span-kind mapping
    -----------------
    - Graph / chain invocations  → ``"workflow"`` (root) or ``"agent_step"``
    - LLM / chat-model calls     → ``"llm_call"``
    - Tool invocations           → ``"tool_call"``

    Each LangChain ``run_id`` (UUID) becomes a ``spanId``.
    Each ``parent_run_id`` becomes the ``parentSpanId``.
    The root run (``parent_run_id is None``) carries kind ``"workflow"``.

    Thread / async safety
    ---------------------
    LangGraph may call callbacks from multiple threads when running nodes in
    parallel.  All span state is stored in a ``dict`` keyed by ``run_id``
    (UUID → str), which is safe for concurrent *reads and writes on CPython*
    due to the GIL.  For production workloads that use subprocesses or truly
    parallel async executors, wrap each graph invocation in its own handler
    instance.
    """

    raise_on_error = False  # surface errors via logging, not exceptions

    def __init__(self, tracer: Tracer) -> None:
        super().__init__()
        self._tracer = tracer
        # run_id (str) → ActiveSpan
        self._active: dict[str, ActiveSpan] = {}
        # run_id of the root chain/graph so we know when the top-level ends
        self._root_run_id: str | None = None

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
    ) -> "FoxCallbackHandler":
        """Create a handler from a ``FoxhoundClient`` instance."""
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
    # Chain / graph node callbacks
    # ------------------------------------------------------------------

    def on_chain_start(
        self,
        serialized: dict[str, Any],
        inputs: dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        parent_key = str(parent_run_id) if parent_run_id else None

        # Identify root vs. nested steps
        is_root = parent_run_id is None
        if is_root and self._root_run_id is None:
            self._root_run_id = run_key

        kind: SpanKind = "workflow" if is_root else "agent_step"
        name = _chain_name(serialized)

        # Resolve parent span ID from our own span registry (not raw UUID)
        parent_span_id = self._span_id_for(parent_key)

        span = self._tracer.start_span(
            name=name,
            kind=kind,
            parent_span_id=parent_span_id,
        )
        if inputs:
            span.set_attribute("input.keys", ",".join(str(k) for k in inputs.keys()))
        if tags:
            span.set_attribute("tags", ",".join(tags))

        self._active[run_key] = span

    def on_chain_end(
        self,
        outputs: dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        span = self._active.pop(run_key, None)
        if span is not None:
            if outputs:
                span.set_attribute("output.keys", ",".join(str(k) for k in outputs.keys()))
            span.end("ok")

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        self._end_span_error(run_id, error)

    # ------------------------------------------------------------------
    # LLM / chat-model callbacks
    # ------------------------------------------------------------------

    def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        self._start_llm_span(
            run_id=run_id,
            parent_run_id=parent_run_id,
            serialized=serialized,
            prompt_count=len(prompts),
        )

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[Any]],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        self._start_llm_span(
            run_id=run_id,
            parent_run_id=parent_run_id,
            serialized=serialized,
            prompt_count=sum(len(m) for m in messages),
        )

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        span = self._active.pop(run_key, None)
        if span is None:
            return

        # Capture token usage when available
        if response.llm_output:
            usage = response.llm_output.get("token_usage") or response.llm_output.get("usage")
            if isinstance(usage, dict):
                for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
                    if key in usage:
                        span.set_attribute(f"llm.{key}", usage[key])

        # Capture model name from the first generation if present
        if response.generations and response.generations[0]:
            gen = response.generations[0][0]
            model = getattr(gen, "generation_info", {}) or {}
            if "model" in model:
                span.set_attribute("llm.model", model["model"])

        span.end("ok")

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        self._end_span_error(run_id, error)

    # ------------------------------------------------------------------
    # Tool callbacks
    # ------------------------------------------------------------------

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        parent_key = str(parent_run_id) if parent_run_id else None
        parent_span_id = self._span_id_for(parent_key)

        name = serialized.get("name") or "tool"
        span = self._tracer.start_span(
            name=f"tool:{name}",
            kind="tool_call",
            parent_span_id=parent_span_id,
        )
        # Truncate long inputs to avoid bloating the payload
        span.set_attribute("tool.name", name)
        span.set_attribute("tool.input", input_str[:1024] if input_str else "")
        self._active[run_key] = span

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        span = self._active.pop(run_key, None)
        if span is not None:
            if output:
                span.set_attribute("tool.output", output[:1024])
            span.end("ok")

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        self._end_span_error(run_id, error)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _start_llm_span(
        self,
        run_id: UUID,
        parent_run_id: UUID | None,
        serialized: dict[str, Any],
        prompt_count: int,
    ) -> None:
        run_key = str(run_id)
        parent_key = str(parent_run_id) if parent_run_id else None
        parent_span_id = self._span_id_for(parent_key)

        model_name = (
            (serialized.get("kwargs") or {}).get("model_name")
            or (serialized.get("kwargs") or {}).get("model")
            or serialized.get("name")
            or "llm"
        )
        span = self._tracer.start_span(
            name=f"llm:{model_name}",
            kind="llm_call",
            parent_span_id=parent_span_id,
        )
        span.set_attribute("llm.model", model_name)
        span.set_attribute("llm.prompt_count", prompt_count)
        self._active[run_key] = span

    def _end_span_error(self, run_id: UUID, error: BaseException) -> None:
        run_key = str(run_id)
        span = self._active.pop(run_key, None)
        if span is not None:
            span.add_event("error", {"message": str(error), "type": type(error).__name__})
            span.end("error")

    def _span_id_for(self, run_key: str | None) -> str | None:
        """Return the Fox spanId for a LangChain run_id string, if tracked."""
        if run_key is None:
            return None
        active = self._active.get(run_key)
        return active.span_id if active is not None else None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _chain_name(serialized: dict[str, Any]) -> str:
    """Extract a readable name from LangChain's serialized chain/graph dict."""
    # LangGraph StateGraph surfaces its name in `id` as a list like ["langgraph", "Graph"]
    ids = serialized.get("id")
    if isinstance(ids, list) and ids:
        return ids[-1]
    name = serialized.get("name")
    if name:
        return str(name)
    return "chain"
