# Foxhound Dashboard

**Modern web UI for Foxhound AI agent observability platform**

Built with Next.js 16, Tailwind CSS 4, and shadcn/ui.

---

## Quick Start

### Sandbox Environment (No API Required)

Use the sandbox to review the dashboard with realistic seeded data and no authentication:

```bash
# from repo root, make sure workspace packages are linked
pnpm install

# if workspace-package module resolution fails, build the shared packages first
pnpm --filter @foxhound/types build
pnpm --filter @foxhound/api-client build
pnpm --filter @foxhound/demo-domain build

cd apps/web
pnpm dev:demo
# Navigate to http://localhost:3001/sandbox
```

**Sandbox features:**

- realistic seeded traces with mixed success and error states
- multiple agent types and workflows
- LLM calls, tool calls, and agent steps
- session grouping and replayable stories
- no authentication required
- strong review surface for screenshots, walkthroughs, and marketing previews

### Local Dashboard Sandbox Bypass (No Login Required)

If you want to review the real dashboard routes without auth redirects, enable the local sandbox flag:

```bash
cd apps/web
pnpm dev:demo
```

Then open routes like:
- `http://localhost:3001/` ← redirects to `/sandbox` when sandbox mode is enabled
- `http://localhost:3001/sandbox` ← start here for local review
- `http://localhost:3001/sandbox/traces` ← canonical seeded traces review surface
- `http://localhost:3001/sandbox/executive`
- `http://localhost:3001/sandbox/traces/trace_returns_exception_v18_regression`
- `http://localhost:3001/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression`
- `http://localhost:3001/sandbox/replay/trace_returns_exception_v18_regression`
- `http://localhost:3001/sandbox/budgets`
- `http://localhost:3001/sandbox/slas`
- `http://localhost:3001/sandbox/regressions`
- `http://localhost:3001/sandbox/notifications`

**Important:**
- This is a local preview mode only.
- Default behavior remains auth-protected when `FOXHOUND_UI_DEMO_MODE` is not set.
- `pnpm dev:demo` is the simplest way to launch the local dashboard sandbox.
- Some pages use seeded example data in this mode so the workflow can be reviewed without a live API session.
- `/sandbox` is the canonical preview surface.
- `/sandbox/traces` is the canonical seeded traces workbench for local review. Prefer validating seeded-trace UX there before debugging `/traces` in dashboard-demo mode.
- If the browser UI disagrees with the page header or seeded counts, check the live runtime first: confirm port `3001`, fetch the route HTML, then compare server-rendered content vs post-hydration client state.
- If Next reports `Module not found` for a workspace package like `@foxhound/demo-domain` or `@foxhound/api-client`, debug in this order:
  1. verify the workspace package is actually linked under `apps/web/node_modules/@foxhound/`
  2. verify the package exposes the expected `exports` entry
  3. verify the package has been built if it exports from `dist/`
  4. only then consider TS path or import-specifier changes
- Do **not** rewrite NodeNext `.js` import specifiers in workspace package source just to make web dev boot, fix link/build state first.

### Development (With Real API)

```bash
# Install dependencies (from root)
pnpm install

# Run dashboard only
cd apps/web
pnpm dev
```

Dashboard runs on: **http://localhost:3001**  
Canonical sandbox: **http://localhost:3001/sandbox**

### Build

```bash
# Type check
pnpm typecheck

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## Environment Variables

Create `.env.local` in `apps/web/`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:3001
FOXHOUND_UI_DEMO_MODE=true
```

For production, update to your deployed API URL and generate a secure secret.

---

## Architecture

### Tech Stack

- **Framework:** Next.js 16 (App Router, React Server Components)
- **Styling:** Tailwind CSS 4
- **Components:** shadcn/ui (Base UI)
- **Auth:** NextAuth.js (JWT sessions)
- **API Client:** @foxhound/api-client (workspace package)
- **State:** Zustand (future)
- **Data Fetching:** TanStack Query (future)

### File Structure

```
apps/web/
├── app/
│   ├── (auth)/           # Unauthenticated routes
│   │   └── login/
│   ├── (dashboard)/      # Protected routes
│   │   ├── traces/
│   │   ├── experiments/
│   │   └── ...
│   ├── sandbox/          # Public no-auth sandbox routes
│   └── api/auth/         # NextAuth API routes
├── components/
│   ├── ui/               # shadcn components
│   ├── layout/           # Sidebar, TopBar
│   ├── traces/           # Trace-specific components
│   └── providers.tsx
├── lib/
│   ├── api-client.ts     # API wrapper
│   ├── auth.ts           # NextAuth config
│   ├── sandbox-auth.ts   # sandbox auth bypass helpers
│   └── utils.ts
└── types/
```

---

## Testing

### Manual Testing

1. Start sandbox mode:

   ```bash
   cd apps/web
   pnpm dev:demo
   ```

2. Navigate to `http://localhost:3001/sandbox`
3. Verify overview, traces, diff, replay, and governance pages open with no auth
4. Verify the sandbox surface opens directly without any legacy `/demo` dependency

### Verification

```bash
pnpm verify
```

This runs the canonical sandbox route check, TypeScript typecheck, and the web test suite.

For the retirement decision trail and historical review packet, see `../docs/reference/2026-04-15-demo-retirement-review-packet.md`.

### Type Checking

```bash
pnpm typecheck
```

### Build Test

```bash
pnpm build
```
