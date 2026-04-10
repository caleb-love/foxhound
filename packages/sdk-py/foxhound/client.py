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


class DatasetsNamespace:
    """Namespaced API for managing datasets. Access via ``fox.datasets.create(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def create(
        self,
        *,
        name: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Create a new dataset.

        Usage::

            dataset = await fox.datasets.create(name="my-eval-set")
        """
        body: dict[str, Any] = {"name": name}
        if description is not None:
            body["description"] = description

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/datasets",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to create dataset: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def add_item(
        self,
        *,
        dataset_id: str,
        input: dict[str, Any],
        expected_output: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        source_trace_id: str | None = None,
    ) -> dict[str, Any]:
        """Add a single item to a dataset.

        Usage::

            item = await fox.datasets.add_item(
                dataset_id="ds_...", input={"prompt": "hello"}
            )
        """
        body: dict[str, Any] = {"input": input}
        if expected_output is not None:
            body["expectedOutput"] = expected_output
        if metadata is not None:
            body["metadata"] = metadata
        if source_trace_id is not None:
            body["sourceTraceId"] = source_trace_id

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/datasets/{dataset_id}/items",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to add dataset item: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def add_items_from_traces(
        self,
        *,
        dataset_id: str,
        score_name: str,
        score_operator: str = "lt",
        score_threshold: float = 0.5,
        since_days: int | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Auto-curate dataset items from production traces filtered by score.

        Usage::

            result = await fox.datasets.add_items_from_traces(
                dataset_id="ds_...",
                score_name="helpfulness",
                score_operator="lt",
                score_threshold=0.5,
                since_days=7,
            )
            print(f"Added {result['added']} items")
        """
        body: dict[str, Any] = {
            "scoreName": score_name,
            "scoreOperator": score_operator,
            "scoreThreshold": score_threshold,
            "limit": limit,
        }
        if since_days is not None:
            body["sinceDays"] = since_days

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/datasets/{dataset_id}/items/from-traces",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to curate from traces: "
                f"{response.status_code} {response.text}"
            )
        return response.json()


class ExperimentsNamespace:
    """Namespaced API for managing experiments. Access via ``fox.experiments.create(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def create(
        self,
        *,
        dataset_id: str,
        name: str,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Create and enqueue an experiment for async execution.

        Usage::

            result = await fox.experiments.create(
                dataset_id="ds_...",
                name="gpt4o-v2",
                config={"model": "gpt-4o", "promptTemplate": "Answer: {{input}}"},
            )
        """
        body: dict[str, Any] = {
            "datasetId": dataset_id,
            "name": name,
            "config": config,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/experiments",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound: failed to create experiment: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def get(self, *, experiment_id: str) -> dict[str, Any]:
        """Get an experiment with its runs."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/experiments/{experiment_id}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to get experiment: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def compare(self, *, experiment_ids: list[str]) -> dict[str, Any]:
        """Get side-by-side comparison of experiment results."""
        ids = ",".join(experiment_ids)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/experiment-comparisons?experiment_ids={ids}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to compare experiments: "
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
        self.datasets = DatasetsNamespace(self._endpoint, self._api_key, self._timeout)
        self.experiments = ExperimentsNamespace(self._endpoint, self._api_key, self._timeout)

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
