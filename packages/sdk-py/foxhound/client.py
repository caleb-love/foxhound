"""FoxhoundClient — top-level entry point for the Foxhound observability SDK."""

from __future__ import annotations

import contextlib
import threading
import time
from typing import Any, Callable, TypedDict

import httpx

from .tracer import Tracer


class BudgetExceededInfo(TypedDict):
    """Information passed to the ``on_budget_exceeded`` callback."""

    agent_id: str
    current_cost: float
    budget_limit: float


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


class BudgetsNamespace:
    """Namespaced API for managing cost budgets. Access via ``fox.budgets.set(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def set(
        self,
        *,
        agent_id: str,
        cost_budget_usd: float,
        cost_alert_threshold_pct: float = 80,
        budget_period: str = "monthly",
    ) -> dict[str, Any]:
        """Create or update a cost budget for an agent.

        Usage::

            await fox.budgets.set(agent_id="my-agent", cost_budget_usd=100.0)
        """
        body: dict[str, Any] = {
            "costBudgetUsd": cost_budget_usd,
            "costAlertThresholdPct": cost_alert_threshold_pct,
            "budgetPeriod": budget_period,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.put(
                f"{self._endpoint}/v1/budgets/{agent_id}",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to set budget: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def get(self, *, agent_id: str) -> dict[str, Any]:
        """Get the budget for an agent.

        Usage::

            budget = await fox.budgets.get(agent_id="my-agent")
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/budgets/{agent_id}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to get budget: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def list(self) -> dict[str, Any]:
        """List all budgets.

        Usage::

            budgets = await fox.budgets.list()
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/budgets",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to list budgets: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def delete(self, *, agent_id: str) -> dict[str, Any]:
        """Delete the budget for an agent.

        Usage::

            await fox.budgets.delete(agent_id="my-agent")
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(
                f"{self._endpoint}/v1/budgets/{agent_id}",
                headers=self._headers(),
            )
        if response.status_code not in (200, 204):
            raise RuntimeError(
                f"Foxhound: failed to delete budget: "
                f"{response.status_code} {response.text}"
            )
        return response.json() if response.content else {}


class SLAsNamespace:
    """Namespaced API for managing SLA policies. Access via ``fox.slas.set(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def set(
        self,
        *,
        agent_id: str,
        max_duration_ms: int | None = None,
        min_success_rate: float | None = None,
        evaluation_window_ms: int = 86400000,
        min_sample_size: int = 10,
    ) -> dict[str, Any]:
        """Create or update an SLA policy for an agent.

        Usage::

            await fox.slas.set(
                agent_id="my-agent",
                max_duration_ms=5000,
                min_success_rate=0.99,
            )
        """
        body: dict[str, Any] = {
            "evaluationWindowMs": evaluation_window_ms,
            "minSampleSize": min_sample_size,
        }
        if max_duration_ms is not None:
            body["maxDurationMs"] = max_duration_ms
        if min_success_rate is not None:
            body["minSuccessRate"] = min_success_rate

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.put(
                f"{self._endpoint}/v1/slas/{agent_id}",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to set SLA: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def get(self, *, agent_id: str) -> dict[str, Any]:
        """Get the SLA policy for an agent.

        Usage::

            sla = await fox.slas.get(agent_id="my-agent")
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/slas/{agent_id}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to get SLA: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def list(self) -> dict[str, Any]:
        """List all SLA policies.

        Usage::

            slas = await fox.slas.list()
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/slas",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to list SLAs: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def delete(self, *, agent_id: str) -> dict[str, Any]:
        """Delete the SLA policy for an agent.

        Usage::

            await fox.slas.delete(agent_id="my-agent")
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(
                f"{self._endpoint}/v1/slas/{agent_id}",
                headers=self._headers(),
            )
        if response.status_code not in (200, 204):
            raise RuntimeError(
                f"Foxhound: failed to delete SLA: "
                f"{response.status_code} {response.text}"
            )
        return response.json() if response.content else {}


class RegressionsNamespace:
    """Namespaced API for regression detection. Access via ``fox.regressions.compare(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def compare(
        self,
        *,
        agent_id: str,
        version_a: str,
        version_b: str,
    ) -> dict[str, Any]:
        """Compare two versions of an agent for regressions.

        Usage::

            result = await fox.regressions.compare(
                agent_id="my-agent",
                version_a="v1.0",
                version_b="v1.1",
            )
        """
        body: dict[str, Any] = {
            "versionA": version_a,
            "versionB": version_b,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/regressions/{agent_id}/compare",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound: failed to compare regressions: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def baselines(self, *, agent_id: str) -> dict[str, Any]:
        """Get baselines for an agent.

        Usage::

            baselines = await fox.regressions.baselines(agent_id="my-agent")
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/regressions/{agent_id}/baselines",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to get baselines: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def delete_baseline(self, *, agent_id: str, version: str) -> dict[str, Any]:
        """Delete a specific baseline version for an agent.

        Usage::

            await fox.regressions.delete_baseline(agent_id="my-agent", version="v1.0")
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(
                f"{self._endpoint}/v1/regressions/{agent_id}/baselines",
                params={"version": version},
                headers=self._headers(),
            )
        if response.status_code not in (200, 204):
            raise RuntimeError(
                f"Foxhound: failed to delete baseline: "
                f"{response.status_code} {response.text}"
            )
        return response.json() if response.content else {}


class ResolvedPrompt(TypedDict):
    """A resolved prompt version returned by ``fox.prompts.get(...)``."""

    name: str
    label: str
    version: int
    content: str
    model: str | None
    config: dict[str, Any]


class _PromptCacheEntry(TypedDict):
    prompt: ResolvedPrompt
    expires_at: float


class PromptsNamespace:
    """Namespaced API for prompt resolution with client-side caching.

    Access via ``fox.prompts.get(...)``::

        prompt = await fox.prompts.get(name="support-agent", label="production")
        print(prompt["content"])  # The prompt template text
    """

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        timeout: float,
        cache_ttl_s: float = 300.0,
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout
        self._cache_ttl_s = cache_ttl_s
        self._cache: dict[str, _PromptCacheEntry] = {}
        self._cache_lock = threading.Lock()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _cache_key(self, name: str, label: str) -> str:
        return f"{name}::{label}"

    async def get(
        self,
        *,
        name: str,
        label: str = "production",
    ) -> ResolvedPrompt:
        """Resolve a prompt by name and label. Cached client-side (5min TTL).

        Usage::

            prompt = await fox.prompts.get(name="support-agent", label="production")
            print(prompt["content"])
        """
        key = self._cache_key(name, label)
        with self._cache_lock:
            cached = self._cache.get(key)
            if cached is not None and cached["expires_at"] > time.monotonic():
                return cached["prompt"]

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/prompts/resolve",
                params={"name": name, "label": label},
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to resolve prompt: "
                f"{response.status_code} {response.text}"
            )

        prompt: ResolvedPrompt = response.json()
        with self._cache_lock:
            self._cache[key] = _PromptCacheEntry(
                prompt=prompt,
                expires_at=time.monotonic() + self._cache_ttl_s,
            )
        return prompt

    def get_sync(
        self,
        *,
        name: str,
        label: str = "production",
    ) -> ResolvedPrompt:
        """Synchronous version of :meth:`get`."""
        key = self._cache_key(name, label)
        with self._cache_lock:
            cached = self._cache.get(key)
            if cached is not None and cached["expires_at"] > time.monotonic():
                return cached["prompt"]

        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(
                f"{self._endpoint}/v1/prompts/resolve",
                params={"name": name, "label": label},
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to resolve prompt: "
                f"{response.status_code} {response.text}"
            )

        prompt: ResolvedPrompt = response.json()
        with self._cache_lock:
            self._cache[key] = _PromptCacheEntry(
                prompt=prompt,
                expires_at=time.monotonic() + self._cache_ttl_s,
            )
        return prompt

    def invalidate(
        self,
        *,
        name: str | None = None,
        label: str | None = None,
    ) -> None:
        """Clear the client-side prompt cache.

        Call with no arguments to clear everything, or with ``name``/``label``
        to clear a specific entry.
        """
        if name is None and label is not None:
            raise ValueError(
                "Provide 'name' when specifying 'label', "
                "or call with no arguments to clear all."
            )
        with self._cache_lock:
            if name is None:
                self._cache.clear()
                return
            resolved_label = label or "production"
            self._cache.pop(self._cache_key(name, resolved_label), None)


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
        on_budget_exceeded: Callable[[BudgetExceededInfo], None] | None = None,
    ) -> None:
        self._api_key = api_key
        self._endpoint = endpoint.rstrip("/")
        self._timeout = timeout
        self._on_budget_exceeded = on_budget_exceeded

        # Namespaced sub-clients
        self.scores = ScoresNamespace(self._endpoint, self._api_key, self._timeout)
        self.datasets = DatasetsNamespace(self._endpoint, self._api_key, self._timeout)
        self.experiments = ExperimentsNamespace(self._endpoint, self._api_key, self._timeout)
        self.budgets = BudgetsNamespace(self._endpoint, self._api_key, self._timeout)
        self.slas = SLAsNamespace(self._endpoint, self._api_key, self._timeout)
        self.regressions = RegressionsNamespace(self._endpoint, self._api_key, self._timeout)
        self.prompts = PromptsNamespace(self._endpoint, self._api_key, self._timeout)

    # ------------------------------------------------------------------
    # Tracer factory
    # ------------------------------------------------------------------

    def start_trace(
        self,
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        parent_agent_id: str | None = None,
        correlation_id: str | None = None,
    ) -> Tracer:
        """Create a new Tracer for a single agent invocation.

        Pass ``parent_agent_id`` and ``correlation_id`` when this agent was
        invoked by another agent so that cross-agent traces can be linked.
        """
        self._parent_agent_id = parent_agent_id
        self._correlation_id = correlation_id

        merged_metadata: dict[str, Any] = dict(metadata) if metadata else {}
        if parent_agent_id is not None:
            merged_metadata["parentAgentId"] = parent_agent_id
        if correlation_id is not None:
            merged_metadata["correlationId"] = correlation_id

        return Tracer(
            agent_id=agent_id,
            session_id=session_id,
            metadata=merged_metadata if merged_metadata else None,
            on_flush=self._send_trace,
        )

    def get_propagation_headers(self) -> dict[str, str]:
        """Return HTTP headers for propagating trace context to child agents.

        Usage::

            headers = fox.get_propagation_headers()
            # Pass headers to downstream HTTP calls so child agents can link traces.
        """
        headers: dict[str, str] = {}
        correlation_id = getattr(self, "_correlation_id", None)
        parent_agent_id = getattr(self, "_parent_agent_id", None)
        if correlation_id is not None:
            headers["X-Foxhound-Correlation-Id"] = correlation_id
        if parent_agent_id is not None:
            headers["X-Foxhound-Parent-Agent-Id"] = parent_agent_id
        return headers

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
        self._check_budget_headers(response)

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
        self._check_budget_headers(response)

    def _check_budget_headers(self, response: httpx.Response) -> None:
        """Invoke the budget-exceeded callback when the server signals an overage."""
        if self._on_budget_exceeded is None:
            return

        budget_status = response.headers.get("x-foxhound-budget-status")
        if budget_status != "exceeded":
            return

        agent_id = response.headers.get("x-foxhound-budget-agent-id", "")
        try:
            current_cost = float(
                response.headers.get("x-foxhound-budget-current-cost", "0")
            )
            budget_limit = float(
                response.headers.get("x-foxhound-budget-limit", "0")
            )
        except ValueError:
            return

        self._on_budget_exceeded(
            BudgetExceededInfo(
                agent_id=agent_id,
                current_cost=current_cost,
                budget_limit=budget_limit,
            )
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
