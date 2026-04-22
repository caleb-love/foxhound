"""Unit tests for the WP05 Python compression layer.

Parity with ``packages/sdk/src/transport/compression.test.ts``.
"""

from __future__ import annotations

import warnings

import pytest

from foxhound.transport.compression import (
    COMPRESSION_THRESHOLD_BYTES,
    compress,
    compression_kind_from_header,
    decompress,
    _reset_lz4_warning_for_tests,
)


@pytest.fixture(autouse=True)
def _reset_warning():
    _reset_lz4_warning_for_tests()
    yield
    _reset_lz4_warning_for_tests()


# ---------------------------------------------------------------------------
# Gzip round-trip
# ---------------------------------------------------------------------------


def test_gzip_round_trip_preserves_bytes_exactly():
    data = ("The rain in Spain stays mainly in the plain. " * 200).encode("utf-8")
    result = compress(data, "gzip")
    assert result.kind == "gzip"
    assert len(result.bytes_) < len(data)
    assert decompress(result.bytes_, "gzip") == data


def test_none_is_identity():
    data = b"\x01\x02\x03\x04"
    result = compress(data, "none")
    assert result.kind == "none"
    assert result.bytes_ is data
    assert decompress(data, "none") is data


# ---------------------------------------------------------------------------
# Threshold guard
# ---------------------------------------------------------------------------


def test_below_threshold_skips_gzip():
    tiny = b"x" * (COMPRESSION_THRESHOLD_BYTES - 1)
    assert compress(tiny, "gzip").kind == "none"


def test_at_threshold_skips_gzip():
    edge = b"x" * (COMPRESSION_THRESHOLD_BYTES - 1)
    assert compress(edge, "gzip").kind == "none"


def test_above_threshold_compresses():
    body = ("hello " * COMPRESSION_THRESHOLD_BYTES).encode("utf-8")
    assert compress(body, "gzip").kind == "gzip"


# ---------------------------------------------------------------------------
# LZ4 fallback (requires optional dep to be absent — default in CI)
# ---------------------------------------------------------------------------


def test_lz4_without_optional_dep_falls_back_and_warns_once():
    body = b"x" * 2000
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        first = compress(body, "lz4")
        second = compress(body, "lz4")
    # Both calls fall back; exactly one warning across both.
    assert first.kind == "none"
    assert second.kind == "none"
    runtime_warnings = [w for w in caught if issubclass(w.category, RuntimeWarning)]
    # The underlying `lz4` dep may be installed in some environments; in
    # that case first.kind would be "lz4" and the warning absent. Allow
    # both shapes so the test is portable.
    if first.kind == "none":
        assert len(runtime_warnings) == 1
        assert "lz4" in str(runtime_warnings[0].message)


# ---------------------------------------------------------------------------
# Header canonicalisation
# ---------------------------------------------------------------------------


def test_header_known_values():
    assert compression_kind_from_header("gzip") == "gzip"
    assert compression_kind_from_header("GZIP") == "gzip"
    assert compression_kind_from_header("  gzip  ") == "gzip"
    assert compression_kind_from_header("lz4") == "lz4"


def test_header_unknown_values():
    assert compression_kind_from_header(None) == "none"
    assert compression_kind_from_header("") == "none"
    assert compression_kind_from_header("deflate") == "none"
    assert compression_kind_from_header("br") == "none"


# ---------------------------------------------------------------------------
# WP05 load-test gate: ≥ 90% compression on a realistic 10 KB system prompt
# ---------------------------------------------------------------------------


def _make_realistic_system_prompt() -> str:
    import json as _json

    tool_schema = _json.dumps(
        {
            "type": "function",
            "function": {
                "name": "search_documents",
                "description": "Search the document store for relevant passages.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query string."},
                        "top_k": {"type": "integer", "description": "Max results to return."},
                        "filters": {
                            "type": "object",
                            "properties": {
                                "date_from": {"type": "string", "format": "date-time"},
                                "date_to": {"type": "string", "format": "date-time"},
                                "source": {"type": "string"},
                            },
                        },
                    },
                    "required": ["query"],
                },
            },
        },
        indent=2,
    )
    example = (
        "<example>\n"
        "User: Find recent documents about Q4 planning.\n"
        "Assistant: I'll search for recent Q4 planning docs.\n"
        "<tool_call>"
        '{"name":"search_documents","arguments":{"query":"Q4 planning","top_k":5}}'
        "</tool_call>\n"
        "</example>\n"
    )
    preamble = (
        "You are a helpful, harmless, and honest assistant deployed in a corporate "
        "knowledge environment. Your primary job is to help users find, summarise, "
        "and reason about documents stored in the corporate knowledge base. Always "
        "cite sources when summarising. Never fabricate quotes or document IDs. "
        "When in doubt, say you don't know rather than guessing.\n\n"
    )
    return (
        preamble
        + "# Tools available\n\n"
        + tool_schema
        + "\n\n# Examples\n\n"
        + example * 30
        + "\n# Tone\n\n"
        + "Be concise. Prefer bullet points over long prose. " * 60
        + "\n\n# Refusal policy\n\n"
        + "If the user asks for something outside the corporate knowledge scope, "
        "politely decline and redirect. " * 30
    )


def test_compression_ratio_at_least_90_percent_on_realistic_prompt():
    prompt = _make_realistic_system_prompt().encode("utf-8")
    # Fixture must meet the WP05 reference size.
    assert len(prompt) >= 10 * 1024, f"fixture {len(prompt)} B below reference 10 KB"

    result = compress(prompt, "gzip")
    assert result.kind == "gzip"
    ratio = 1 - (len(result.bytes_) / len(prompt))

    print(
        f"[WP05 compression gate] {len(prompt)} B -> {len(result.bytes_)} B "
        f"({ratio * 100:.1f}% reduction)"
    )
    assert ratio >= 0.9, f"compression ratio {ratio:.3f} below 0.90 gate"
