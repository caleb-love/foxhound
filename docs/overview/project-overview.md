# Project Overview

**What it is:** Open-source, self-hosted observability platform for AI agent fleets. Built agent-first — Session Replay, Run Diff, cost budgets, SLA monitoring, behavior regression detection. Multi-tenant from day one. TypeScript + Node.js monorepo (pnpm workspaces + Turborepo). PostgreSQL 16 + Redis + BullMQ worker architecture.

**Current state:** Phase 5 (Developer Experience & Distribution) complete — M001 shipped 10 new MCP debugging tools, OTel integration bridges for Pydantic AI/Mastra/Bedrock AgentCore/Google ADK, a GitHub Actions quality gate, MCP Registry publication artifacts (awaiting manual npm auth + OAuth), and a 21-page Docusaurus documentation site (GitHub Pages deployed, DNS CNAME pending). Phases 0–5 complete. Phase 6 (Prompt Management & Growth) is next.

**Stack:**
- **API:** Fastify, Drizzle ORM, PostgreSQL 16 (Neon), Redis (Upstash), BullMQ
- **SDKs:** Python + TypeScript with framework auto-instrumentation (LangGraph, CrewAI, AutoGen, OpenAI Agents, Claude Agent SDK) + OTel SpanProcessor bridge for Pydantic AI, Mastra, Bedrock AgentCore, Google ADK
- **Worker:** Separate Node.js process for eval, experiments, cost/SLA checks, regression detection
- **MCP Server:** 31 AI debugging tools (trace querying, failure analysis, scoring, evaluators, datasets, alerts, API keys, SLA) — v0.2.0 publication-ready with registry manifest, MIT license, PUBLISH.md guide
- **GitHub Actions:** Quality gate composite action (25KB esbuild bundle) — experiment creation, exponential backoff polling, score comparison, threshold enforcement, idempotent PR comments
- **Documentation:** Docusaurus 3 site (docs-site/) with 21 pages — getting started, SDK reference, integrations, MCP server, CI/CD, evaluation cookbook. GitHub Pages workflow deployed. DNS CNAME for docs.foxhound.dev pending.
- **Infrastructure:** Fly.io (API + worker), Neon (Postgres), Upstash (Redis), Cloudflare (CDN/DDoS)
- **Billing:** Stripe Checkout + Billing Portal, usage metering

**Differentiators:**
- Session Replay — reconstruct agent state at any point in a run
- Run Diff — side-by-side execution comparison
- Eval from traces — production failures become test cases automatically
- Agent cost budgets with SDK callbacks
- Agent SLA monitoring (duration + success rate)
- Behavior regression detection across agent versions
- Multi-agent coordination tracking
- Unlimited users on all pricing tiers
- MCP server with AI debugging tools (failure explanation, error classification, manual scoring, evaluator triggering, dataset curation from IDE)
- GitHub Actions quality gate for CI/CD integration
- OTel bridge for one-call framework instrumentation

**Packages:**
- `packages/db` — Drizzle schema + migrations
- `packages/api-client` — Typed TypeScript client
- `packages/sdk` — TypeScript SDK (includes OTel SpanProcessor bridge)
- `packages/sdk-py` — Python SDK (includes OTel SpanProcessor bridge)
- `packages/cli` — CLI (`foxhound`)
- `packages/mcp-server` — Model Context Protocol server (31 tools for trace debugging, scoring, evaluators, datasets) — v0.2.0 ready for publication
- `packages/billing` — Stripe integration + metering
- `packages/notifications` — Alert routing (Slack webhooks)
- `packages/types` — Shared TypeScript types

**Apps:**
- `apps/api` — Fastify REST API (production on Fly.io)
- `apps/worker` — BullMQ worker service (evaluators, experiments, cost/SLA/regression jobs)

**GitHub Actions:**
- `.github/actions/quality-gate/` — Bundled composite action for CI/CD quality gates
- `.github/workflows/docs.yml` — GitHub Pages documentation deployment

**Documentation:**
- `docs-site/` — Docusaurus 3 site with 21 pages (builds cleanly, GitHub Pages deployed)
- `packages/mcp-server/PUBLISH.md` — Manual publication guide for npm and MCP Registry

**Pricing:**
- Free: 100K spans/month, 30-day retention
- Pro ($29/mo): 1M spans/month, 1-year retention
- Team ($99/mo): 5M spans/month, 2-year retention
- Enterprise: custom

**Pending manual actions (no code required):**
1. `npm publish` in `packages/mcp-server/` (after `npm login`) → publishes @foxhound-ai/mcp-server@0.2.0
2. `./mcp-publisher login github` + `./mcp-publisher publish` → registers MCP Registry entry
3. Add CNAME DNS record `docs.foxhound.dev` → GitHub Pages endpoint

**What's next:** Phase 6 (Prompt Management & Growth) — prompt versioning, A/B testing, growth analytics.

**Strategic roadmap:** 6-phase plan to category leadership (~14 weeks total). Phases 0–5 complete. Phase 6 (Prompt Management & Growth) follows.

**Requirements status:**
- R007 — Manual scores via MCP tools: ✅ validated
- R008 — LLM-as-a-Judge evaluators via MCP tools: ✅ validated
- R010 — Dataset auto-curation from production traces: ✅ validated
