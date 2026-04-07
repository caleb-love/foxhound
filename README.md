<p align="center">
  <img src="https://github.com/caleb-love/foxhound/raw/main/.github/logo.png" alt="Foxhound" width="80" height="80" />
</p>

<h1 align="center">Foxhound</h1>

<p align="center">
  <strong>Compliance-grade observability for AI agent fleets.</strong><br />
  Trace, replay, and audit every agent decision — from tool call to business outcome.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#sdks">SDKs</a> ·
  <a href="#self-hosting">Self-Hosting</a> ·
  <a href="#pricing">Pricing</a> ·
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/caleb-love/foxhound/actions"><img src="https://github.com/caleb-love/foxhound/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/caleb-love/foxhound/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@foxhound/sdk"><img src="https://img.shields.io/npm/v/@foxhound/sdk.svg?label=sdk" alt="npm" /></a>
  <a href="https://pypi.org/project/fox-sdk/"><img src="https://img.shields.io/pypi/v/fox-sdk.svg?label=python" alt="PyPI" /></a>
</p>

---

## Why Foxhound?

AI agents make thousands of autonomous decisions per session — calling tools, invoking LLMs, branching workflows. When something goes wrong, you need more than logs. You need **full decision traceability**: what the agent decided, what data it had, and why it diverged from the expected path.

Foxhound gives your team:

- **Structured traces** with spans for every tool call, LLM invocation, and agent step
- **Session replay** to reconstruct agent state at any point in a run
- **Run diffing** to compare two executions side-by-side and pinpoint divergences
- **Audit logs** for compliance teams that need a tamper-evident record of every agent action
- **Multi-tenant isolation** so each organization's data is siloed from day one

## Features

### Trace Explorer

Browse, search, and filter agent traces. Every trace captures the full span tree — tool calls, LLM calls, agent steps, and custom spans — with timestamps, attributes, and events.

### Span Replay

Select any span in a trace and reconstruct the agent's exact state at that moment: which LLM calls had been made, which tools had been invoked, and what data was available. Available on Pro and Enterprise plans.

### Run Diff

Compare two agent runs side-by-side. Foxhound aligns spans using a longest-common-subsequence algorithm and highlights every divergence — status changes, attribute differences, added or removed spans, and name changes. Available on Pro and Enterprise plans.

### Audit Log

Enterprise-grade audit trail. Every agent action produces a structured event with org, agent, session, trace, and span context. Query by agent, time range, or event type. Available on Enterprise plans.

### Billing & Usage Metering

Built-in Stripe integration with metered billing. Free tier includes 10K spans/month. Pro includes 500K with overage billing. Enterprise gets unlimited spans with custom pricing.

## Architecture

```
foxhound/
├── apps/
│   ├── api/          # Fastify REST API (port 3001)
│   └── web/          # Next.js dashboard (port 3000)
├── packages/
│   ├── sdk/          # TypeScript SDK — @foxhound/sdk
│   ├── sdk-py/       # Python SDK — fox-sdk (PyPI)
│   ├── types/        # Shared TypeScript type definitions
│   ├── db/           # Drizzle ORM schema + migrations (PostgreSQL)
│   └── billing/      # Stripe integration + entitlement engine
├── .github/
│   └── workflows/    # GitHub Actions CI
└── docker-compose.dev.yml
```

**Stack:** TypeScript · Node.js 20 · pnpm workspaces · Turborepo · Fastify · Next.js 14 · Drizzle ORM · PostgreSQL 16 · Stripe

## Quickstart

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [pnpm](https://pnpm.io) ≥ 9
- [Docker](https://www.docker.com) (for PostgreSQL)

### 1. Clone and install

```bash
git clone https://github.com/caleb-love/foxhound.git
cd foxhound
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your JWT_SECRET and (optionally) Stripe keys
```

### 4. Run migrations

```bash
pnpm --filter @foxhound/db db:migrate
```

### 5. Start development servers

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001 |
| Health check | http://localhost:3001/health |

## SDKs

Foxhound ships first-party SDKs for TypeScript and Python. Both support manual instrumentation and framework-specific auto-instrumentation.

### TypeScript

```bash
npm install @foxhound/sdk
```

```typescript
import { FoxhoundClient } from "@foxhound/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://your-foxhound-instance.com",
});

const tracer = fox.startTrace({ agentId: "support-agent" });

const span = tracer.startSpan({
  name: "tool_call:knowledge_search",
  kind: "tool_call",
});
span.setAttribute("query", "refund policy");
span.end();

const llmSpan = tracer.startSpan({
  name: "llm_call:gpt-4",
  kind: "llm_call",
});
llmSpan.setAttribute("model", "gpt-4o");
llmSpan.setAttribute("tokens.prompt", 340);
llmSpan.setAttribute("tokens.completion", 128);
llmSpan.end();

await tracer.flush();
```

### Python

```bash
pip install fox-sdk
```

```python
from fox_sdk import FoxClient

fox = FoxClient(
    api_key="sk-...",
    endpoint="https://your-foxhound-instance.com",
)

# Async context manager — auto-flushes on exit
async with fox.trace(agent_id="support-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "refund policy")
    span.end()
```

### LangGraph Integration

```bash
pip install "fox-sdk[langgraph]"
```

```python
from fox_sdk import FoxClient
from fox_sdk.integrations.langgraph import FoxCallbackHandler

fox = FoxClient(api_key="sk-...", endpoint="https://your-foxhound-instance.com")

handler = FoxCallbackHandler.from_client(fox, agent_id="my-langgraph-agent")
result = await graph.ainvoke(state, config={"callbacks": [handler]})
await handler.flush()
```

The LangGraph integration automatically maps graph invocations to `workflow` spans, LLM calls to `llm_call` spans, and tool calls to `tool_call` spans — preserving parent-child relationships.

### Local Trace Viewer (CLI)

```bash
foxhound ui --api http://localhost:3001 --api-key sk-...
```

Opens an interactive trace viewer in your browser, connected to your running Foxhound API.

## API Reference

All endpoints are prefixed with `/v1`. Authentication is via Bearer token (JWT or API key).

### Traces

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/traces` | Ingest trace from SDK (202 Accepted) |
| `GET` | `/v1/traces` | List traces with filters and pagination |
| `GET` | `/v1/traces/:id` | Get single trace with all spans |
| `GET` | `/v1/traces/:traceId/spans/:spanId/replay` | Reconstruct agent state at span |
| `GET` | `/v1/runs/diff?runA=:id&runB=:id` | Side-by-side diff of two agent runs |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/auth/signup` | Create user + organization |
| `POST` | `/v1/auth/login` | Authenticate and receive JWT |
| `GET` | `/v1/auth/me` | Current user profile |

### API Keys

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/api-keys` | Create API key (shown once) |
| `GET` | `/v1/api-keys` | List active keys (prefix only) |
| `DELETE` | `/v1/api-keys/:id` | Revoke a key |

### Billing

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/billing/status` | Current plan, usage, billing date |
| `GET` | `/v1/billing/usage` | Span usage and limits for current period |
| `POST` | `/v1/billing/checkout` | Create Stripe checkout session |
| `POST` | `/v1/billing/portal` | Open Stripe customer portal |

## Self-Hosting

Foxhound is designed to be self-hosted. You need:

- PostgreSQL 16+
- Node.js 20+

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `STRIPE_SECRET_KEY` | No | Stripe API key (for billing) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | No | Stripe price ID for Pro monthly |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | No | Stripe price ID for Pro annual |
| `INTERNAL_CRON_SECRET` | No | Secret for internal cron endpoints |
| `LOG_LEVEL` | No | Logging level (default: `info`) |

Stripe configuration is only needed if you want billing/plan gating. Without it, Foxhound runs as a fully functional open-source tracing platform on the free tier.

## Security

Foxhound follows security best practices:

- **Authentication:** JWT tokens (30-day expiry) + API keys (`sk-` prefix, SHA-256 hashed, never stored in plaintext)
- **Cookies:** HttpOnly, Secure, SameSite=Lax — tokens are not accessible to JavaScript
- **CSP:** Content Security Policy headers via Helmet
- **Rate limiting:** Global 60 req/min, auth endpoints 10/min, trace ingestion 1000/min
- **Multi-tenancy:** All data queries scoped by organization ID at the database layer
- **Redirect validation:** Stripe checkout URLs validated before redirect
- **Password hashing:** scrypt with random salt and timing-safe comparison

## Pricing

Foxhound is **open source and free to self-host**. Managed cloud plans are available:

| | Community | Pro | Enterprise |
|---|---|---|---|
| **Price** | Free | $49/mo | Custom |
| **Spans / month** | 10,000 | 500,000 | Unlimited |
| **Data retention** | 7 days | 90 days | 365 days |
| **Projects** | 1 | 10 | Unlimited |
| **Team seats** | 1 | 5 | Unlimited |
| **Trace explorer** | ✓ | ✓ | ✓ |
| **Span replay** | — | ✓ | ✓ |
| **Run diff** | — | ✓ | ✓ |
| **Audit log** | — | — | ✓ |
| **SSO / SAML** | — | — | ✓ |
| **SLA & dedicated CSM** | — | — | ✓ |

Pro annual billing: **$39/mo** (save 20%).

## Development

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm typecheck      # TypeScript type checking
pnpm format         # Format with Prettier
pnpm format:check   # Check formatting
```

### Project Structure

| Package | Description |
|---------|-------------|
| `apps/api` | Fastify REST API — auth, traces, billing, webhooks |
| `apps/web` | Next.js 14 dashboard — trace explorer, settings, pricing |
| `packages/sdk` | TypeScript SDK — `@foxhound/sdk` |
| `packages/sdk-py` | Python SDK — `fox-sdk` with LangGraph integration |
| `packages/db` | Drizzle ORM schema, queries, and migrations |
| `packages/billing` | Stripe integration, entitlements engine, usage metering |
| `packages/types` | Shared TypeScript types (Span, Trace, AuditEvent) |

### CI

GitHub Actions runs on every push and PR to `main`:

1. Lint + format check
2. TypeScript type checking
3. Test suite
4. Full build

## Span Model

Foxhound uses a hierarchical span model inspired by OpenTelemetry:

```
Trace
└── Span (kind: workflow)
    ├── Span (kind: llm_call)
    ├── Span (kind: tool_call)
    │   └── Span (kind: llm_call)
    └── Span (kind: agent_step)
        ├── Span (kind: tool_call)
        └── Span (kind: llm_call)
```

**Span kinds:**
- `tool_call` — External tool invocations (search, API calls, file I/O)
- `llm_call` — LLM / chat model completions
- `agent_step` — High-level agent reasoning steps
- `workflow` — Top-level graph or workflow execution
- `custom` — User-defined spans

Each span carries:
- `attributes` — Key-value metadata (model name, token counts, tool inputs)
- `events` — Timestamped occurrences within the span
- `status` — `ok`, `error`, or `unset`
- `parentSpanId` — Links to parent span for tree reconstruction

## Contributing

We welcome contributions. To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes with tests
4. Run `pnpm lint && pnpm typecheck && pnpm test`
5. Open a pull request

Please open an issue first for large changes so we can discuss the approach.

## License

MIT
