---
id: T01
parent: S05
milestone: M001
key_files:
  - docs-site/docusaurus.config.ts
  - docs-site/package.json
key_decisions:
  - Removed experimental_faster block — requires @docusaurus/faster which was not in plan
  - Added webpack@~5.95.0 devDep to docs-site to override hoisted workspace webpack@5.106.0 that broke ProgressPlugin schema validation
duration: 
verification_result: passed
completed_at: 2026-04-11T01:29:02.027Z
blocker_discovered: false
---

# T01: Fixed two build-blocking issues in pre-existing docs-site scaffold (removed experimental_faster block, pinned webpack@~5.95.0 to avoid workspace version collision) so pnpm --filter @foxhound-ai/docs build exits 0

**Fixed two build-blocking issues in pre-existing docs-site scaffold (removed experimental_faster block, pinned webpack@~5.95.0 to avoid workspace version collision) so pnpm --filter @foxhound-ai/docs build exits 0**

## What Happened

The docs-site directory was already scaffolded with all required files. Two sequential build failures required fixes: (1) removed future.experimental_faster block from docusaurus.config.ts which required @docusaurus/faster not installed; (2) added webpack@~5.95.0 as a devDependency to docs-site/package.json to isolate it from the hoisted workspace webpack@5.106.0, which broke webpackbar's ProgressPlugin schema validation. After pnpm install docs-site has its own webpack@5.95.0 in local node_modules and the build compiles cleanly with all 6 sidebar sections defined.

## Verification

All three task-plan verification checks pass: (1) pnpm --filter @foxhound-ai/docs build exits 0; (2) test -f docs-site/build/index.html passes; (3) grep -q 'docs-site' pnpm-workspace.yaml passes.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @foxhound-ai/docs build` | 0 | ✅ pass | 2375ms |
| 2 | `test -f docs-site/build/index.html` | 0 | ✅ pass | 10ms |
| 3 | `grep -q 'docs-site' pnpm-workspace.yaml` | 0 | ✅ pass | 5ms |

## Deviations

Removed future.experimental_faster from docusaurus.config.ts (added by prior agent, not in plan). Added webpack@~5.95.0 devDependency to docs-site/package.json (not in plan, required to fix workspace webpack version collision).

## Known Issues

Sidebar references mcp-server/tool-reference but T02 plan mentions mcp-server/tools — existing file is tool-reference.md so T02 should use that ID.

## Files Created/Modified

- `docs-site/docusaurus.config.ts`
- `docs-site/package.json`
