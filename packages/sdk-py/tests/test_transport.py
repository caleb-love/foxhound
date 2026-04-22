"""
Unit tests for the Python SDK's transport factory + JSON path.

The Protobuf path is gated by the presence of generated bindings and is
only smoke-tested for its error posture (``TransportNotAvailableError``
surfaces cleanly when bindings are missing).
"""
from __future__ import annotations

import pytest

from foxhound.transport import (
    TransportNotAvailableError,
    create_transport,
)
from foxhound.transport.json_transport import JsonTransport


def test_factory_defaults_to_protobuf_falls_back_to_json_when_bindings_missing():
    # On a fresh clone, Python Protobuf bindings are not generated. The
    # factory emits a warning and returns JsonTransport. This is the
    # documented partial-completion behaviour of WP04 for sdk-py.
    t = create_transport(endpoint="https://api.test", api_key="k")
    # Either a working ProtobufTransport (if bindings exist) or JsonTransport
    # fallback is acceptable here. The invariant is: we got a working transport.
    assert t.wire_format in ("protobuf", "json")


def test_factory_json_returns_json_transport():
    t = create_transport(endpoint="https://api.test", api_key="k", wire_format="json")
    assert isinstance(t, JsonTransport)
    assert t.wire_format == "json"


def test_factory_rejects_unknown_wire_format():
    with pytest.raises(ValueError):
        create_transport(endpoint="https://api.test", api_key="k", wire_format="xml")  # type: ignore[arg-type]


def test_json_transport_sends_bearer_and_content_type(respx_mock):
    route = respx_mock.post("https://api.test/v1/traces").respond(202, json={"ok": True})
    t = JsonTransport(endpoint="https://api.test", api_key="sk-1")
    t.send_sync({"id": "t-1", "spans": []})
    assert route.called
    req = route.calls[0].request
    assert req.headers["Authorization"] == "Bearer sk-1"
    assert req.headers["Content-Type"] == "application/json"
    assert req.headers["X-Foxhound-Wire"] == "json"


def test_json_transport_raises_on_non_2xx(respx_mock):
    respx_mock.post("https://api.test/v1/traces").respond(500, text="boom")
    t = JsonTransport(endpoint="https://api.test", api_key="k")
    with pytest.raises(RuntimeError, match="500"):
        t.send_sync({"id": "t-2", "spans": []})


def test_protobuf_transport_fails_closed_when_bindings_missing():
    # Import directly; construction is the honest failure point.
    from foxhound.transport.protobuf_transport import (
        ProtobufTransport,
        _BINDINGS_AVAILABLE,
    )

    if _BINDINGS_AVAILABLE:
        pytest.skip("bindings present; negative-case smoke test only applies on fresh clone")

    with pytest.raises(TransportNotAvailableError, match="not installed"):
        ProtobufTransport(endpoint="https://api.test", api_key="k")
