---
estimated_steps: 5
estimated_files: 6
skills_used: []
---

# T01: Create action scaffold and bundled API client script

**Slice:** S03 — GitHub Actions Quality Gate
**Milestone:** M001

## Description

Set up the composite GitHub Action structure with inputs/outputs definition and create a bundled TypeScript script that imports and uses the Foxhound API client. Use esbuild to create a standalone script with dependencies inlined so the action doesn't need npm install at runtime.

This task proves the critical constraint: that the workspace-private `@foxhound/api-client` package can be bundled into a standalone script that runs in GitHub Actions without external dependencies. The bundle must inline all code from api-client and types packages.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| esbuild (build-time) | Build fails, no dist/run.js produced | N/A (local build) | N/A |
| workspace packages (build-time) | TypeScript resolution fails | N/A | N/A |

## Load Profile

- **Shared resources**: None (build step runs locally)
- **Per-operation cost**: One esbuild invocation, ~2s
- **10x breakpoint**: N/A (build-time only)

## Steps

1. Create `.github/actions/quality-gate/` directory
2. Write `action.yml` with composite action definition:
   - Inputs: api-key (required, secret), api-endpoint (required), dataset-id (required), evaluator-ids (optional), experiment-name (optional), experiment-config (required, JSON), threshold (default: 0.0), baseline-experiment-id (optional)
   - Outputs: experiment-id, comparison-url
   - Runs: composite with steps that execute `node ${{ github.action_path }}/dist/run.js`
3. Write `package.json` with devDependencies: esbuild, typescript, @foxhound/api-client (workspace:\*), @foxhound/types (workspace:\*)
4. Write `tsconfig.json` with target ESNext, module NodeNext, moduleResolution NodeNext, outDir dist
5. Write `run.ts` skeleton:
   - Import FoxhoundApiClient from @foxhound/api-client
   - Parse inputs from process.env.INPUT\_\* (GitHub Actions convention)
   - Log "Starting Foxhound quality gate action..."
   - Export async main() function (no implementation yet, just structure)
6. Add build script to package.json: `"build": "esbuild run.ts --bundle --platform=node --format=cjs --outfile=dist/run.js"`
7. Run `pnpm install` in the action directory (uses workspace dependencies)
8. Run `pnpm build` to create dist/run.js
9. Verify bundle contains FoxhoundApiClient code: `grep -q 'createExperiment' dist/run.js`
10. Write `.gitignore` with `node_modules/` and `dist/` (dist/ will be committed after build in CI)

## Must-Haves

- [ ] action.yml defines all 8 inputs and 2 outputs
- [ ] run.ts imports FoxhoundApiClient successfully (no TypeScript errors)
- [ ] esbuild produces dist/run.js with all dependencies inlined
- [ ] dist/run.js contains string "createExperiment" (proves API client bundled)
- [ ] package.json has build script and correct workspace dependencies
- [ ] .gitignore excludes node_modules

## Verification

```bash
test -f .github/actions/quality-gate/action.yml && \
test -f .github/actions/quality-gate/dist/run.js && \
grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js
```

## Observability Impact

- Signals added: Build script console output (esbuild logs, TypeScript compilation)
- How a future agent inspects this: Check dist/run.js file size and contents, verify bundle includes API client code
- Failure state exposed: Build fails with TypeScript errors or esbuild errors (actionable — missing import, wrong path, etc.)

## Inputs

- `packages/api-client/src/index.ts` — FoxhoundApiClient class to bundle
- `packages/api-client/src/types.ts` — Type exports for API responses
- `packages/types/src/index.ts` — Shared types (Experiment, ExperimentRun, etc.)

## Expected Output

- `.github/actions/quality-gate/action.yml` — Composite action definition with 8 inputs, 2 outputs, and steps that run node dist/run.js
- `.github/actions/quality-gate/run.ts` — TypeScript source with API client import and main() skeleton
- `.github/actions/quality-gate/package.json` — Build dependencies: esbuild, typescript, workspace packages
- `.github/actions/quality-gate/tsconfig.json` — TypeScript config for Node environment
- `.github/actions/quality-gate/dist/run.js` — Bundled standalone script (CJS format, includes all API client code)
- `.github/actions/quality-gate/.gitignore` — Excludes node_modules
