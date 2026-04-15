# 2026-04-14 Audit Findings Summary

**Purpose:** durable markdown summary of the essential findings preserved from the 2026-04-14 architecture review, tech-debt audit, and full-file audit artifacts.

**Source artifacts:**
- `docs/sessions/2026-04-14-architecture-review-deck.html`
- `docs/plans/archive/reviews/2026-04-14-repo-tech-debt-audit-plan.html`
- `docs/plans/archive/artifacts/2026-04-14-full-file-audit-plan.html`
- `docs/plans/archive/artifacts/2026-04-14-file-audit-index.json`

This file exists so the key conclusions are not stranded in HTML/JSON artifacts.

---

## Executive summary

Foxhound has **good architectural bones**:
- Fastify API + BullMQ worker is the right runtime split
- Postgres + Drizzle is the right current-stage system of record
- multi-tenant discipline is explicit and structurally important
- SDK, CLI, MCP, docs, and CI action are intentional platform/distribution surfaces

The main problems are not foundational architecture mistakes. They are:
1. **surface-area inflation**
2. **oversized modules in key shared packages**
3. **repo-truth / documentation noise**
4. **verification and hygiene debt in shared layers**

The right strategy is **consolidation, not rewrite**.

---

## Highest-value findings

### 1. API / worker / control-plane split is correct
This is a sound architecture for a small-team observability platform with async evaluation and policy workloads.

### 2. Postgres is right now, but not forever for telemetry analytics
The repo correctly recognizes that Postgres is a good current operational store, but long-term telemetry analytics likely want a split model (for example Postgres + analytical store).

### 3. Too many surfaces grew in parallel
The repo currently carries:
- API
- worker
- web app
- TypeScript SDK
- Python SDK
- CLI
- MCP server
- docs-site
- CI quality gate
- demo-domain

These are mostly legitimate surfaces, but together they create maintenance drag.

### 4. The biggest code-structure debt is in shared surfaces
Highest-leverage structural debt areas:
- `packages/db/src/queries.ts` gravity well / compatibility barrel history
- `packages/mcp-server/src/index.ts` having grown too large before modularization
- broad `packages/api-client/src/index.ts` surface
- overlapping transport/client logic between API client and SDK

### 5. The biggest repo-truth debt is docs/process sprawl
`docs/plans/active/` had accumulated execution plans plus artifacts/templates/reviews, reducing signal and making current work harder to recover.

### 6. Generated artifact and cache hygiene matters
Large generated/cache artifacts are not durable truth and should not dominate the repo or audits.
Examples called out across the audit materials:
- `dist/`
- `coverage/`
- `.turbo/`
- `.docusaurus/`
- `*.tsbuildinfo`
- `.DS_Store`
- Python cache/coverage leftovers

### 7. Local secret/helper tokens must not live inside package paths
Even if gitignored, local credential/helper files should not live under `packages/*` or other distributed surfaces. Keep them in user-level or explicitly local operator paths outside package directories.

### 8. Audit proof artifacts are evidence, not active plans
Large HTML/JSON audit artifacts are useful as proof and spot-check material, but should not be treated as active execution truth.

---

## Essential backlog priorities retained from the audit

### Priority 0
1. Finish DB query decomposition and keep future DB code domain-local
2. Split and keep modular MCP tool registration by domain
3. Prune `docs/plans/active/` aggressively so it contains only execution-driving plans

### Priority 1
4. Reduce duplicate transport/client logic between `api-client` and `sdk`
5. Strengthen durable-doc vs evidence vs active-plan boundaries
6. Re-scope the dashboard around real operator priorities, not only roadmap breadth

### Priority 2
7. Formalize control-plane vs telemetry boundaries in code
8. Reduce repetitive queue plumbing where it improves clarity
9. Add lightweight guardrails against future module-size and docs-truth drift

---

## Durable rules extracted from the audit

These are the main operating rules that should survive the archived artifacts:

1. **Use active plans and current session artifacts before overview docs when recovering state.**
2. **Keep `docs/plans/active/` for execution-driving plans only.**
3. **Treat session decks and audit HTML as evidence/history, not primary truth.**
4. **Use package tests as migration checklists during large refactors.**
5. **For workspace packages, verify and build the producer before debugging the consumer.**
6. **Do not let local tokens/helper auth files live inside package paths.**
7. **Do not treat generated output as authored repo truth.**

---

## What was intentionally archived instead of kept active

The following artifact classes were intentionally archived because they are useful evidence but not active plans:
- full-file audit HTML deck
- machine-readable audit index JSON
- repo tech-debt audit HTML plan
- blank templates / tracker stubs / interview guides that were not driving the current implementation slice

This preserves proof without polluting current execution context.

---

## Recommended interpretation

If someone asks, “What did the 2026-04-14 audit really conclude?” the durable answer is:

> Foxhound’s core architecture is good. The repo does not need a rewrite. It needs a disciplined consolidation pass focused on shared-package modularity, verification quality, and reducing docs/process noise so the codebase matches the ambition more cleanly.
