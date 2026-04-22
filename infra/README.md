# `infra/` — Local observability & data-plane stack

Compose files + config for the local-dev-equivalent of Foxhound's operational
stack. Landed incrementally by the Scale Readiness program; today contains:

- **`compose/observability.yml`** — Prometheus + Grafana (WP02).
- **`prom/prometheus.yml`** — Prometheus scrape config.
- **`grafana/dashboards/ingest.json`** — Ingest SLI dashboard (WP02).
- **`grafana/provisioning/`** — Grafana datasource + dashboard loader.

Planned additions:

- `compose/blob-store.yml` — MinIO (WP10).

Landed:

- `compose/queue.yml` — NATS + Redpanda + Redis Streams (WP08).
- `compose/clickhouse.yml` — ClickHouse (WP09).

## Usage

```bash
# From repo root:
docker compose -f infra/compose/observability.yml up

# In another terminal:
pnpm --filter api dev

# Browse:
#   Grafana     http://localhost:3100   (anonymous read, admin/admin write)
#   Prometheus  http://localhost:9090
#   API metrics http://localhost:3000/metrics
```

The dashboard at `http://localhost:3100/d/foxhound-ingest-slis` renders the
eight ingest SLIs defined in [RFC-002](../docs/rfcs/RFC-002-self-observability.md).
Some panels (consumer lag, oversize drops) remain flat until their
corresponding WPs (WP08, WP05) land — that is expected.

## Tearing down

```bash
docker compose -f infra/compose/observability.yml down -v
```

(`-v` removes the volumes so next start is clean; omit to preserve Grafana
dashboards you may have edited through the UI.)
