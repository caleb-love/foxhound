# Foxhound Documentation

This folder holds the internal documentation for Foxhound: project overview, architecture, roadmap state, implementation plans, process docs, and historical session evidence.

> Start with [`overview/start-here.md`](overview/start-here.md).
>
> For public-facing product docs, see [`docs-site/`](../docs-site/).

## Documentation Structure

```text
docs/
  README.md
  architecture.md
  commit-convention.md
  documentation-workflow.md
  skills.md

  overview/                     # Best entry points and current project truth
    start-here.md
    project-overview.md
    current-status.md

  reference/                    # Durable reference material
    engineering-notes.md
    architecture-decisions.md
    requirements-traceability.md

  roadmap/                      # Milestone outcomes and roadmap history
    milestones/
      M001/

  specs/                        # Design specs and major proposal docs

  plans/                        # Active, completed, archived, and testing plans
    active/
    completed/
    archive/
    testing/

  sessions/                     # Session logs, retros, decks, and evidence
```

## Reading Order

When docs disagree, use this order:

1. user request and directly related files
2. `docs/plans/active/`
3. latest relevant file in `docs/sessions/`
4. current diff and recent git history
5. `docs/overview/current-status.md`
6. `docs/overview/project-overview.md`
7. `docs/reference/engineering-notes.md`
8. specs and historical artifacts

## Primary Entry Points

### Overview
- [`overview/start-here.md`](overview/start-here.md)
- [`overview/harness-model.md`](overview/harness-model.md)
- [`overview/project-overview.md`](overview/project-overview.md)
- [`overview/current-status.md`](overview/current-status.md)

### Reference
- [`architecture.md`](architecture.md)
- [`reference/engineering-notes.md`](reference/engineering-notes.md)
- [`reference/architecture-decisions.md`](reference/architecture-decisions.md)
- [`reference/requirements-traceability.md`](reference/requirements-traceability.md)
- [`../SECURITY.md`](../SECURITY.md)

### Roadmap and Plans
- [`specs/2026-04-10-foxhound-strategic-roadmap-design.md`](specs/2026-04-10-foxhound-strategic-roadmap-design.md)
- [`roadmap/milestones/m001/m001-summary.md`](roadmap/milestones/m001/m001-summary.md)
- [`plans/active/2026-04-12-phase6-prompt-management-hardening.md`](plans/active/2026-04-12-phase6-prompt-management-hardening.md)
- [`plans/active/2026-04-12-testing-qa-gap-analysis.md`](plans/active/2026-04-12-testing-qa-gap-analysis.md)
- [`plans/active/2026-04-13-dashboard-strategy-world-class-ia.md`](plans/active/2026-04-13-dashboard-strategy-world-class-ia.md)
- [`plans/active/2026-04-13-dashboard-implementation-roadmap.md`](plans/active/2026-04-13-dashboard-implementation-roadmap.md)

## Naming Conventions

- Use lowercase kebab-case for new markdown filenames.
- Use date prefixes for plans/specs when chronology matters.
- Use descriptive names over workflow-specific jargon.
- Keep durable reference docs in `overview/` or `reference/`.
- Keep process docs in root-level operational docs unless they deserve their own area later.

## Where New Docs Go

| Doc type | Location |
|---|---|
| Cold-start / current project summary | `docs/overview/` |
| Durable engineering reference | `docs/reference/` |
| Strategic design specs | `docs/specs/` |
| Milestone summaries and validation | `docs/roadmap/milestones/` |
| Active implementation plans | `docs/plans/active/` |
| Completed plans | `docs/plans/completed/` |
| Archived/superseded plans | `docs/plans/archive/` |
| Testing guides and QA docs | `docs/plans/testing/` |
| Session logs and evidence decks | `docs/sessions/` |

## Cleanup Rules

- Remove stray `.DS_Store` and other OS artifacts.
- Avoid introducing tool-specific folder names into durable docs structure.
- Prefer updating existing reference docs over creating near-duplicates.
- Keep `plans/active/` small and current.
- Treat `sessions/` as evidence/history, not primary truth.
