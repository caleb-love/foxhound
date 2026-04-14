# Next Actions — Hardening Checklist

Use this checklist before starting unrelated work after the 2026-04-14 hardening pass.

## 1. Recover current state
- [ ] Review current `git status`
- [ ] Separate this hardening work from unrelated in-progress changes (especially `apps/web`)
- [ ] Confirm intended artifact deletions vs unrelated edits

## 2. Re-run focused verification
- [ ] `pnpm check:hygiene`
- [ ] `pnpm --filter @foxhound/db typecheck`
- [ ] `pnpm --filter @foxhound-ai/cli exec vitest run --coverage`

## 3. If verification passes, choose one lane only

### Lane A — Finish repo hygiene stabilization
- [ ] Commit/stage the hardening + cleanup work cleanly
- [ ] Confirm remaining hygiene failures are gone or explicitly understood
- [ ] Keep package `dist/` out of repo truth except the documented GitHub Action bundle exception

### Lane B — Continue DB hardening
Highest-value remaining DB tests:
- [ ] notifications / alert rules
- [ ] SSO config / sessions
- [ ] agent config / baselines / pricing overrides
- [ ] trace replay / diff edge cases

### Lane C — Continue public package hardening
Highest-value remaining package work:
- [ ] deepen CLI `traces.ts` coverage
- [ ] expand SDK behavior tests if coverage still lags desired floor
- [ ] expand MCP behavior/error-path tests if needed

## 4. Durable context to read first next session
- [ ] `docs/sessions/session-2026-04-14-hardening-handoff.md`
- [ ] `docs/reference/engineering-notes.md`
- [ ] `docs/overview/start-here.md`

## Recommended next prompt

> Continue from the repo hardening pass. Recover git state first, confirm intended deletions/artifact cleanup, rerun `pnpm check:hygiene`, DB typecheck, and CLI coverage, then continue DB integration coverage expansion unless verification exposes a different priority.
