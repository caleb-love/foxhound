<p align="center">
  <img src="https://github.com/caleb-love/foxhound/raw/main/.github/logo-wordmark.png" alt="Foxhound" width="480" />
</p>

<p align="center">
  <strong>Compliance-grade observability for AI agent fleets.</strong><br />
  Trace every decision. Evaluate every response. Budget every dollar.
</p>

<p align="center">
  <a href="https://github.com/caleb-love/foxhound/actions"><img src="https://github.com/caleb-love/foxhound/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/caleb-love/foxhound/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@foxhound-ai/sdk"><img src="https://img.shields.io/npm/v/@foxhound-ai/sdk.svg?label=npm" alt="npm" /></a>
  <a href="https://pypi.org/project/foxhound-ai/"><img src="https://img.shields.io/pypi/v/foxhound-ai.svg?label=pypi" alt="PyPI" /></a>
  <a href="https://www.npmjs.com/package/@foxhound-ai/mcp-server"><img src="https://img.shields.io/npm/v/@foxhound-ai/mcp-server.svg?label=mcp" alt="MCP Server" /></a>
</p>

<p align="center">
  <a href="https://docs.foxhound.dev">Docs</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#integrations">Integrations</a> ·
  <a href="#self-hosting">Self-Hosting</a> ·
  <a href="https://github.com/caleb-love/foxhound/blob/main/CHANGELOG.md">Changelog</a>
</p>

---

## Why Foxhound?

AI agents make thousands of autonomous decisions per session — calling tools, invoking LLMs, branching workflows. When something goes wrong, you need more than logs. You need **full decision traceability**: what the agent decided, what data it had, and why it diverged from the expected path.

Foxhound is an open-source observability platform purpose-built for production AI agent systems. It gives your team structured tracing, automated evaluation, cost controls, and compliance tooling — all self-hostable and extensible.

## Features

| Category | Capabilities |
| --- | --- |
| **Tracing** | Structured span trees for every agent run · Session Replay · Run Diff to compare executions side-by-side |
| **Evaluation** | LLM-as-judge evaluators · Dataset curation from production traces · Experiment runner with A/B comparison |
| **Cost & SLA** | Per-agent cost budgets with SDK callbacks · SLA monitoring for duration and success rate targets · Automated alerting |
| **Regression Detection** | Behavioral baselines per agent version · Automated drift detection across deployments |
| **Prompt Management** | Versioned prompt templates · Label-based promotion (staging → production) |
| **MCP Server** | 37 AI debugging tools for Claude Code, Cursor, Windsurf, and other MCP clients |
| **Quality Gate** | GitHub Actions integration — block PRs that fail eval thresholds |
| **Alerts** | Multi-channel notifications: Slack, PagerDuty, GitHub Issues, Linear, webhooks |
| **Audit & Compliance** | Full audit log · Multi-tenant data isolation · API key management (SHA-256 hashed) |

## Quickstart

### 1. Start the platform

```bash
git clone https://github.com/caleb-love/foxhound.git && cd foxhound
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis
cp apps/api/.env.example apps/api/.env            # set JWT_SECRET
pnpm --filter @foxhound/db db:migrate
pnpm dev                                          # API → localhost:3001
```

### 2. Instrument your agent

```python
pip install foxhound-ai

from foxhound import FoxhoundClient

fox = FoxhoundClient(api_key="fh-...", endpoint="http://localhost:3001")

async with fox.trace(agent_id="support-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "refund policy")
    span.end()
```

### 3. Explore traces

Open the [Foxhound dashboard](https://github.com/caleb-love/foxhound-web) to browse span trees, replay sessions, and diff runs.

## Integrations

First-party SDKs for **Python** and **TypeScript** with auto-instrumentation for major agent frameworks.

| Framework | SDK | Auto-instrumentation |
| --- | --- | --- |
| LangGraph | Python | ✓ |
| CrewAI | Python | ✓ |
| Pydantic AI | Python | ✓ |
| OpenAI Agents | Python | ✓ |
| Google ADK | Python | ✓ |
| Claude Agent SDK | Python + TypeScript | ✓ |
| AWS Bedrock AgentCore | Python | ✓ |
| Mastra | TypeScript | ✓ |
| OpenTelemetry | Any | Protocol-level |

**Install:**

```bash
pip install foxhound-ai                              # Python
pip install "foxhound-ai[langgraph]"                 # with LangGraph auto-instrumentation
pip install "foxhound-ai[crewai,pydantic-ai]"        # multiple extras
npm install @foxhound-ai/sdk                         # TypeScript
```

## Tooling

| Tool | Install | What it does |
| --- | --- | --- |
| **Python SDK** | `pip install foxhound-ai` | Trace, evaluate, and budget AI agents |
| **TypeScript SDK** | `npm install @foxhound-ai/sdk` | Same, for Node.js / Deno / Bun |
| **CLI** | `npm install -g @foxhound-ai/cli` | Query traces, manage keys and alerts from the terminal |
| **MCP Server** | `npm install -g @foxhound-ai/mcp-server` | 37 debugging tools for AI-native IDEs |
| **GitHub Action** | `caleb-love/foxhound-quality-gate` | CI quality gate — block PRs that fail eval |

## Architecture

```
                  ┌──────────────────────────────────────────────┐
  SDKs / OTel ──▶ │  API (Fastify)          Worker (BullMQ)      │
                  │  80 endpoints            7 queue processors   │
                  │  ┌───────────┐           ┌────────────────┐  │
                  │  │ Traces    │           │ Evaluator      │  │
                  │  │ Evals     │           │ Experiment     │  │
                  │  │ Budgets   │           │ Cost Monitor   │  │
                  │  │ Prompts   │           │ SLA Check      │  │
                  │  │ Alerts    │           │ Regression     │  │
                  │  └───────────┘           └────────────────┘  │
                  │          │                       │            │
                  │     PostgreSQL 16           Redis / BullMQ    │
                  └──────────────────────────────────────────────┘
```

**Stack:** TypeScript · Node.js 20 · pnpm · Turborepo · Fastify · Drizzle ORM · PostgreSQL 16 · Redis · BullMQ · Stripe

## Self-Hosting

Foxhound is designed to run on your infrastructure. You need PostgreSQL 16+ and Node.js 20+. Redis is required for the worker (evaluation, cost monitoring, SLA checks).

See [`apps/api/.env.example`](apps/api/.env.example) for all configuration options.

**Dashboard:** [caleb-love/foxhound-web](https://github.com/caleb-love/foxhound-web)

## Development

```bash
pnpm build            # Build all packages (Turborepo)
pnpm test             # Run all tests (Vitest)
pnpm test:coverage    # Tests with coverage report
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript type checking
pnpm format           # Format with Prettier
```

### Monorepo structure

```
apps/api/               Fastify REST API
apps/worker/            BullMQ background workers
packages/db/            Drizzle schema + migrations
packages/sdk/           TypeScript SDK
packages/sdk-py/        Python SDK
packages/cli/           CLI
packages/mcp-server/    MCP debugging tools
packages/api-client/    Typed HTTP client (shared)
packages/billing/       Stripe + entitlements
packages/notifications/ Multi-provider alert dispatch
packages/types/         Shared type definitions
docs-site/              Docusaurus documentation (22 pages)
```

## Security

- JWT authentication with 30-day expiry
- API keys SHA-256 hashed, never stored plaintext
- HttpOnly / Secure / SameSite cookies
- CSP headers via Helmet
- Rate limiting on all endpoints
- All data queries scoped by `org_id` — strict multi-tenant isolation
- Parameterized queries throughout (no string interpolation)

To report a vulnerability, open a [security advisory](https://github.com/caleb-love/foxhound/security/advisories/new).

## Contributing

We welcome contributions. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

- [Open an issue](https://github.com/caleb-love/foxhound/issues/new) for bugs and feature requests
- [Browse good first issues](https://github.com/caleb-love/foxhound/issues?q=label%3A%22good+first+issue%22)
- [Read the docs](https://docs.foxhound.dev)

## License

MIT — see [`LICENSE`](LICENSE).
