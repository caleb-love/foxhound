---
id: T02
parent: S03
milestone: M001
key_files:
  - /.github/actions/quality-gate/run.ts
  - /.github/actions/quality-gate/dist/run.js
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T06:13:01.278Z
blocker_discovered: false
---

# T02: Implemented experiment creation and polling logic with exponential backoff and timeout handling, enabling GitHub Actions to reliably wait for Foxhound experiments to complete.

**Implemented experiment creation and polling logic with exponential backoff and timeout handling, enabling GitHub Actions to reliably wait for Foxhound experiments to complete.**

## What Happened

Implemented the core quality gate action logic: experiment creation via the Foxhound API client, followed by status polling with exponential backoff until completion or timeout.

Added pollExperiment() function that starts with a 2-second delay and doubles on each retry up to a maximum of 30 seconds. Each poll attempt calls getExperiment() to check the status and logs structured output. The function handles all experiment statuses: returns the experiment on "completed", throws an error on "failed", and times out if the elapsed time exceeds the configured limit (default 600s).

Replaced the placeholder parseInputs() function with three focused helpers: parseExperimentConfig(), getExperimentName(), and individual getInput() calls in main(). Updated main() to create an experiment, extract the experiment ID, write it to $GITHUB_OUTPUT, then poll for completion. Added specific error handling for API status codes (401/403/404/500) with actionable messages.

Rebuilt the bundle with pnpm build, producing an updated dist/run.js (18.3kb) that includes the polling and error handling logic.

## Verification

Ran the task verification command from T02-PLAN.md:
```bash
grep -q 'createExperiment' .github/actions/quality-gate/run.ts && \
grep -q 'pollExperiment' .github/actions/quality-gate/run.ts && \
grep -q 'exponential' .github/actions/quality-gate/run.ts
```

Verified slice-level checks:
- test -f .github/actions/quality-gate/action.yml — action definition exists (inherited from T01)
- test -f .github/actions/quality-gate/dist/run.js — bundled script exists
- grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js — API client bundled

All required patterns are present in the source and bundled script.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'createExperiment' .github/actions/quality-gate/run.ts && grep -q 'pollExperiment' .github/actions/quality-gate/run.ts && grep -q 'exponential' .github/actions/quality-gate/run.ts` | 0 | ✅ pass | 3ms |
| 2 | `test -f .github/actions/quality-gate/action.yml` | 0 | ✅ pass | 1ms |
| 3 | `test -f .github/actions/quality-gate/dist/run.js` | 0 | ✅ pass | 1ms |
| 4 | `grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js` | 0 | ✅ pass | 2ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `/.github/actions/quality-gate/run.ts`
- `/.github/actions/quality-gate/dist/run.js`
