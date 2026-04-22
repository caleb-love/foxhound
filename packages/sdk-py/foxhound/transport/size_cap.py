"""Per-span size-cap enforcement (WP05).

Python parity of ``packages/sdk/src/transport/size-cap.ts``. When a
span carries a 2 MB system prompt, a multi-megabyte tool-output, or an
entire uploaded document as an attribute value, the SDK keeps the
span's shape (identifiers, timing, status) and drops the payload. A
structured ``DropRecord`` is emitted so operators see the drop in
logs and ``foxhound_ingest_oversize_drops_total``.

Thresholds mirror the TS side exactly so cross-language drop
semantics are identical:

- ``MAX_SPAN_PAYLOAD_BYTES``      = 256 KB
- ``MAX_COMPRESSED_CHUNK_BYTES``  = 64 KB
- ``HEAVY_ATTRIBUTE_VALUE_BYTES`` = 8 KB

Resolution order for what counts as "payload":

1. Well-known prompt/response keys: ``foxhound.input``,
   ``foxhound.output``, ``gen_ai.prompt``, ``gen_ai.completion``,
   ``gen_ai.request.messages``, ``gen_ai.response.content``,
   ``tool.parameters``, ``tool.arguments``, ``tool.output``,
   ``tool.input``, bare ``input``/``output``.

2. Individual attributes whose string value alone is ``>= 8 KB``.

3. Span events whose attributes are heavy in aggregate; the event
   name and time are preserved, attribute payload is dropped.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Literal

MAX_SPAN_PAYLOAD_BYTES = 256 * 1024
MAX_COMPRESSED_CHUNK_BYTES = 64 * 1024
HEAVY_ATTRIBUTE_VALUE_BYTES = 8 * 1024

_WELL_KNOWN_PAYLOAD_KEYS: frozenset[str] = frozenset(
    {
        "foxhound.input",
        "foxhound.output",
        "gen_ai.prompt",
        "gen_ai.completion",
        "gen_ai.request.messages",
        "gen_ai.response.content",
        "tool.parameters",
        "tool.arguments",
        "tool.output",
        "tool.input",
        "input",
        "output",
    }
)


@dataclass(frozen=True)
class DropRecord:
    """Structured record emitted when a span's payload is trimmed."""

    org_id: str
    trace_id: str
    span_id: str
    reason: Literal["oversize"]
    dropped_fields: tuple[str, ...]
    original_bytes: int
    retained_bytes: int
    timestamp: str


def _string_value_bytes(v: Any) -> int:
    """Cheap UTF-8 length probe."""
    if not isinstance(v, str):
        return 0
    return len(v.encode("utf-8"))


@dataclass
class _PayloadInventory:
    attr_keys: list[str] = field(default_factory=list)
    event_indices: list[int] = field(default_factory=list)
    total_bytes: int = 0


def _inventory_payload(span: dict[str, Any]) -> _PayloadInventory:
    inv = _PayloadInventory()
    for k, v in dict(span.get("attributes", {}) or {}).items():
        b = _string_value_bytes(v)
        is_well_known = k in _WELL_KNOWN_PAYLOAD_KEYS
        is_heavy = b >= HEAVY_ATTRIBUTE_VALUE_BYTES
        if is_well_known or is_heavy:
            inv.attr_keys.append(k)
            inv.total_bytes += b
    events = span.get("events", []) or []
    for i, ev in enumerate(events):
        ev_bytes = 0
        for _, v in dict(ev.get("attributes", {}) or {}).items():
            ev_bytes += _string_value_bytes(v)
        if ev_bytes >= HEAVY_ATTRIBUTE_VALUE_BYTES:
            inv.event_indices.append(i)
            inv.total_bytes += ev_bytes
    return inv


def enforce_cap(
    span: dict[str, Any],
    org_id: str,
    on_drop: "Any",
) -> dict[str, Any]:
    """Enforce the per-span payload cap.

    Operates on the payload-dict shape produced by ``Tracer.to_payload()``
    (see ``tracer.py``). Returns the same dict reference when below the
    cap; returns a new dict with payload fields removed when above.

    ``on_drop`` is called with a :class:`DropRecord` per drop. The
    caller supplies ``org_id`` because the internal span dict does not
    carry org context; the wire encoder adds it separately, and drop
    records must stay org-scoped for the ``foxhound_ingest_oversize_drops_total``
    counter on the API side.
    """
    inventory = _inventory_payload(span)
    if inventory.total_bytes < MAX_SPAN_PAYLOAD_BYTES:
        return span

    attrs_in = dict(span.get("attributes", {}) or {})
    retained_attrs: dict[str, Any] = {
        k: v for k, v in attrs_in.items() if k not in inventory.attr_keys
    }
    retained_bytes = sum(_string_value_bytes(v) for v in retained_attrs.values())
    retained_attrs["foxhound.payload_dropped"] = True
    retained_attrs["foxhound.payload_original_bytes"] = inventory.total_bytes

    events_in = list(span.get("events", []) or [])
    trimmed_events: list[dict[str, Any]] = []
    for i, ev in enumerate(events_in):
        if i not in inventory.event_indices:
            trimmed_events.append(ev)
            continue
        trimmed_events.append(
            {
                "timeMs": ev.get("timeMs"),
                "name": ev.get("name"),
                "attributes": {"foxhound.event_payload_dropped": True},
            }
        )

    trimmed: dict[str, Any] = dict(span)
    trimmed["attributes"] = retained_attrs
    trimmed["events"] = trimmed_events

    record = DropRecord(
        org_id=org_id,
        trace_id=span.get("traceId", ""),
        span_id=span.get("spanId", ""),
        reason="oversize",
        dropped_fields=tuple(
            list(inventory.attr_keys)
            + [f"events[{i}].attributes" for i in inventory.event_indices]
        ),
        original_bytes=inventory.total_bytes,
        retained_bytes=retained_bytes,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    )
    if on_drop is not None:
        on_drop(record)
    return trimmed


def enforce_cap_on_spans(
    spans: list[dict[str, Any]],
    org_id: str,
    on_drop: "Any",
) -> list[dict[str, Any]]:
    """Apply :func:`enforce_cap` to every span. Returns the same list
    reference when nothing was trimmed; otherwise a new list."""
    changed = False
    out: list[dict[str, Any]] = []
    for original in spans:
        capped = enforce_cap(original, org_id, on_drop)
        if capped is not original:
            changed = True
        out.append(capped)
    return out if changed else spans
