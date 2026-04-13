# Foxhound

Compliance-grade observability platform for AI agent fleets. TypeScript/Node.js monorepo (pnpm + Turborepo). Security and robustness are paramount — this is infrastructure that monitors other people's production AI systems.

## Operating Principles

### 1. Skills First, Always

Before doing ANY work — planning, coding, reviewing, debugging — search for and use available skills. Never work "bare." Use multiple skills simultaneously when they fit — best fit wins, and combining perspectives is encouraged.

**Skill preference order (/superpowers first):**
1. **/superpowers skills (prefer these):** `autoplan`, `plan-ceo-review`, `plan-eng-review`, `plan-devex-review`, `plan-design-review`, `security-review`, `quality-gate`, `verification-loop`, `gan-design`, `gan-build`, `deep-research`, `search-first`, `investigate`, `blueprint`, `council`, `careful`
2. **Domain skills:** `backend-patterns`, `api-design`, `database-migrations`, `deployment-patterns`, `security-scan`, `tdd`, `code-review`, `review`
3. **Slash command skills:** `/plan`, `/review`, `/tdd`, `/security-scan`, `/quality-gate`, `/code-review`
4. Only proceed without a skill if nothing matches

**Combining skills:** Use multiple skills in parallel when the task benefits from it. For example, run `plan-eng-review` + `security-review` simultaneously on a plan, or `autoplan` for design while `search-first` gathers prior art. Best fit for each aspect of the work wins.

### 2. Plan Everything

Every task — no matter how small — gets a plan before execution. Use Plan Mode or planning skills.

**For any feature, fix, or refactor:**
- Use `/plan` or `/autoplan` first
- For significant work, use `/plan-ceo-review` or `/plan-eng-review` to get multi-perspective review of the plan
- Store plans in `docs/plans/` with date prefix (e.g., `docs/plans/2026-04-11-feature-name.md`)
- Reference the strategic roadmap at `docs/specs/2026-04-10-foxhound-strategic-roadmap-design.md`

### 3. Multi-Persona Review on Everything

This is a security-critical observability platform. Every significant piece of work must be evaluated from multiple angles. Use split-role agents or multi-perspective skills.

**Required perspectives for code changes:**
- **Security Engineer** — vulnerabilities, auth bypasses, data leaks, OWASP Top 10
- **Senior Backend Engineer** — correctness, patterns, error handling, edge cases
- **CTO/Architect** — does this fit the roadmap? Is the abstraction right? Will it scale?
- **DevEx/Developer Advocate** — is the SDK/API ergonomic? Would a user understand this?

**Required perspectives for product/strategy decisions:**
- **CTO** — technical feasibility, architecture fit
- **CRO** — revenue impact, competitive positioning
- **Developer Advocate** — community adoption, developer experience
- **Security Lead** — compliance, trust, data handling

Use these skills for multi-perspective review:
- `/plan-ceo-review` — executive-level plan critique
- `/plan-eng-review` — engineering-level plan critique
- `/plan-devex-review` — developer experience critique
- `/plan-design-review` — design and UX critique
- `/security-review` or `/security-scan` — security audit
- `/code-review` — general code quality
- `/review` — comprehensive review

### 4. Security Is Non-Negotiable

Foxhound handles customer telemetry data and API keys. Every change touching these areas gets a dedicated security review.

**Always use `security-reviewer` agent for:**
- Any auth/authorization changes
- Any API endpoint changes
- Any database query changes
- Any SDK changes that handle user data
- Any worker job that processes traces/spans

**Multi-tenancy rule:** Every DB query MUST be scoped by `org_id`. No exceptions.

### 5. Document Everything

All plans, decisions, and architectural notes go in `docs/`. This is the single source of truth. See [`docs/README.md`](docs/README.md) for the full index.

**Documentation locations (all under `docs/`):**
- `docs/specs/` — Design specifications and roadmap (date-prefixed)
- `docs/plans/` — Implementation plans (date-prefixed)
- `docs/gsd/PROJECT.md` — Current project status and stack
- `docs/gsd/KNOWLEDGE.md` — Accumulated patterns, lessons, pitfalls
- `docs/gsd/DECISIONS.md` — Architectural decisions with rationale
- `docs/gsd/REQUIREMENTS.md` — Capability contract and validation
- `docs/gsd/STATE.md` — Active milestone/slice state
- `docs/gsd/milestones/` — Milestone summaries, slice plans, UATs, validation
- `docs-site/` — Public documentation (Docusaurus)

**GSD sync:** GSD writes to `.gsd/` (symlink). After completing milestones, sync to `docs/gsd/`:
```bash
cp .gsd/{PROJECT,KNOWLEDGE,DECISIONS,REQUIREMENTS,STATE}.md docs/gsd/
cp -r .gsd/milestones/M00N docs/gsd/milestones/M00N
```

**Before starting any session:** Read `docs/gsd/PROJECT.md` and `docs/gsd/KNOWLEDGE.md` to load context.

### 6. Never Lose Context

Before working on anything:
1. Check memory files for project state and decisions
2. Read `docs/gsd/PROJECT.md` for current status
3. Read relevant `docs/specs/` for the phase being worked on
4. Read `docs/gsd/KNOWLEDGE.md` for patterns and pitfalls
5. Check `git log --oneline -20` for recent work
6. After completing work, sync GSD state to `docs/gsd/` and update memory as needed

## Project Structure

```
apps/
  api/              — Fastify REST API (Fly.io)
  worker/           — BullMQ worker (eval, experiments, cost/SLA/regression)
packages/
  db/               — Drizzle schema + migrations (PostgreSQL 16)
  api-client/       — Typed TypeScript client
  sdk/              — TypeScript SDK + OTel bridge
  sdk-py/           — Python SDK + OTel bridge (PRIMARY — list Python first in docs)
  cli/              — CLI (foxhound)
  mcp-server/       — 31 MCP debugging tools
  billing/          — Stripe integration
  notifications/    — Alert routing (Slack)
  types/            — Shared TypeScript types
docs/               — All planning & project context (see docs/README.md)
  specs/            — Design specs & roadmap
  plans/            — Implementation plans
  gsd/              — GSD project state, knowledge, decisions, milestones
docs-site/          — Docusaurus 3 public docs (21 pages, GitHub Pages)
```

## Commands

```bash
pnpm install                          # Install dependencies
pnpm build                            # Build all (Turborepo)
pnpm dev                              # Dev server
pnpm test                             # Run all tests (Vitest)
pnpm lint                             # Lint all packages
pnpm typecheck                        # Type-check all packages
pnpm format                           # Prettier format
pnpm --filter <package> <script>      # Target specific package
```

## Tech Stack

- **Runtime:** Node.js 20+, pnpm 9, Turborepo
- **API:** Fastify, Drizzle ORM, PostgreSQL 16 (Neon), Redis (Upstash), BullMQ
- **SDKs:** Python (primary) + TypeScript, framework auto-instrumentation
- **Infra:** Fly.io, Neon, Upstash, Cloudflare
- **Billing:** Stripe Checkout + usage metering
- **Docs:** Docusaurus 3, GitHub Pages

## Strategic Context

Foxhound is executing a 6-phase roadmap to go from agent observability tool to category-leading agent fleet management platform. The full roadmap with 4-agent review is at `docs/specs/2026-04-10-foxhound-strategic-roadmap-design.md`.

**Phases:** 0 (Schema Foundation) through 5 (DevEx & Distribution) are complete. Phase 6 (Prompt Management & Growth) is next.

**Positioning:** "LLM observability built for agents" — targeting developers, not enterprises initially.

**Key differentiators:** Session Replay, Run Diff, eval-from-traces, cost budgets, SLA monitoring, behavior regression detection, MCP debugging tools, GitHub Actions quality gate.

### 7. Maintain the Tooling

The hooks, skills, CLAUDE.md, and memory are living config — they drift. Two layers keep them aligned:

**Micro (per-session):**
- Hooks log events to `.claude/friction.log` via the shared friction logger
- `Stop` hook surfaces session friction stats and reminds about overdue audits
- `Stop` hook checks for Claude Code version updates (new hook types, tools, settings)

**Macro (weekly):**
- Run `node .claude/audit/weekly-review.js --save` weekly
- Audit checks: hooks health, CLAUDE.md drift, memory staleness, friction patterns, skills coverage, Claude Code version
- Reports saved to `.claude/audit/reports/` with date prefix
- Fix CRITICAL/HIGH findings immediately, queue MEDIUM/LOW for next session

**When Claude Code updates:**
- Review the [changelog](https://github.com/anthropics/claude-code/releases) for new capabilities
- Check for new hook phases, tool types, or settings that could improve the config
- Update hooks and settings to use new features where they add value

## Workflow Summary

```
1. Load context     → Read docs/gsd/PROJECT.md, docs/gsd/KNOWLEDGE.md, memory, git log
2. Find skills      → Search for matching /skills and superpowers
3. Plan             → /plan or /autoplan, store in docs/plans/
4. Review plan      → /plan-eng-review or /plan-ceo-review (multi-persona)
5. Execute (TDD)    → Write tests first, implement, use /tdd if available
6. Review code      → /code-review + /security-review + multi-agent critique
7. Document         → Update docs/, sync GSD state to docs/gsd/, update memory
8. Commit           → Conventional commits, detailed messages
```

## App-Specific Documentation

### Web App (apps/web/)
- **[apps/web/CLAUDE.md](apps/web/CLAUDE.md)** - Web app specific guidance (type safety, testing, conventions)
- **[apps/web/PATTERNS.md](apps/web/PATTERNS.md)** - React patterns and best practices (state management, error handling)
- **[apps/web/vitest.config.example.ts](apps/web/vitest.config.example.ts)** - Example test configuration

### Packages
- **[packages/types/README.md](packages/types/README.md)** - Shared TypeScript types documentation

### General
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Code conventions, commit format, PR process

## Documentation Workflow

**All documentation follows the structured workflow defined in [`docs/DOCUMENTATION_WORKFLOW.md`](docs/DOCUMENTATION_WORKFLOW.md).**

### Auto-Filing Rules

**Every session must follow these rules:**

1. **New plans** → `docs/plans/active/YYYY-MM-DD-<name>.md`
2. **Completed work** → `docs/plans/completed/<category>/` (categories: phase-1 through phase-6, brand-gtm, infrastructure, security, refactoring)
3. **Superseded versions** → `docs/plans/archive/<topic>/`
4. **Session logs** → `docs/sessions/SESSION-YYYY-MM-DD.md`
5. **Testing docs** → `docs/plans/testing/`

### End-of-Session Checklist

After every session, verify:

```
□ New plans filed in active/ with YYYY-MM-DD prefix?
□ Completed work moved from active/ to completed/<category>/?
□ Multiple iterations? Earlier versions in archive/<topic>/?
□ Session notes created in sessions/SESSION-YYYY-MM-DD.md?
□ Major changes reflected in docs/README.md?
□ Phase complete? Created phaseN-COMPLETE.md summary?
□ GSD milestone done? Synced .gsd/*.md to docs/gsd/?
```

### Document Lifecycle

```
New Plan → active/
  ↓
Work in Progress → stay in active/, archive old versions
  ↓
Completed → completed/<category>/
  ↓
Superseded → archive/<topic>/
```

**See [`docs/DOCUMENTATION_WORKFLOW.md`](docs/DOCUMENTATION_WORKFLOW.md) for complete filing rules, decision trees, and examples.**

