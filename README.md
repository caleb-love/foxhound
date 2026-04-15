<div align="center">

<p>
  <img src="docs-site/static/img/foxhound-banner.png" alt="FOXHOUND banner" width="720" />
</p>

### Compliance-grade observability for AI agent fleets.

Trace every decision. Evaluate every response. Budget every dollar.

<p>
  <a href="https://github.com/caleb-love/foxhound/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/caleb-love/foxhound/ci.yml?branch=main&style=flat-square" alt="CI" /></a>
  <a href="https://github.com/caleb-love/foxhound/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-All%20Rights%20Reserved-E8751A?style=flat-square" alt="All Rights Reserved" /></a>
  <a href="https://www.npmjs.com/package/@foxhound-ai/sdk"><img src="https://img.shields.io/npm/v/@foxhound-ai/sdk?style=flat-square&label=sdk" alt="npm sdk" /></a>
  <a href="https://www.npmjs.com/package/@foxhound-ai/mcp-server"><img src="https://img.shields.io/npm/v/@foxhound-ai/mcp-server?style=flat-square&label=mcp" alt="npm mcp" /></a>
  <a href="https://pypi.org/project/foxhound-ai/"><img src="https://img.shields.io/pypi/v/foxhound-ai?style=flat-square&label=python" alt="PyPI" /></a>
</p>

<p>
  <a href="https://docs.foxhound.caleb-love.com">Docs</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#tooling">Tooling</a> ·
  <a href="#self-hosting">Self-Hosting</a> ·
  <a href="#development">Development</a>
</p>

</div>

---

> **Licensing notice**
> This repository is publicly visible for reference and evaluation only.
> No permission is granted to use, copy, modify, distribute, sublicense, or sell this software without prior written permission from Caleb Love.
> Licensing inquiries: hello@caleb-love.com
>
> See [LICENSE](./LICENSE) for full terms.

## What is Foxhound?

Foxhound is a source-available observability platform purpose-built for AI agent systems. Generic APM and logging tools do not model agent behavior well: tool calls, LLM invocations, branching workflows, replay, evaluation, and regression detection all get flattened into the wrong abstractions.

Foxhound gives you the missing layer:

- **trace every agent run** as a structured span tree
- **compare executions** to see exactly where behavior diverged
- **evaluate responses** with datasets, experiments, and LLM-as-judge workflows
- **enforce budgets and SLAs** before costs and latency drift silently
- **audit and isolate tenant data** for security-sensitive deployments

**Not a generic logging product. AI agent observability.**

## Core capabilities

| Area                   | What you get                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Tracing**            | Structured traces and spans for every run · trace explorer · metadata and event capture   |
| **Replay & Diff**      | Session replay · run diff · trace timeline inspection                                     |
| **Evaluation**         | LLM-as-judge evaluators · dataset curation from production traces · experiment comparison |
| **Agent intelligence** | Cost budgets · SLA monitoring · regression detection by agent version                     |
| **Prompt management**  | Prompt templates · label-based promotion such as `staging` → `production`                 |
| **Operations**         | API keys · notifications · audit logging · multi-tenant isolation                         |
| **Developer tooling**  | TypeScript SDK · Python SDK · CLI · MCP server · GitHub quality gate                      |

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/caleb-love/foxhound.git
cd foxhound
pnpm install
```

### 2. Start local infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @foxhound/db db:migrate
```

### 3. Run the app

```bash
pnpm dev       # API
pnpm dev:web   # dashboard in another terminal
```

Default local endpoints:

- API: `http://localhost:3000`
- Web: `http://localhost:3001`

### 4. Send your first trace

#### Python

```bash
pip install foxhound-ai
```

```python
from foxhound import FoxhoundClient

fox = FoxhoundClient(
    api_key="fh-...",
    endpoint="http://localhost:3000",
)

async with fox.trace(agent_id="support-agent") as tracer:
    span = tracer.start_span(name="tool:search", kind="tool_call")
    span.set_attribute("query", "refund policy")
    span.end()
```

#### TypeScript

```bash
npm install @foxhound-ai/sdk
```

```ts
import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "http://localhost:3000",
});

const trace = fox.trace({ agentId: "support-agent" });
const span = trace.startSpan({ name: "tool:search", kind: "tool_call" });
span.setAttribute("query", "refund policy");
span.end();
await trace.flush();
```

## Tooling

| Artifact           | Install                                  | Purpose                                                        |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| **Python SDK**     | `pip install foxhound-ai`                | Instrument Python agent systems                                |
| **TypeScript SDK** | `npm install @foxhound-ai/sdk`           | Instrument Node.js / TypeScript runtimes                       |
| **CLI**            | `npm install -g @foxhound-ai/cli`        | Inspect traces and operate Foxhound from the terminal          |
| **MCP Server**     | `npm install -g @foxhound-ai/mcp-server` | Query Foxhound from Claude Code, Cursor, and other MCP clients |
| **GitHub Action**  | `caleb-love/foxhound-quality-gate`       | Block PRs that fail eval or quality thresholds                 |

## Architecture

```text
SDKs / OTLP  ->  API (Fastify)  ->  PostgreSQL
                  |
                  ->  Worker (BullMQ) -> Redis
                  ->  Web dashboard (Next.js)
```

Current monorepo layout:

```text
apps/api/               Fastify REST API
apps/web/               Next.js dashboard
apps/worker/            BullMQ workers
packages/sdk/           TypeScript SDK
packages/sdk-py/        Python SDK
packages/cli/           CLI
packages/mcp-server/    MCP server
packages/api-client/    Typed API client
packages/db/            Drizzle schema + queries
packages/types/         Shared types
packages/billing/       Billing + entitlements
packages/notifications/ Notification delivery
```

## Self-hosting

Foxhound is designed to run on your own infrastructure.

Minimum stack:

- PostgreSQL 16+
- Redis
- Node.js 20+
- pnpm 9+

Primary local/dev commands:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

For API configuration, see:

- `apps/api/.env.example`

## Security

Foxhound is built for security-sensitive, multi-tenant environments.

Current repo expectations include:

- API keys hashed at rest
- tenant-scoped data access via `org_id`
- JWT auth for user-facing operations
- audit logging for sensitive actions
- rate limiting and security headers on the API/web surfaces

If you discover a vulnerability, use GitHub security advisories or follow `SECURITY.md` if present.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format
```

Useful dev commands:

```bash
pnpm dev       # API only
pnpm dev:web   # web only
pnpm dev:all   # API + web
pnpm --filter web verify   # canonical web verification lane
```

For the web preview surface, `/sandbox` is canonical and `/demo` is compatibility-only. See `apps/web/README.md` and `docs/reference/sandbox-compatibility-retirement-checklist.md`.

## Contributing

Contributions are welcome.

- open issues for bugs and feature requests
- keep multi-tenant safety and security review standards high
- prefer small, verifiable changes over broad speculative refactors

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution conventions.

## License

All rights reserved. This repository is public for reference and evaluation only.
No permission is granted to use, copy, modify, distribute, sublicense, or sell this software without prior written permission.
See [LICENSE](LICENSE) and contact hello@caleb-love.com for licensing inquiries.
