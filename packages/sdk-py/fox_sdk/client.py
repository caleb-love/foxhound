"""FoxClient — top-level entry point for the Fox observability SDK."""

from __future__ import annotations

import contextlib
from typing import Any

import httpx

from .tracer import Tracer


class FoxClient:
    """
    Client for the Fox observability platform.

    Usage::

        fox = FoxClient(api_key="fox_...", endpoint="https://api.fox.ai")

        # Manual tracing
        tracer = fox.start_trace(agent_id="my-agent")
        span = tracer.start_span(name="step", kind="agent_step")
        span.end()
        await tracer.flush()

        # LangGraph integration
        from fox_sdk.integrations.langgraph import FoxCallbackHandler
        handler = FoxCallbackHandler.from_client(fox, agent_id="my-agent")
        result = await graph.ainvoke(state, config={"callbacks": [handler]})
        await handler.flush()
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        timeout: float = 10.0,
    ) -> None:
        self._api_key = api_key
        self._endpoint = endpoint.rstrip("/")
        self._timeout = timeout

    # ------------------------------------------------------------------
    # Tracer factory
    # ------------------------------------------------------------------

    def start_trace(
        self,
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Tracer:
        """Create a new Tracer for a single agent invocation."""
        return Tracer(
            agent_id=agent_id,
            session_id=session_id,
            metadata=metadata,
            on_flush=self._send_trace,
        )

    # ------------------------------------------------------------------
    # HTTP transport
    # ------------------------------------------------------------------

    async def _send_trace(self, payload: dict[str, Any]) -> None:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/traces",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Fox: failed to ingest trace {payload.get('id')}: "
                f"{response.status_code} {response.text}"
            )

    def _send_trace_sync(self, payload: dict[str, Any]) -> None:
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self._endpoint}/v1/traces",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Fox: failed to ingest trace {payload.get('id')}: "
                f"{response.status_code} {response.text}"
            )

    # ------------------------------------------------------------------
    # Context manager helpers
    # ------------------------------------------------------------------

    @contextlib.asynccontextmanager
    async def trace(
        self,
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ):
        """Async context manager that flushes the trace on exit.

        Usage::

            async with fox.trace(agent_id="my-agent") as tracer:
                span = tracer.start_span(name="step", kind="agent_step")
                span.end()
            # trace is flushed automatically
        """
        tracer = self.start_trace(agent_id=agent_id, session_id=session_id, metadata=metadata)
        try:
            yield tracer
        finally:
            await tracer.flush()
