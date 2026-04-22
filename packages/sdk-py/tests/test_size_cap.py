"""Unit tests for the WP05 Python per-span size-cap.

Parity with ``packages/sdk/src/transport/size-cap.test.ts``.
"""

from __future__ import annotations

from typing import Any

from foxhound.transport.size_cap import (
    HEAVY_ATTRIBUTE_VALUE_BYTES,
    MAX_SPAN_PAYLOAD_BYTES,
    DropRecord,
    enforce_cap,
    enforce_cap_on_spans,
)


def _mk_span(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "traceId": "t1",
        "spanId": "s1",
        "name": "llm.generate",
        "kind": "llm_call",
        "startTimeMs": 1_700_000_000_000,
        "endTimeMs": 1_700_000_000_100,
        "status": "ok",
        "attributes": {},
        "events": [],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Below threshold
# ---------------------------------------------------------------------------


def test_below_threshold_returns_input_unchanged():
    span = _mk_span(
        attributes={
            "gen_ai.prompt": "short prompt",
            "gen_ai.completion": "short reply",
            "model": "gpt-4o",
        }
    )
    drops: list[DropRecord] = []
    result = enforce_cap(span, "org_a", drops.append)
    assert result is span
    assert drops == []


def test_enforce_cap_on_spans_returns_same_list_when_nothing_trimmed():
    spans = [_mk_span(), _mk_span(spanId="s2")]
    out = enforce_cap_on_spans(spans, "org_a", lambda r: None)
    assert out is spans


# ---------------------------------------------------------------------------
# Oversize well-known attributes
# ---------------------------------------------------------------------------


def test_drops_gen_ai_prompt_when_it_alone_exceeds_cap():
    big_prompt = "a" * (MAX_SPAN_PAYLOAD_BYTES + 1)
    span = _mk_span(
        attributes={
            "gen_ai.prompt": big_prompt,
            "model": "gpt-4o",
            "tokens": 512,
        }
    )
    drops: list[DropRecord] = []
    result = enforce_cap(span, "org_a", drops.append)

    assert result is not span
    assert "gen_ai.prompt" not in result["attributes"]
    assert result["attributes"]["model"] == "gpt-4o"
    assert result["attributes"]["tokens"] == 512
    assert result["attributes"]["foxhound.payload_dropped"] is True
    assert result["attributes"]["foxhound.payload_original_bytes"] == len(big_prompt)
    # Span shape preserved.
    assert result["traceId"] == span["traceId"]
    assert result["spanId"] == span["spanId"]
    assert result["name"] == span["name"]
    assert result["startTimeMs"] == span["startTimeMs"]
    # Drop record.
    assert len(drops) == 1
    assert "gen_ai.prompt" in drops[0].dropped_fields
    assert drops[0].original_bytes == len(big_prompt)
    assert drops[0].reason == "oversize"
    assert drops[0].org_id == "org_a"


def test_drops_tool_payload_fields_when_aggregate_exceeds_cap():
    span = _mk_span(
        attributes={
            "tool.parameters": "x" * (150 * 1024),
            "tool.output": "y" * (120 * 1024),
            "model": "gpt-4o",
        }
    )
    drops: list[DropRecord] = []
    result = enforce_cap(span, "org_a", drops.append)

    assert "tool.parameters" not in result["attributes"]
    assert "tool.output" not in result["attributes"]
    assert result["attributes"]["model"] == "gpt-4o"
    assert "tool.parameters" in drops[0].dropped_fields
    assert "tool.output" in drops[0].dropped_fields


# ---------------------------------------------------------------------------
# Heavy ad-hoc attributes
# ---------------------------------------------------------------------------


def test_drops_heavy_adhoc_attributes():
    heavy = "h" * (HEAVY_ATTRIBUTE_VALUE_BYTES + 100)
    # 32 heavy attributes ≈ 256 KB → crosses the per-span cap.
    attrs = {f"heavy_doc_{i}": heavy for i in range(1, 33)}
    attrs["small_metadata"] = "keep me"
    span = _mk_span(attributes=attrs)

    drops: list[DropRecord] = []
    result = enforce_cap(span, "org_a", drops.append)

    for i in range(1, 33):
        assert f"heavy_doc_{i}" not in result["attributes"]
    assert result["attributes"]["small_metadata"] == "keep me"
    assert len(drops[0].dropped_fields) >= 32


def test_leaves_small_non_string_attributes_alone():
    span = _mk_span(
        attributes={
            "gen_ai.prompt": "p" * (MAX_SPAN_PAYLOAD_BYTES + 100),
            "model": "gpt-4o",
            "temperature": 0.7,
            "streaming": True,
            "short_description": "x" * 1000,
        }
    )
    result = enforce_cap(span, "org_a", lambda r: None)
    assert result["attributes"]["short_description"] == "x" * 1000
    assert result["attributes"]["temperature"] == 0.7
    assert result["attributes"]["streaming"] is True
    assert result["attributes"]["model"] == "gpt-4o"


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


def test_trims_heavy_events_preserves_name_and_time():
    span = _mk_span(
        attributes={"gen_ai.prompt": "p" * MAX_SPAN_PAYLOAD_BYTES},
        events=[
            {
                "timeMs": 1_700_000_000_010,
                "name": "llm.chunk",
                "attributes": {"chunk": "c" * (HEAVY_ATTRIBUTE_VALUE_BYTES + 100)},
            },
            {
                "timeMs": 1_700_000_000_020,
                "name": "llm.done",
                "attributes": {"reason": "stop"},
            },
        ],
    )
    result = enforce_cap(span, "org_a", lambda r: None)
    assert result["events"][0]["name"] == "llm.chunk"
    assert "chunk" not in result["events"][0]["attributes"]
    assert result["events"][0]["attributes"]["foxhound.event_payload_dropped"] is True
    # Light event untouched.
    assert result["events"][1]["attributes"]["reason"] == "stop"


# ---------------------------------------------------------------------------
# Cross-span
# ---------------------------------------------------------------------------


def test_enforce_cap_on_spans_mixed():
    oversize = _mk_span(
        spanId="oversize",
        attributes={"gen_ai.prompt": "p" * (MAX_SPAN_PAYLOAD_BYTES + 10)},
    )
    small = _mk_span(spanId="small", attributes={"model": "gpt-4o"})
    drops: list[DropRecord] = []
    out = enforce_cap_on_spans([oversize, small], "org_a", drops.append)

    assert out is not [oversize, small]  # new list
    assert "gen_ai.prompt" not in out[0]["attributes"]
    assert out[1] is small
    assert len(drops) == 1
