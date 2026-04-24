from __future__ import annotations

import asyncio
import threading
import time
from typing import Any
from unittest.mock import patch

import httpx
import pytest

from foxhound.client import FoxhoundClient
from foxhound.transport.batch_processor import BatchSpanProcessor


def _trace(trace_id: str) -> dict[str, Any]:
    return {
        "id": trace_id,
        "agentId": "agent",
        "spans": [],
        "startTimeMs": 1,
        "endTimeMs": 2,
        "metadata": {},
    }


class FakeTransport:
    wire_format = "json"

    def __init__(self, *, hang: bool = False, delay_s: float = 0.0) -> None:
        self.sent: list[dict[str, Any]] = []
        self.closed = False
        self.hang = hang
        self.delay_s = delay_s
        self._hang_event = threading.Event()

    async def send(self, payload: dict[str, Any]) -> None:
        self.send_sync(payload)

    def send_sync(self, payload: dict[str, Any]) -> None:
        if self.hang:
            self._hang_event.wait()
            return
        if self.delay_s:
            time.sleep(self.delay_s)
        self.sent.append(payload)

    async def close(self) -> None:
        self.closed = True

    def close_sync(self) -> None:
        self.closed = True


def _response(status_code: int = 202) -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        request=httpx.Request("POST", "https://api.example.com/v1/traces"),
    )


def test_enqueue_overhead_stays_below_100_microseconds_average() -> None:
    transport = FakeTransport()
    processor = BatchSpanProcessor(
        transport=transport,
        max_queue_size=20_000,
        max_export_batch_size=50_000,
        schedule_delay_s=60.0,
    )

    iterations = 10_000
    start = time.perf_counter()
    for i in range(iterations):
        processor.enqueue(_trace(f"trace-{i}"))
    elapsed_s = time.perf_counter() - start

    assert elapsed_s / iterations < 0.0001
    assert processor.shutdown(timeout_s=1.0) is True


def test_drop_oldest_evicts_oldest_trace_and_retains_newest() -> None:
    drops: list[dict[str, Any]] = []
    processor = BatchSpanProcessor(
        transport=FakeTransport(hang=True),
        max_queue_size=3,
        schedule_delay_s=60.0,
        backpressure_policy="drop-oldest",
        on_drop=lambda payload, reason: drops.append(payload),
    )

    processor.enqueue(_trace("t1"))
    processor.enqueue(_trace("t2"))
    processor.enqueue(_trace("t3"))
    processor.enqueue(_trace("t4"))

    assert [payload["id"] for payload in drops] == ["t1"]
    assert processor.queue_depth == 3
    assert processor.shutdown(timeout_s=0.01) is False


def test_drop_newest_refuses_incoming_trace_when_full() -> None:
    drops: list[dict[str, Any]] = []
    processor = BatchSpanProcessor(
        transport=FakeTransport(hang=True),
        max_queue_size=2,
        schedule_delay_s=60.0,
        backpressure_policy="drop-newest",
        on_drop=lambda payload, reason: drops.append(payload),
    )

    processor.enqueue(_trace("t1"))
    processor.enqueue(_trace("t2"))
    processor.enqueue(_trace("t3"))

    assert [payload["id"] for payload in drops] == ["t3"]
    assert processor.queue_depth == 2
    assert processor.shutdown(timeout_s=0.01) is False


def test_flush_returns_false_within_timeout_if_transport_hangs() -> None:
    processor = BatchSpanProcessor(
        transport=FakeTransport(hang=True),
        schedule_delay_s=60.0,
    )
    processor.enqueue(_trace("slow"))

    start = time.perf_counter()
    drained = processor.flush(timeout_s=0.02)
    elapsed_s = time.perf_counter() - start

    assert drained is False
    assert elapsed_s < 0.25
    assert processor.shutdown(timeout_s=0.01) is False


def test_shutdown_drains_and_closes_transport() -> None:
    transport = FakeTransport()
    processor = BatchSpanProcessor(transport=transport, schedule_delay_s=60.0)

    processor.enqueue(_trace("a"))
    processor.enqueue(_trace("b"))

    assert processor.shutdown(timeout_s=1.0) is True
    assert [payload["id"] for payload in transport.sent] == ["a", "b"]
    assert transport.closed is True


@pytest.mark.asyncio
async def test_python_client_queues_by_default_and_shutdown_drains() -> None:
    client = FoxhoundClient(
        api_key="fox_test",
        endpoint="https://api.example.com",
        export_schedule_delay_s=60.0,
    )

    with patch("httpx.Client.post", return_value=_response()) as post:
        tracer = client.start_trace(agent_id="agent")
        tracer.start_span(name="step", kind="agent_step").end()
        await tracer.flush()

        assert post.call_count == 0
        assert client.shutdown(timeout_s=1.0) is True
        assert post.call_count == 1


def test_python_client_atexit_hook_flushes_queue() -> None:
    callbacks = []
    with patch("atexit.register", side_effect=lambda callback: callbacks.append(callback)):
        client = FoxhoundClient(
            api_key="fox_test",
            endpoint="https://api.example.com",
            export_schedule_delay_s=60.0,
        )

    tracer = client.start_trace(agent_id="agent")
    tracer.start_span(name="step", kind="agent_step").end()
    asyncio.run(tracer.flush())

    with patch("httpx.Client.post", return_value=_response()) as post:
        assert callbacks, "client should register an atexit shutdown hook"
        callbacks[0]()
        assert post.call_count == 1
