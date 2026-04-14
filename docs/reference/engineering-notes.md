# Engineering Notes

Append lessons learned, recurring patterns, and non-obvious rules that future agents and developers should follow.

## Monorepo Patterns

**pnpm workspace structure:** Packages in `packages/`, apps in `apps/`. Turborepo handles build orchestration. Shared TypeScript config in `tsconfig.base.json`. ESLint + Prettier at repo root.

**Dependency graph:** `db` → `api-client` → `sdk`/`sdk-py`. `api` depends on `db` + `billing` + `notifications`. `worker` depends on `db` + `api-client`. `cli` depends on `api-client`. `mcp-server` depends on `api-client`.

**Build order:** `pnpm build` via Turborepo respects the dependency graph. `packages/db` must build before `packages/api-client`. Run `pnpm --filter <package> <script>` to target specific packages.

**Generated artifact hygiene is a repo invariant:** Build outputs, coverage artifacts, Turborepo caches, Docusaurus build/cache output, Python coverage files, `__pycache__`, `*.pyc`, `*.tsbuildinfo`, and OS noise like `.DS_Store` must never be treated as durable repo truth. If these appear in tracked changes, classify them as hygiene debt first before doing product work. Use `pnpm check:hygiene` to catch this drift quickly.

**Explicit exception:** `.github/actions/quality-gate/dist/run.js` is an intentionally committed runtime bundle for the composite GitHub Action. Treat it as a reviewed release artifact, not as a normal package build output. Other package-level `dist/` directories should not be committed.

**Authored/generated boundary must stay crisp:** Do not place generated JS, declaration files, source maps, or build output inside authored source directories like `src/`. Generated artifacts belong in build output directories only. If a package mixes generated files into source trees, fix that before broad refactors so future diffs remain reviewable.

## Database Patterns

**Multi-tenancy:** Every table has `org_id` FK to `organizations`. All queries must be scoped by `org_id` at the DB layer to prevent cross-tenant data leaks.

**JSONB vs normalized:** Use JSONB for truly unstructured data (trace metadata, evaluator configs). Use normalized tables for queryable data (spans, scores). Never bury queryable fields in JSONB.

**Indexes matter:** PostgreSQL query planner needs indexes on filter/join columns. Common patterns: `(org_id, created_at)`, `(org_id, kind)`, `(trace_id)`, `(parent_span_id)`.

**Migrations:** Drizzle migrations in `packages/db/migrations/`. Add new tables/columns additively (dual-read during backfill). Drop old columns only after backfill verified. Never DELETE or ALTER COLUMN in production without backfill safety.

**DB package hardening priority:** `packages/db/src/queries.ts` is a high-risk monolith because tenant-safety rules, auth-adjacent data access, billing state, prompt/versioning data, and admin surfaces all live behind one file. Prefer decomposing by domain (`auth`, `traces`, `scores`, `datasets`, `experiments`, `billing`, `prompts`, `notifications`, `admin`) and raising tests per domain instead of growing the monolith further.

**DB verification rule:** New DB work should add or update org-scoped integration tests for both happy path and cross-org rejection path. If a query mutates data, verify that the same record ID in another org is not affected.

## Worker Architecture

**BullMQ job patterns:** Use named queues per job type (`evaluator-runs`, `experiment-runs`, `cost-monitor`, `sla-scheduler`, `regression-detector`). Set concurrency limits appropriate to resource type (LLM calls: 10-20, DB queries: 50+).

**Partial success handling:** Large batch jobs (100+ items) should persist partial results. If item 73/100 fails, items 1-72 should still be committed. Use per-item try/catch with continue-on-error.

**Dead-letter queues:** Critical jobs (evaluators, experiments) need DLQs for persistent failures. Max retries: 3. Exponential backoff: 1s, 5s, 30s.

**Repeatable jobs:** SLA checks, cost reconciliation, retention cleanup run on cron schedules. Use `repeatableJobs` API with `cron` option. Idempotent — safe to run multiple times.

## SDK Design Patterns

**Namespacing:** All new methods use namespaces: `client.scores.create()`, `client.budgets.create()`. Never pollute top-level client namespace.

**Auto-instrumentation:** Framework integrations (LangGraph, CrewAI, etc.) in `packages/sdk-py/foxhound/integrations/`. Follow decorator pattern for minimal user code changes.

**Context propagation:** Correlation IDs and parent agent IDs flow via headers (`X-Foxhound-Correlation-ID`, `X-Foxhound-Parent-Agent-ID`). SDKs extract these from trace context and attach to spans automatically.

## API Design Patterns

**REST conventions:** `GET /v1/resources`, `POST /v1/resources`, `GET /v1/resources/:id`, `PATCH /v1/resources/:id`, `DELETE /v1/resources/:id`. No RPC verbs (`/evaluate`, `/compare`) — use resource-oriented endpoints instead (`POST /v1/evaluator-runs`, `GET /v1/experiment-comparisons`).

**Query filters:** Use query params for filters: `GET /v1/scores?trace_id=X&name=Y&min_value=0.8`. Never embed filters in POST bodies for GET-equivalent operations.

**Pagination:** Use `limit` + `offset` for now. Cursor-based pagination only if users report performance issues on large result sets.

**Error responses:** Fastify error handler returns `{error: {code, message, details}}`. Use HTTP status codes correctly (400 = bad request, 404 = not found, 500 = server error).

## Session Recovery Patterns

**Current-work truth must be recovered from active artifacts first:** If `docs/overview/*` or milestone summaries imply completion, do not trust them alone for next-step selection. Before planning or continuing substantial work, cross-check in this order: relevant task files → `docs/plans/active/` → latest `docs/sessions/session-YYYY-MM-DD*.md` handoff/note → `git log --oneline -20` → only then broader overview/state docs. This prevents planning off stale summaries when active work is still in flight.

**State-doc conflict rule:** When overview/current-status docs disagree with active plans, recent session notes, or current commits, treat the active plan + recent session evidence as source of truth and queue the stale overview doc for cleanup after the implementation slice. Do not spend the whole session re-reading contradictory state docs.

**Session-analysis artifact rule:** If a session analysis already exists as HTML or markdown under `docs/sessions/`, summarize its highest-leverage lessons into the latest daily session note or handoff file. That gives future agents a lightweight recovery path instead of forcing another full transcript pass.

**One-day, one-session-file rule:** Prefer a single daily session artifact family. If the repo already has `session-YYYY-MM-DD-*.md` for the current day, append to the most relevant existing session note or handoff instead of creating a competing `session-YYYY-MM-DD.md` just because the default filename came to mind. Duplicate same-day session files fragment recovery context and burn retrieval time.

## Frontend Patterns

**Wireframe-first dashboard work:** Treat the current dashboard as a functional wireframe. Optimize for behavioral correctness, auth boundaries, empty/loading/error states, and future restyling. Do not overfit to current page-specific Tailwind structure.

**Reusable page states:** If multiple pages need warning/error/empty shells, extract shared state components instead of duplicating page-local alert boxes. Future visual redesign should be a component swap, not a page-by-page rewrite.

**Reusable chart-system rule:** For dashboard/chart work in `apps/web`, do not design graphs page-by-page. Prefer a small shared chart primitive layer (metric tile, trend chart, breakdown chart, top-N list, distribution chart, diff scorecard, event timeline) and shape page data into those contracts. If a new chart appears only once and cannot be generalized by metric/scope/compare props, treat it as a smell and justify it explicitly.

**Behavior-focused tests:** Frontend tests should assert redirects, messages, disabled states, retries, and recovery behavior. Avoid coupling tests to exact class lists or fragile DOM structure unless the class is itself the behavior.

**Dashboard handoff links must be real, not decorative:** If a page adds query-param context to a link (for example `focus`, `baseline`, `comparison`, or `sourceTrace`), the destination page must actually parse and apply that context before the link ships. Do not create “connected” flows that only look wired together.

**Stable launcher rule:** Quick-jump menus, command palettes, and dashboard launchers should point at stable real routes, not fabricated placeholder entity IDs. If live data is not available, prefer a list/workbench route over a guessed detail route.

**Dashboard artifact-to-plan rule:** If a substantial dashboard brainstorm, IA artifact, or HTML review deck is created during a session, convert it into an implementation-facing plan or backlog before context switching. Strategy-only artifacts are easy to admire and easy to strand; durable follow-through requires a plan file with named slices.

## Testing Patterns

**Integration tests:** Hit real endpoints with test DB. Seed fixtures in `beforeEach`, cleanup in `afterEach`. Run via `pnpm test` (Vitest).

**Unit tests:** Mock external dependencies (Stripe, Redis, BullMQ). Test business logic in isolation.

**E2E tests:** TODO — not yet implemented. Would test full SDK → API → Worker → DB flow.

**Known verification debt tracking:** When broad verification fails outside the current slice, classify whether it is new breakage or pre-existing baseline debt before changing product code. Record recurring baseline failures here or in `docs/plans/testing/` so future sessions do not rediscover them from scratch.

**Audit depth must be declared, not implied:** For repo audits, stocktakes, or “exhaustive” reviews, state up front whether the work is surface-exhaustive or file-by-file exhaustive. Never imply “no stone unturned” unless every in-scope file was actually inspected.

**Generated-noise can be exhaustively audited by classification:** For file-by-file audits, generated/cache/noise files still count as in-scope audit objects, but they should usually be classified as hygiene debt rather than read line-by-line unless there is reason to believe they contain durable truth or leaked secrets.

**Public package rule:** Publicly distributed packages (`sdk`, `sdk-py`, `cli`, `mcp-server`) need explicit test scripts, coverage visibility, and packaging/release checks. Do not leave a public package without a runnable verification lane in `package.json`.

**Typed fixture builders beat ad hoc literals:** Route tests in `apps/api/src/routes/*.test.ts` frequently break under stricter typing when mock objects are duplicated inline. Prefer reusable typed builders/helpers over repeating object literals. Common drift points: string literal unions that need `as const`, mocked records missing required nullable fields like `completedAt`, and trace mocks missing newer required properties like `spans`.

**Verify DB test types before importing them:** Before importing record types from `@foxhound/db` in tests, confirm they are actually exported from `packages/db/src/index.ts` rather than assuming internal schema types are public. Prefer local typed fixture builders, `Awaited<ReturnType<...>>`, or narrowly scoped local interfaces over fake-public imports. Use last-resort casts only as local test shims, not as guessed package contracts.

**Run changed-package checks before broad verification:** When fixing tests or package-local typing, run a narrow lint/typecheck loop on the changed package(s) first so guessed type fixes fail early instead of surfacing only in a later repo-wide verification pass.

**Workspace type-surface drift:** When changing exported function signatures or types in workspace packages like `@foxhound/db`, rebuild the producer package first and clear stale incremental/build artifacts in consuming packages before assuming the consumer code is wrong. In practice: rebuild the producer (`pnpm --filter @foxhound/db build`), remove stale `dist` / `*.tsbuildinfo` in the consumer if needed, then rerun the consumer typecheck.

**Launcher-only vs persistent-nav rule:** If a dashboard page is meant for recurring operator or stakeholder use, it should be discoverable in persistent navigation, not only through a quick-jump launcher. Launcher-only is acceptable for rare utilities, not for routine summary surfaces.

**Next.js 15 App Router prop rule:** In `apps/web/app/**/page.tsx`, treat dynamic `params` and `searchParams` as async route props and resolve them with `await`, matching the working route pattern already used in this repo. Do not introduce synchronous `{ id: string }` / plain-object `searchParams` page props on server routes, even if TypeScript appears happy — this can produce runtime misreads where query params or dynamic IDs appear missing.

**API route test caveat:** Do not assume route-config introspection is safe by directly importing API route modules. In this repo, direct route imports can pull real DB client initialization and other environment-sensitive dependencies. Prefer behavior tests with mocks. If route-config assertions become important, add a documented mocked app-factory helper first instead of ad hoc Fastify introspection.

## Security Patterns

**API key auth:** `Authorization: Bearer sk-...`. Hash keys with SHA-256 before DB lookup. Never log or return full keys (only prefix for display).

**JWT sessions:** HttpOnly, Secure, SameSite=Strict cookies. 30-day expiry. Refresh logic exists but not yet used.

**Input validation:** Zod schemas for all request bodies. Fastify validates before handler execution.

**Rate limiting:** Global API rate limiting exists in `apps/api/src/index.ts`, and abuse-prone routes now also have dedicated per-route limits. When adding expensive, externally side-effecting, or queue-fanout endpoints, prefer explicit route-level limits over relying only on the global default.

**Untrusted content rendering:** Prompt content, trace metadata, evaluator text, notification content, and any user-controlled strings must be treated as untrusted. In the dashboard, render them as plain text by default. Do not use `dangerouslySetInnerHTML` unless content is explicitly sanitized first. Stored prompt text should be documented and handled as data, not trusted markup.

**Trust-boundary split:** JWT-only routes and API-key-auth routes have different trust models. Do not blur them accidentally. If a route requires an end-user identity (`userId`), keep it JWT-only or explicitly reject API-key-only requests.

## Cost Patterns

**LLM pricing:** Built-in pricing table for GPT-4, Claude, Gemini, etc. Orgs can override via `model_pricing_overrides` table. Token counts from span attributes → cost calculated in worker.

**Span cost attribution:** `spans.cost_usd` populated by worker during ingestion. Aggregation queries sum across spans for agent-level or trace-level cost.

## Observability Patterns

**Span structure:** `tool_call`, `llm_call`, `agent_step`, `workflow`, `custom`. Tree structure via `parent_span_id`. Events array for timestamped sub-events within a span.

**Trace lineage:** Dataset items preserve `source_trace_id`. Experiment runs link to dataset items. Full lineage: production trace → dataset item → experiment run → score.

**Session replay:** Reconstruct agent state by replaying span tree in temporal order. Spans carry `attributes` (inputs/outputs) and `events` (state transitions).

## MCP Server Patterns

**Tool naming:** Use `foxhound_` prefix for all tools. Use verb_noun pattern (`explain_failure`, `score_trace`, `list_evaluators`). Keep names concise but descriptive.

**Preview/confirm pattern:** For mutating operations (create, delete, add), use confirm parameter. Preview mode (confirm !== true) shows what will happen. Execute mode (confirm === true) performs the action. Prevents accidental mutations.

**Client-side intelligence:** For complex analysis (error classification, failure explanation), fetch data via API client and process in MCP server. Reduces backend complexity and latency. No new API endpoints needed.

**Error extraction from spans:** Errors live in `span.events` array. Find events with `name === "error"`. Extract message from `attributes["error.message"]` or `attributes["message"]`. Fall back to "Unknown error" if neither exists.

**Async job reminders:** For async operations (evaluator runs, dataset curation), include prominent reminders that results aren't immediate. Use emoji for status (⏳ pending/running, ✅ completed, ❌ failed).

**Response formatting:** Return structured markdown with tables for lists, indented sections for hierarchies, emoji for visual cues. MCP clients render markdown natively.

## Common Pitfalls

**Don't use `bash` with `&` for background processes:** Use `bg_shell start` instead. `bash` with `&` hangs because children inherit stdout.

**Don't grep for definitions when LSP is available:** Use `lsp` go-to-definition for semantic navigation in typed codebases.

**Don't poll servers with sleep loops:** Use `bg_shell wait_for_ready` for server readiness detection.

**Don't guess at library APIs:** Use `resolve_library` → `get_library_docs` for current documentation.

**Don't use `--grep` with Vitest:** Vitest uses `-t` or `--testNamePattern` for test filtering, not `--grep` (that's Jest syntax).

**Don't use ambiguous exact-text edit anchors:** When using exact-match editing tools, anchor replacements with the nearest unique context such as the enclosing `describe(...)`, `it(...)`, route declaration, or function signature. Repeated fixture blocks and duplicated mocks in test files will cause patch failures if the anchor text is too generic.

**Re-read before patching repeated structures:** If a file contains duplicated mocks, fixtures, route objects, or similar repeated blocks, re-read the file immediately before editing and use the smallest unique anchor that still names the enclosing structure. This is cheaper than recovering from a failed exact-match patch attempt later.

## GitHub Actions Patterns

**Composite action structure:** Use composite actions (not Docker) for cross-platform compatibility. Bundle complex business logic into standalone Node.js scripts (esbuild) to avoid runtime npm install delays. Add `.github/actions/*` to pnpm-workspace.yaml to resolve workspace dependencies at build time, but keep bundles completely self-contained at runtime.

**Input parsing convention:** GitHub Actions passes inputs via `INPUT_<UPPERCASE_NAME>` environment variables (dashes become underscores). Use a helper function: `function getInput(name, required) { const env = process.env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`]; if (required && !env) throw Error(...); return env; }`.

**Output and summary writing:** Use `GITHUB_OUTPUT` env var (GitHub Actions Runner v2.23+) by appending `key=value` lines; fall back to `::set-output name=key::value` syntax for older runners. Use `GITHUB_STEP_SUMMARY` for markdown summaries that appear in workflow UI. Write step summary only if file exists (fallback to console.log for local testing).

**PR comment idempotency:** Use hidden HTML markers (`<!-- action-name -->`) to track existing comments. Search for marker via GitHub API before posting. PATCH existing comment if found, POST new if not. This prevents comment spam on force-pushes and keeps PRs clean.

**Error handling priorities:** Make critical paths (business logic, quality gates, API calls) fail the workflow (exit 1). Make secondary paths (comment posting, telemetry) non-fatal — catch failures and log, but don't exit 1. This ensures developers see the important signal even if side-effect APIs fail.

**Native fetch for APIs:** Use Node 18+ native fetch instead of HTTP library dependencies. Keeps bundles lean. For GitHub API: `https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments` with Authorization header (`token ${GITHUB_TOKEN}`).

**Timeout strategies:** For long-running operations (experiments, builds), implement exponential backoff: start with 2s, double on each retry up to 30s max, total timeout configurable (default 600s). Log each poll attempt with elapsed time and status. Show last known status in timeout error for debugging.

## Bundling Patterns (esbuild for Node.js)

**Standalone scripts:** Use esbuild to bundle TypeScript/JavaScript for Node.js environments where npm install is slow or unavailable (GitHub Actions, Lambda, Docker images). Config: `--platform=node --outfile=dist/run.js`.

**Workspace dependencies:** When bundling, add the action directory to pnpm-workspace.yaml so workspace dependencies are installed at build time. Build via `pnpm build` (Turborepo), then bundle. Dependencies are inlined; pnpm only needed during build.

**Removing external packages:** Default esbuild behavior uses `--packages=external` to require dependencies at runtime. For standalone scripts, remove this flag to inline all dependencies. Trade-off: bundle size increases (~25KB typical) but runtime has no external requirements.

**Testing bundle output:** Always verify bundle contains expected code. Use `grep` to check for specific method names or imports: `grep -q 'createExperiment' dist/run.js` confirms API client is inlined. Test locally: `node dist/run.js` with mock environment variables.

## Milestone Completion Patterns

**Code changes in worktree vs main:** When running `git diff --stat HEAD $(git merge-base HEAD main)` from the main repo directory while a worktree is active on a feature branch, the output may be empty because HEAD and the merge-base are the same commit. Always run the diff from the worktree directory: `cd /path/to/worktree && git diff --stat main`. This compares worktree branch vs main correctly.

**GitHub Actions directory lives at repo root:** Composite actions in `.github/actions/` are committed to the main repository root, not to the worktree. When verifying GitHub Actions artifacts from a worktree, check the main repo path (`/path/to/repo/.github/actions/`) rather than the worktree path.

**Cross-slice contract attribution:** Slice `provides`/`requires` fields should only claim what that slice actually created in that milestone. When a slice wraps or calls pre-existing infrastructure (e.g., an API client that predated the milestone), consumers should not list that pre-existing slice as the provider — this creates phantom dependencies in validation. The fix is accurate `provides` declarations at slice planning time.

**OTel bridge architecture scales better than framework-specific adapters:** When multiple target frameworks all use OpenTelemetry as their instrumentation mechanism, a single SpanProcessor bridge per language (mapping GenAI semantic conventions to your schema) covers all frameworks with ~1/3 the code of per-framework adapters. Works for any future OTel-instrumented framework automatically.

## MCP Registry Publication Patterns

**Naming convention:** GitHub-authenticated MCP servers use `io.github.<username>/<server-name>` format. This goes in both package.json's `mcpName` field and server.json's `name` field. They must match exactly or registry validation fails.

**Environment variable metadata:** Declare all runtime environment variables in server.json's `environmentVariables` array. Each entry needs `name`, `description`, `isRequired`, `isSecret`, and `format` fields. MCP clients use this metadata to prompt users during installation.

**Publication blockers:** Both npm publish and MCP Registry publication require human authentication in 2026. npm needs `npm login` or NPM_TOKEN env var. MCP Registry needs GitHub OAuth device flow (120s timeout). Cannot be automated in unattended environments without pre-configured credentials.

**server.json location:** Must live at package root alongside package.json. The mcp-publisher CLI validates the manifest against the npm package tarball structure.

**Registry vs npm installation:** Registry-based installation (`claude mcp add io.github.<username>/<server-name>`) is cleaner but requires both npm package publication AND registry submission. Always document npm fallback (`npx @org/package-name`) for compatibility.

**Vitest v3 removed `--grep` flag:** Task plans written for vitest v2 often include `pnpm test -- --grep <pattern>`. In vitest v3 (project uses v3.2.4), `--grep` is not recognised and causes a `CACError: Unknown option '--grep'`. Use the file-path argument form instead: `pnpm test -- src/integrations/myfile.test.ts`. The `--testNamePattern` flag is the vitest v3 equivalent for filtering by name but the file-path approach is simpler for CI.

**OTel JS SDK parent span shape:** The Python OTel SDK exposes parent span context via `span.parent.span_id` (an integer, the same integer used as map key). The JavaScript OTel SDK exposes it as `span.parentSpanId` (a 16-char hex string on `ReadableSpan`). These are different fields and different types — always use `span.parentSpanId` in TypeScript bridges and key the span map by string hex ID.

**OTel SpanProcessor duck-typing in TypeScript:** You do not need to install `@opentelemetry/api` as a devDependency to implement and test a SpanProcessor. Define local structural interfaces (`OtelReadableSpan`, `OtelStatus`, etc.) matching the OTel SDK field shapes, then mock spans as plain objects in tests. This avoids a transitive devDep and keeps test setup minimal.

## Tooling Notes

**Standard location:** All skills live in `~/.agents/skills/` via symlinks. Pi, Claude Code, and Codex all discover skills from this location. Three collections:
- `~/.agents/skills/superpowers` → `~/.claude/skills/` (188 skills from obra/superpowers)
- `~/.agents/skills/gsd` → `~/.codex/skills/` (32 project management skills)
- `~/.agents/skills/ecc` → `~/Developer/everything-claude-code/skills` (181 skills including domain-specific patterns)

**Pi configuration:** `.pi/settings.json` includes `"skills": ["~/.agents/skills"]`. On startup, pi discovers all skills and lists them in the system prompt (names + descriptions only). Full instructions load on-demand when the agent uses `read` on a SKILL.md file.

**Skill invocation:** Use `/skill:name` syntax for direct invocation (e.g., `/skill:autoplan`). Skills also auto-load when mentioned naturally ("use the TDD skill", "review this plan using all review skills").

**Key skills for Foxhound development:**
- **Planning/review:** `autoplan`, `plan-ceo-review`, `plan-eng-review`, `plan-devex-review`, `security-review`, `quality-gate`
- **Development:** `tdd-workflow`, `agent-introspection-debugging`, `verification-loop`, `git-workflow`, `executing-plans`
- **Architecture:** `architecture-decision-records`, `hexagonal-architecture`, `backend-patterns`, `api-design`
- **project workflow:** `gsd-new-milestone`, `gsd-plan-phase`, `gsd-execute-phase`, `gsd-progress`, `gsd-validate-phase`
- **Documentation:** `documentation-lookup`, `codebase-onboarding`, `repo-scan`

**Name collisions:** When multiple collections have the same skill name, the first match in discovery order wins. Current priority: superpowers → gsd → ecc. Most skills are duplicated between superpowers and ecc (150+ overlaps); superpowers version loads first.

**Updating skills:** Pull latest from each repo:
```bash
cd ~/.claude/skills && git pull  # if superpowers is a git clone
cd ~/Developer/everything-claude-code && git pull
# skills update via codex package manager
```

**Provider agnostic:** Skills are markdown instructions — they work identically with Claude, OpenAI, or other models. No model-specific syntax.
