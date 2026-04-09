"""FoxhoundClient — top-level entry point for the Foxhound observability SDK."""

from __future__ import annotations

import contextlib
from typing import Any

import httpx

from .tracer import Tracer


class ScoresNamespace:
    """Namespaced API for creating scores. Access via ``fox.scores.create(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    async def create(
        self,
        *,
        trace_id: str,
        name: str,
        value: float | None = None,
        label: str | None = None,
        span_id: str | None = None,
        source: str = "sdk",
        comment: str | None = None,
    ) -> dict[str, Any]:
        """Create a score attached to a trace (and optionally a span).

        Usage::

            score = await fox.scores.create(
                trace_id=t.id, name="helpfulness", value=0.9
            )
        """
        body: dict[str, Any] = {
            "traceId": trace_id,
            "name": name,
            "source": source,
        }
        if value is not None:
            body["value"] = value
        if label is not None:
            body["label"] = label
        if span_id is not None:
            body["spanId"] = span_id
        if comment is not None:
            body["comment"] = comment

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/scores",
                json=body,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to create score: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    def create_sync(
        self,
        *,
        trace_id: str,
        name: str,
        value: float | None = None,
        label: str | None = None,
        span_id: str | None = None,
        source: str = "sdk",
        comment: str | None = None,
    ) -> dict[str, Any]:
        """Synchronous version of :meth:`create`."""
        body: dict[str, Any] = {
            "traceId": trace_id,
            "name": name,
            "source": source,
        }
        if value is not None:
            body["value"] = value
        if label is not None:
            body["label"] = label
        if span_id is not None:
            body["spanId"] = span_id
        if comment is not None:
            body["comment"] = comment

        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self._endpoint}/v1/scores",
                json=body,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to create score: "
                f"{response.status_code} {response.text}"
            )
        return response.json()


class FoxhoundClient:
    """
    Client for the Foxhound observability platform.

    Usage::

        fox = FoxhoundClient(api_key="fox_...", endpoint="https://your-foxhound-instance.com")

        # Manual tracing
        tracer = fox.start_trace(agent_id="my-agent")
        span = tracer.start_span(name="step", kind="agent_step")
        span.end()
        await tracer.flush()

        # Score a trace
        await fox.scores.create(trace_id=tracer.trace_id, name="helpfulness", value=0.9)

        # LangGraph integration
        from foxhound.integrations.langgraph import FoxCallbackHandler
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

        # Namespaced sub-clients
        self.scores = ScoresNamespace(self._endpoint, self._api_key, self._timeout)

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
                f"Foxhound: failed to ingest trace {payload.get('id')}: "
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
                f"Foxhound: failed to ingest trace {payload.get('id')}: "
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
