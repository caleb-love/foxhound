---
id: T01
parent: S03
milestone: M001
key_files:
  - pnpm-workspace.yaml
  - .github/actions/quality-gate/action.yml
  - .github/actions/quality-gate/run.ts
  - .github/actions/quality-gate/package.json
  - .github/actions/quality-gate/tsconfig.json
  - .github/actions/quality-gate/.gitignore
  - .github/actions/quality-gate/dist/run.js
key_decisions:
  - Added .github/actions/* to pnpm workspace to enable workspace:* dependencies during build while keeping action self-contained at runtime
  - Removed esbuild --packages=external flag to inline all dependencies into single dist/run.js bundle
duration: 
verification_result: passed
completed_at: 2026-04-10T06:10:51.394Z
blocker_discovered: false
---

# T01: Created GitHub Action scaffold with bundled API client, enabling CI/CD quality gates without runtime npm install.

**Created GitHub Action scaffold with bundled API client, enabling CI/CD quality gates without runtime npm install.**

## What Happened

Created the complete GitHub Action directory structure with composite action definition, TypeScript source, and build infrastructure. The action accepts 8 inputs (api-key, api-endpoint, dataset-id, evaluator-ids, experiment-name, experiment-config, threshold, baseline-experiment-id) and exposes 2 outputs (experiment-id, comparison-url).

Added `.github/actions/*` to pnpm-workspace.yaml to resolve workspace dependencies during build. Used esbuild to bundle run.ts into a standalone CommonJS script (dist/run.js, 16.2kb) that includes the entire FoxhoundApiClient class and all its dependencies inlined.

The TypeScript source (run.ts) implements input parsing via GitHub Actions environment variable convention (INPUT_*), validates required inputs, creates the API client, and provides placeholder output/summary functions. The main() function is a skeleton ready for T02 implementation (experiment creation and polling).

Verified the bundle contains the createExperiment method via grep, confirming the API client code is fully inlined. TypeScript compilation produced no errors.

## Verification

Ran the three verification commands from the task plan:
1. Checked action.yml exists: `test -f .github/actions/quality-gate/action.yml`
2. Checked bundled script exists: `test -f .github/actions/quality-gate/dist/run.js`
3. Verified API client bundled: `grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js`

Additional verification:
- TypeScript compilation: `npx tsc --noEmit` (no errors)
- Bundle execution test: `node dist/run.js` (correctly validates missing required input)
- Confirmed action.yml defines all 8 inputs and 2 outputs
- Confirmed dist/run.js contains 587 lines of bundled code
- Verified .gitignore excludes node_modules

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f .github/actions/quality-gate/action.yml` | 0 | ✅ pass | 1ms |
| 2 | `test -f .github/actions/quality-gate/dist/run.js` | 0 | ✅ pass | 1ms |
| 3 | `grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js` | 0 | ✅ pass | 2ms |
| 4 | `npx tsc --noEmit` | 0 | ✅ pass | 800ms |
| 5 | `node dist/run.js` | 1 | ✅ pass | 15ms |

## Deviations

None. The task plan expected workspace dependencies and esbuild bundling — both implemented as specified.

## Known Issues

None. The scaffold is complete and ready for T02 (experiment creation and polling implementation).

## Files Created/Modified

- `pnpm-workspace.yaml`
- `.github/actions/quality-gate/action.yml`
- `.github/actions/quality-gate/run.ts`
- `.github/actions/quality-gate/package.json`
- `.github/actions/quality-gate/tsconfig.json`
- `.github/actions/quality-gate/.gitignore`
- `.github/actions/quality-gate/dist/run.js`
