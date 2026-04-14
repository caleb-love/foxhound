# Demo Theme + Routing Evaluation

**Date:** 2026-04-14  
**Scope:** Finalize demo routing, tenant-theme architecture, font alignment, reusable premium dashboard primitives, and branded catchall 404 behavior.

## Final outcome

**PASS**

The demo experience now has:
- working previously-missing routes (`/demo/replay`, `/demo/evaluators`, `/demo/sessions/[id]`)
- a tenant-theme architecture suitable for future whitelabeling
- a live demo theme settings surface
- default brand alignment with the current external marketing website implementation
- marketing-site-aligned typography in `apps/web`
- a smart Foxhound-specific 404 page

## Source of truth for default brand

Marketing website repo used for alignment:
- `/Users/caleb.love/Developer/foxhound-web`

Primary current implementation source:
- `/Users/caleb.love/Developer/foxhound-web/src/styles/design-system.css`

Key findings from source of truth:
- current primary brand = **blue** (`#2563eb`), not orange
- light premium background
- subtle blue + purple atmospheric gradients
- display/body/mono fonts:
  - `Outfit`
  - `DM Sans`
  - `JetBrains Mono`

## Architecture added

### Theme system
- `apps/web/lib/theme/types.ts`
- `apps/web/lib/theme/presets.ts`
- `apps/web/lib/theme/theme-to-css-vars.ts`
- `apps/web/components/theme/tenant-theme-provider.tsx`
- `apps/web/components/theme/theme-preview-card.tsx`

### Reusable demo/premium primitives
- `apps/web/components/demo/demo-theme.tsx`
- `apps/web/components/demo/dashboard-primitives.tsx`
- `apps/web/lib/demo-routes.ts`

### New demo routes
- `apps/web/app/demo/replay/page.tsx`
- `apps/web/app/demo/replay/[id]/page.tsx`
- `apps/web/app/demo/evaluators/page.tsx`
- `apps/web/app/demo/sessions/[id]/page.tsx`

### Global branded UX
- `apps/web/app/not-found.tsx`

## Notable migrations

Shared premium/themed structure applied across multiple surfaces:
- overview
- executive summary
- datasets
- experiments
- budgets
- SLAs
- notifications
- regressions
- settings
- shell/sidebar/theme provider

## Font alignment

`apps/web/app/layout.tsx` now uses:
- `Outfit` for display
- `DM Sans` for body
- `JetBrains Mono` for code/trace IDs

## Verification

### Commands
```bash
pnpm --filter web typecheck
```

### Route verification
Verified `200`:
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

Verified branded `404` behavior:
- `/definitely-not-a-real-route`

## Remaining recommended follow-up

The theme architecture is now correct, but future work can still improve depth:
1. persist theme choice per org
2. add editable theme overrides beyond presets
3. continue converting trace/diff/replay internals to full premium primitives
4. capture screenshots/video evidence for async review
