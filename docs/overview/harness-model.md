# Harness Model

This repo is designed to work with a three-stage context model that stays efficient by default and only loads deeper material when needed.

## The Three Stages

### 1. User-level guidance
This is the always-on operating layer from the user's pi configuration.

Purpose:
- keep baseline instructions short
- enforce evaluation-first for substantial work
- prefer retrieval over preloading
- load skills only when triggered by task/risk

This layer should stay general and cross-repo.

### 2. Repo-level guidance
This is the repo-specific operating layer in `CLAUDE.md`.

Purpose:
- define Foxhound-specific risk boundaries
- document security and multi-tenant invariants
- specify planning/review/verification expectations
- point the agent at the right repo entrypoints

This layer decides *when* the docs layer should be loaded.

### 3. Docs-level retrieval
This is the durable source-of-truth layer inside `docs/`.

Purpose:
- provide the smallest accurate path into current repo truth
- preserve durable decisions, patterns, plans, and milestone history
- avoid relying on chat memory or sprawling preloaded context

## Canonical Cold-Start Entry Point

The canonical docs cold-start entry point is:

- [`docs/overview/start-here.md`](start-here.md)

Use it when:
- current repo state is unclear
- a task is substantial or unfamiliar
- you need the shortest correct reading order into active repo truth

Do **not** treat the entire `docs/` folder as required preload.

## Retrieval Flow

Default retrieval order:
1. the user's current request
2. directly related code/files
3. active plans
4. latest relevant session note
5. current diff / recent commits
6. overview docs
7. reference docs
8. broader specs / milestone history only if needed

## Efficiency Rule

The harness is working correctly when:
- tiny tasks are handled directly
- medium tasks load only the relevant local docs
- substantial or risky tasks route through `start-here.md`, then widen deliberately
- skills are loaded by trigger, not ritual

## Maintenance Rule

If docs are reorganized in the future:
- keep `CLAUDE.md` pointing to `docs/overview/start-here.md`
- keep `docs/overview/start-here.md` short and retrieval-oriented
- keep overview docs current before adding more process
- update this file if the harness model changes materially
