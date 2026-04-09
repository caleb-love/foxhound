<p align="center">
  <img src="https://github.com/caleb-love/foxhound/raw/main/.github/logo-wordmark.png" alt="Foxhound" width="480" />
</p>

<h1 align="center">Foxhound</h1>

<p align="center">
  <strong>The open-source, self-hosted observability platform for AI agent fleets.</strong><br />
  Trace, replay, and audit every agent decision — from tool call to business outcome.
</p>

<p align="center">
  <a href="https://github.com/caleb-love/foxhound/actions"><img src="https://github.com/caleb-love/foxhound/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/caleb-love/foxhound/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@foxhound-ai/sdk"><img src="https://img.shields.io/npm/v/@foxhound-ai/sdk.svg?label=npm" alt="npm" /></a>
  <a href="https://pypi.org/project/foxhound-ai/"><img src="https://img.shields.io/pypi/v/foxhound-ai.svg?label=python" alt="PyPI" /></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#sdks">SDKs</a> ·
  <a href="#self-hosting">Self-Hosting</a> ·
  <a href="#contributing">Contributing</a>
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
- **SSO / SAML 2.0 / OIDC** for enterprise identity providers (Okta, Azure AD)
- **Alerting & notifications** via PagerDuty, GitHub, Linear, and webhooks

## Features

- **Trace Explorer** — Browse the full span tree of any agent run
- **Session Replay** — Reconstruct agent state at any point in execution
- **Run Diff** — Compare two runs side-by-side, spot every divergence
- **Audit Log** — Tamper-evident record of every agent action
- **Alert Rules** — Route to PagerDuty, GitHub, Linear, or webhooks
- **SSO / SAML 2.0** — Enterprise identity with Okta and Azure AD
- **OTel Ingestion** — Accept OpenTelemetry spans alongside agent traces

## Quickstart

```bash
git clone https://github.com/caleb-love/foxhound.git && cd foxhound
pnpm install
docker compose -f docker-compose.dev.yml up -d
cp apps/api/.env.example apps/api/.env   # set JWT_SECRET
pnpm --filter @foxhound/db db:migrate
pnpm dev                                 # API → localhost:3001
```

> **Dashboard:** [caleb-love/foxhound-web](https://github.com/caleb-love/foxhound-web)

## SDKs

First-party SDKs for TypeScript and Python with auto-instrumentation for major agent frameworks.

| Framework        | SDK                 | Auto-instrumentation |
| ---------------- | ------------------- | -------------------- |
| LangGraph        | Python              | Yes                  |
| Claude Agent SDK | Python + TypeScript | Yes                  |
| CrewAI           | Python              | Yes                  |
| AutoGen          | Python              | Yes                  |
| OpenAI Agents    | Python              | Yes                  |
| OpenTelemetry    | Any                 | Protocol-level       |

### Install

```bash
npm install @foxhound-ai/sdk    # TypeScript
pip install foxhound-ai          # Python
```

### Example

```python
from fox_sdk import FoxClient

fox = FoxClient(api_key="sk-...", endpoint="https://your-foxhound-instance.com")

async with fox.trace(agent_id="support-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "refund policy")
    span.end()
```

Framework-specific extras: `pip install "foxhound-ai[langgraph]"`, `"foxhound-ai[claude-agent]"`, `"foxhound-ai[crewai]"`, `"foxhound-ai[autogen]"`, `"foxhound-ai[openai-agents]"`.

## Self-Hosting

Foxhound is designed to be self-hosted. You need PostgreSQL 16+ and Node.js 20+. See `apps/api/.env.example` for all configuration options.

## Development

**Stack:** TypeScript · Node.js 20 · pnpm workspaces · Turborepo · Fastify · Drizzle ORM · PostgreSQL 16

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm typecheck      # TypeScript type checking
pnpm format         # Format with Prettier
```

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
