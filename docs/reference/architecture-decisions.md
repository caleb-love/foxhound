# Architecture Decisions

Durable architectural and product decisions with rationale.

## D001 — Normalize spans into their own table (Phase 0)

**Scope:** Architecture  
**Decision:** Extract spans from `traces.spans` JSONB column into a dedicated `spans` table with proper indexes.  
**Rationale:** JSONB queries are O(n·m) and prevent span-level indexing. Every new feature (scoring, experiments, behavior regression, Run Diff) requires span-level queries. Normalizing enables proper FK constraints, indexes, and query performance.  
**Made by:** Collaborative (unanimous reviewer feedback)  
**When:** Phase 0 foundation  
**Revisable:** No

## D002 — Micro-batch trace ingestion (Phase 0)

**Scope:** Performance  
**Decision:** Buffer incoming traces in memory, flush every 100ms or 50 traces (whichever first) with a single multi-row `INSERT`.  
**Rationale:** Individual INSERTs at 50 traces/sec burst exhaust the connection pool. Micro-batching reduces round trips by 50x.  
**Made by:** Agent (per Performance Oracle review)  
**When:** Phase 0 foundation  
**Revisable:** Yes (if batching introduces unacceptable latency)

## D003 — $29/mo Pro tier pricing (Phase 1)

**Scope:** Business  
**Decision:** Pro tier at $29/mo (not $49/mo), Team at $99/mo. Free tier includes all features (volume-limited only).  
**Rationale:** $49/mo is no-man's land between hobbyist and team budgets. $29 matches Langfuse Core, undercuts LangSmith ($39/seat). Unlimited users on all tiers is a competitive advantage over LangSmith's per-seat model.  
**Made by:** Collaborative (per Competitive Strategist review)  
**When:** Phase 1 billing activation  
**Revisable:** Yes (after pricing experiments)

## D004 — Developer-first positioning (Phase 1)

**Scope:** Marketing  
**Decision:** Pick developers over enterprise as primary target. "LLM observability built for agents" positioning.  
**Rationale:** Enterprise requires sales pipeline, SSO marketing, compliance certifications — none exist yet. Developer adoption comes first. Graduate to enterprise when traction validates it.  
**Made by:** Collaborative (per Competitive Strategist review)  
**When:** Phase 1 cloud launch  
**Revisable:** Yes (when enterprise pipeline materializes)

## D005 — Evaluator workers in separate process (Phase 2)

**Scope:** Architecture  
**Decision:** Create `apps/worker/` as a separate Node.js process consuming BullMQ jobs. Never run evaluator jobs on the API server.  
**Rationale:** Evaluator runs can take seconds to minutes and consume significant LLM tokens. Blocking the API server degrades responsiveness for all users. Separate workers enable independent scaling and resource isolation.  
**Made by:** Agent (per Architecture Strategist + Performance Oracle reviews)  
**When:** Phase 2 evaluation engine  
**Revisable:** No

## D006 — Namespaced SDK methods (Phase 2)

**Scope:** Library  
**Decision:** All new SDK methods use namespaces: `fox.scores.create()`, `fox.budgets.create()`, `fox.slas.create()`, `fox.regressions.list()`.  
**Rationale:** Top-level namespace pollution is a long-term API design mistake. Namespacing groups related methods and prevents collisions as the API grows.  
**Made by:** Agent (per Architecture Strategist review)  
**When:** Phase 2 SDK expansion  
**Revisable:** No (breaking change post-adoption)

## D007 — Auto-curation as the dataset differentiator (Phase 3)

**Scope:** Product  
**Decision:** Datasets can be auto-populated from production traces via filters (e.g., "all traces where helpfulness < 0.5 from last 7 days"). This is the killer feature — no competitor offers it.  
**Rationale:** Competitors (Langfuse, LangSmith, Braintrust) require manual dataset construction. Auto-curation from production failures removes friction and creates a unique advantage.  
**Made by:** Collaborative (roadmap consensus)  
**When:** Phase 3 datasets  
**Revisable:** No (core differentiator)

## D008 — Agent cost budgets with SDK callbacks (Phase 4)

**Scope:** Product  
**Decision:** Agent cost budgets are configurable per-org + agent. When budget exceeded, the SDK callback `on_budget_exceeded` fires. Application decides whether to kill or continue.  
**Rationale:** Centralized budget enforcement (API refuses traces) would break in-flight agent runs. SDK callback gives applications control while providing observability.  
**Made by:** Agent (per roadmap design)  
**When:** Phase 4 agent intelligence  
**Revisable:** Yes (if users demand server-side enforcement)

## D009 — Behavior baselines stored per agent version (Phase 4)

**Scope:** Data model  
**Decision:** `behavior_baselines` table stores span structure per `(org_id, agent_id, agent_version)` triple. Regression detector compares new traces to the baseline.  
**Rationale:** Agent behavior changes across versions. Storing per-version baselines enables automated detection of unintended drift.  
**Made by:** Agent (per roadmap design)  
**When:** Phase 4 behavior regression  
**Revisable:** No (structural requirement)

## D010 — PostgreSQL first, ClickHouse only if needed (Phase 4.5)

**Scope:** Architecture  
**Decision:** Use PostgreSQL with normalized spans for all queries. Add ClickHouse via async CDC relay only if p95 trace query latency exceeds 200ms at current volume.  
**Rationale:** Premature optimization. PostgreSQL with proper indexing handles moderate scale. ClickHouse adds operational complexity (another service, dual-write risks, eventual consistency). Only introduce when data proves it necessary.  
**Made by:** Agent (per Performance Oracle review)  
**When:** Phase 4 decision point  
**Revisable:** Yes (if latency degrades)

## D011 — Never dual-write synchronously to ClickHouse (Phase 4.5)

**Scope:** Architecture  
**Decision:** If ClickHouse is added, use async CDC relay (Postgres → BullMQ job → ClickHouse). Never dual-write on the hot ingestion path.  
**Rationale:** Synchronous dual-write makes ClickHouse failures block trace ingestion. Async relay keeps ClickHouse eventually consistent without blocking the critical path.  
**Made by:** Agent (per Performance Oracle review)  
**When:** Phase 4 ClickHouse decision  
**Revisable:** No (performance + reliability requirement)

## D012 — No migration tools (Phase 1-6)

**Scope:** Product  
**Decision:** Do not build Langfuse/LangSmith data importers.  
**Rationale:** Signals "follower." Nobody migrates old traces — they start fresh with new tooling. SDK swap guides (how to switch instrumentation) are useful. Data migration is not.  
**Made by:** Collaborative (per Competitive Strategist review)  
**When:** Roadmap Phase 1-6  
**Revisable:** Yes (after 1K+ GitHub stars if users demand it)

## D013 — Webhooks instead of native multi-provider notifications (Phase 1-6)

**Scope:** Product  
**Decision:** Support Slack webhooks only. No native PagerDuty, GitHub, Linear integrations yet.  
**Rationale:** Each provider is a separate OAuth flow + API contract. Webhooks suffice — users connect via Zapier/n8n. Native integrations add maintenance burden without proportional value until enterprise pipeline exists.  
**Made by:** Collaborative (per Simplicity Reviewer)  
**When:** Roadmap Phase 1-6  
**Revisable:** Yes (when enterprise customers request it)

## D014 — Fly.io over Kubernetes (Phase 1)

**Scope:** Infrastructure  
**Decision:** Deploy API and worker on Fly.io. Do not use Kubernetes yet.  
**Rationale:** Kubernetes adds operational complexity (cluster management, networking, storage) that provides no value at current scale. Fly.io is simpler, cheaper, and sufficient for moderate traffic. Migrate to Kubernetes only when autoscaling demands it.  
**Made by:** Collaborative (per Simplicity Reviewer)  
**When:** Phase 1 cloud launch  
**Revisable:** Yes (when traffic demands horizontal autoscaling beyond Fly.io's capabilities)

---

## Architecture Decisions Table

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | M001/S01 planning | architecture | MCP server tools organization | Keep all tool registrations in single `packages/mcp-server/src/index.ts` file | File will be ~1100 lines after M001/S01 adds 10 new tools. Each tool is 20-40 lines of self-contained handler code following server.tool(name, description, schema, handler) pattern. The file is declarative, not complex logic. Splitting into tool category modules (traces.ts, scores.ts, evaluators.ts, datasets.ts, analysis.ts) would add import ceremony without meaningful benefit at this scale. Single file maintains simplicity and is consistent with current pattern (21 tools already in one file). | Yes | agent |
| D002 | M001/S03 | architecture | GitHub Actions quality gate implementation approach | Bundled standalone script with esbuild, workspace dependencies at build time only, native fetch for GitHub API | Eliminates runtime npm install overhead on GitHub Actions runners, reduces bundle size (25KB vs ~100KB with dependencies), allows action to work on any runner without network calls or slow startup | Yes | agent |
| D003 | M001/S03 | architecture | PR comment idempotency strategy | Use hidden HTML marker (<!-- foxhound-quality-gate -->) to track existing comments, PATCH instead of POST on subsequent runs | Prevents comment spam on force-pushes and multiple workflow runs. Keeps PR clean with single updated comment instead of growing list of duplicates. Marker-based approach is simpler than tracking comment IDs | Yes | agent |
| D004 | M001/S03 | architecture | Error handling for multi-API workflows (Foxhound + GitHub) | Make quality gate enforcement (Foxhound) critical path, GitHub API (comment posting) non-critical. Continue on GitHub API failure; fail on Foxhound API failure | Threshold violations must be visible to developers (workflow exit code 1). GitHub API failures are less critical — developers can still see results in step summary and GitHub Actions logs. Non-critical failures shouldn't cascade to prevent quality gate enforcement | Yes | agent |
| D005 | M001/S04 | architecture | Framework integration strategy for Pydantic AI, Mastra, Bedrock AgentCore, Google ADK | Build shared OpenTelemetry SpanProcessor bridge modules (one Python, one TypeScript) instead of four separate framework-specific integration adapters | All four target frameworks use OpenTelemetry as their instrumentation mechanism. A single bridge that maps GenAI semantic conventions to Foxhound spans reduces implementation from ~1200 lines (4 × 300-line integrations) to ~500 lines (2 bridges + config examples), works immediately with future OTel-instrumented frameworks, and eliminates version coupling risk. Existing callback-based integrations (LangGraph, CrewAI, etc.) are preserved — they capture richer framework-specific metadata that OTel's generic span model cannot. | Yes — if a framework's OTel emission proves too lossy, a callback-based integration can be added alongside | agent |
| D006 | M001/S04 | architecture | Use OpenTelemetry SpanProcessor bridge instead of framework-specific adapters for Pydantic AI, Mastra, Bedrock AgentCore, Google ADK | Single OTel SpanProcessor bridge translates GenAI semantic conventions to Foxhound spans | Reduces implementation surface from ~1200 lines (4 framework adapters) to ~400 lines (1 bridge + docs). Works immediately with any future OTel-instrumented framework. Preserves existing callback integrations (LangGraph, CrewAI) for richer metadata. Aligns with industry standard OpenTelemetry semantic conventions for GenAI. | Yes | agent |
