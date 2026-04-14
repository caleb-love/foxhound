---
id: S03
parent: M001
milestone: M001
provides:
  - GitHub Action (composite action + bundled script) that integrates Foxhound evaluators into CI/CD workflows
  - Quality gate enforcement pattern for GitHub workflows
  - PR comment posting template for experiment results
  - Documentation template for GitHub Actions
  - Baseline comparison and threshold enforcement pattern for LLM evaluator results
requires:
  - slice: S01
    provides: FoxhoundApiClient with createExperiment, getExperiment, compareExperiments methods
  - slice: S02
    provides: MCP server patterns that informed GitHub Actions design patterns
affects:
  - S04 can use S03 as quality gate validation layer in CI
  - S05 should reference S03's quality-gate-example.yml in 'Getting Started with CI/CD' section
key_files:
  - .github/actions/quality-gate/action.yml
  - .github/actions/quality-gate/run.ts
  - .github/actions/quality-gate/dist/run.js
  - .github/actions/quality-gate/README.md
  - .github/workflows/quality-gate-example.yml
  - pnpm-workspace.yaml
key_decisions:
  - Bundled standalone script (esbuild) with all dependencies inlined to eliminate runtime npm install
  - Native fetch for GitHub API instead of @actions/github to keep bundle lean
  - PR comment idempotency via hidden HTML marker search + PATCH pattern
  - Graceful API degradation: GitHub API non-critical, Foxhound API critical
patterns_established:
  - GitHub Actions composite action pattern: bundled TypeScript → esbuild → standalone script
  - Input parsing via INPUT_* environment variables with required validation
  - PR comment idempotency: hidden marker search → PATCH existing or POST new
  - Exponential backoff polling: 2s → 4s → ... → 30s max, configurable timeout
  - Error messages for CI/CD: what happened + why + how to fix
  - Graceful degradation: critical paths fail workflow, secondary paths log only
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-10T06:41:22.033Z
blocker_discovered: false
---

# S03: GitHub Actions Quality Gate

**GitHub Action with bundled API client runs evaluators on PRs, compares scores against baseline, enforces thresholds, posts markdown comparison comment to PRs, and fails workflows on quality degradation.**

## What Happened

S03 delivered a production-ready GitHub Actions quality gate that integrates Foxhound evaluators into CI/CD workflows. The action creates experiments on demand, polls reliably with exponential backoff, compares scores against baselines, formats professional markdown reports, posts idempotent PR comments, enforces quality thresholds, and handles edge cases gracefully. All 4 tasks completed and verified. 25KB self-contained bundle (esbuild) with all dependencies inlined. Complete documentation with inputs reference, troubleshooting section, and realistic example workflow. Key decisions: bundled standalone script for zero runtime dependencies, native fetch for GitHub API to keep bundle lean, PR comment idempotency via hidden marker, graceful API degradation (GitHub API non-critical path). Established patterns for GitHub Actions composite actions, input parsing, timeout strategies, and CI/CD error messaging. No blockers discovered, all verification checks passed.

## Verification

All slice-level verification checks passed: action.yml exists with 8 inputs/2 outputs, dist/run.js exists (25KB, bundled), API client methods (createExperiment, getExperiment, compareExperiments) bundled and verified via grep, README.md complete with inputs table/outputs/troubleshooting/examples, quality-gate-example.yml valid YAML. Task-level verification: T01 scaffold + esbuild bundling (passed), T02 experiment creation + exponential backoff polling (passed), T03 score comparison + PR comments + threshold enforcement (unit test passed), T04 documentation + example workflow + local test script (passed). Observability surfaces: GitHub Step Summary markdown, GitHub Outputs (experiment-id, comparison-url), PR comments with tables, console logging, error handling for 401/403/404/500/timeout.

## Requirements Traceability Advanced

None.

## Requirements Traceability Validated

None.

## New Requirements Surfaced

None.

## Requirements Traceability Invalidated or Re-scoped

None.

## Deviations

None — all task plans executed as specified. No blockers discovered during execution.

## Known Limitations

["No built-in baseline management (users must store experiment IDs manually or via artifacts)", "Single dataset per run (users create multiple job steps for multiple datasets)", "No result caching (every PR run creates new experiment)", "Score aggregation assumes LLM judges with multiple runs per trace"]

## Follow-ups

["Future: Baseline management system to auto-store/retrieve experiment IDs per branch", "Future: Integration with GitHub Status Checks API for finer-grained workflow controls", "Future: Metrics/alerting dashboard for quality gate trends across PRs"]

## Files Created/Modified

- `.github/actions/quality-gate/action.yml` — Composite action definition with 8 inputs, 2 outputs, composite steps
- `.github/actions/quality-gate/run.ts` — 435-line TypeScript source: input parsing, experiment creation, polling, score comparison, PR posting, threshold enforcement
- `.github/actions/quality-gate/dist/run.js` — 25KB esbuild bundle with all dependencies inlined, ready for GitHub Actions runtime
- `.github/actions/quality-gate/README.md` — Complete documentation: inputs table, outputs, permissions, 3 usage examples, 8+ troubleshooting scenarios
- `.github/workflows/quality-gate-example.yml` — Realistic example workflow with pull_request/push triggers, inline configuration
- `pnpm-workspace.yaml` — Updated to include .github/actions/* for workspace dependency resolution at build time
