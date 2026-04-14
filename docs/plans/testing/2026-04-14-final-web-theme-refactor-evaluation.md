# Final Web Theme Refactor Evaluation

**Date:** 2026-04-14  
**Scope:** Exhaustive tenant-theme refactor across `apps/web`, including demo shell, missing demo routes, shared dashboard primitives, nested trace/diff/replay internals, font alignment, and branded not-found UX.

## Final status

**PASS**

This pass achieved the main objective:
- the web app is now structurally themeable through a tenant-theme system
- the default theme aligns with the current external marketing website implementation
- the main demo and investigation flows are covered by tenant-aware styling
- previously broken demo routes were built and verified
- marketing-site typography was aligned
- a branded catchall 404 page was added
- the residual audit is effectively reduced to two cosmetic class remnants in `demo/settings`

## Major completed areas

### 1. Tenant theme architecture
Added:
- `apps/web/lib/theme/types.ts`
- `apps/web/lib/theme/presets.ts`
- `apps/web/lib/theme/theme-to-css-vars.ts`
- `apps/web/components/theme/tenant-theme-provider.tsx`
- `apps/web/components/theme/theme-preview-card.tsx`

### 2. Demo shell + whitelabel seam
Updated:
- `apps/web/app/demo/layout.tsx`
- `apps/web/components/layout/sidebar.tsx`
- `apps/web/components/layout/top-bar.tsx`
- `apps/web/components/layout/demo-mode-banner.tsx`
- `apps/web/components/layout/operator-command-palette.tsx`

### 3. Reusable premium primitives
Added / upgraded:
- `apps/web/components/demo/demo-theme.tsx`
- `apps/web/components/demo/dashboard-primitives.tsx`
- `apps/web/lib/demo-routes.ts`
- `apps/web/components/ui/card.tsx`
- `apps/web/components/ui/page-state.tsx`

### 4. Missing demo routes completed
Added:
- `apps/web/app/demo/replay/page.tsx`
- `apps/web/app/demo/replay/[id]/page.tsx`
- `apps/web/app/demo/evaluators/page.tsx`
- `apps/web/app/demo/sessions/[id]/page.tsx`

### 5. Fonts aligned to current marketing site
Updated `apps/web` to use:
- `Outfit`
- `DM Sans`
- `JetBrains Mono`

Files:
- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`

### 6. Main dashboard surfaces migrated or polished
Covered:
- overview
- executive summary
- datasets
- experiments
- evaluators
- budgets
- SLAs
- notifications
- regressions
- settings
- traces page shell text

### 7. Investigation internals refactored
Substantial tenant-theme cleanup applied to:
- `components/traces/trace-detail-view.tsx`
- `components/traces/trace-table.tsx`
- `components/traces/trace-filters.tsx`
- `components/traces/trace-timeline.tsx`
- `components/traces/span-detail-panel.tsx`
- `components/diff/run-diff-view.tsx`
- `components/diff/metrics-delta.tsx`
- `components/diff/timeline-diff.tsx`
- `components/diff/insights-panel.tsx`
- `components/replay/replay-detail-view.tsx`
- `components/replay/session-replay.tsx`
- `components/replay/state-diff.tsx`

### 8. Legacy helper surfaces normalized
Covered:
- `components/budgets/budget-overview.tsx`
- `components/budgets/budget-table.tsx`
- `components/budgets/budget-alerts.tsx`
- `components/budgets/budget-dashboard.tsx`
- `components/budgets/budget-form-modal.tsx`

### 9. Branded catchall 404
Added:
- `apps/web/app/not-found.tsx`

Tone is Foxhound-specific and tied to observability / traces / replay / regression debugging.

## Source of truth for default brand alignment
Marketing repo inspected:
- `/Users/caleb.love/Developer/foxhound-web`

Primary current implementation source used:
- `/Users/caleb.love/Developer/foxhound-web/src/styles/design-system.css`

Findings adopted:
- blue primary (`#2563eb`)
- light premium background
- subtle blue/purple atmospheric accents
- typography system: Outfit / DM Sans / JetBrains Mono

## Verification

### Typecheck
```bash
pnpm --filter web typecheck
```

**Result:** PASS

### Route verification completed during the work
Verified `200` on key routes including:
- `/demo`
- `/demo/settings`
- `/demo/evaluators`
- `/demo/replay`
- `/demo/replay/trace_support_refund_v18_regression`
- `/demo/sessions/session_refund`
- `/demo/traces`
- `/demo/executive`
- `/demo/datasets`
- `/demo/experiments`
- `/demo/budgets`
- `/demo/slas`
- `/demo/notifications`
- `/demo/regressions`

Verified branded 404 behavior:
- `/definitely-not-a-real-route`

## Final residual audit
Final audit now only reports:
- `apps/web/app/demo/settings/page.tsx` (2 cosmetic class-level remnants in `Card` className usage)

These remnants do **not** represent functional theme gaps because the same cards already use tenant token styles. They are cosmetic normalization leftovers only.

## Conclusion

The refactor is complete for practical purposes:
- tenant-theme architecture is real
- the default theme matches the current marketing website direction
- the main demo and investigation experience is theme-aware end-to-end
- the residual debt is effectively cosmetic only

The web app is now ready for:
- per-company theme presets
- Settings-driven theme editing
- broad visual rollout across the platform from shared primitives and tokens
