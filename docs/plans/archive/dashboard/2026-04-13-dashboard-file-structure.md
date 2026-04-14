# Foxhound Dashboard: File Structure Reference

**Date:** 2026-04-13  
**Purpose:** Visual guide to the new `apps/web` directory structure

---

## Complete Directory Tree

```
Foxhound/
├── apps/
│   ├── api/                           # EXISTING — Fastify API
│   ├── worker/                        # EXISTING — BullMQ worker
│   └── web/                           # NEW — Next.js 15 dashboard
│       ├── app/
│       │   ├── (auth)/               # Auth routes (no layout)
│       │   │   ├── login/
│       │   │   │   └── page.tsx      # Login page
│       │   │   └── signup/
│       │   │       └── page.tsx      # Signup page
│       │   │
│       │   ├── (dashboard)/          # Dashboard routes (with sidebar layout)
│       │   │   ├── layout.tsx        # Sidebar + top bar wrapper
│       │   │   ├── page.tsx          # Dashboard home (overview)
│       │   │   │
│       │   │   ├── traces/
│       │   │   │   ├── page.tsx      # Trace list view
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Trace detail view
│       │   │   │
│       │   │   ├── sessions/
│       │   │   │   ├── page.tsx      # Session list
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Session detail
│       │   │   │
│       │   │   ├── experiments/
│       │   │   │   ├── page.tsx      # Experiment list
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Experiment detail
│       │   │   │
│       │   │   ├── datasets/
│       │   │   │   ├── page.tsx      # Dataset list
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Dataset detail
│       │   │   │
│       │   │   ├── budgets/
│       │   │   │   ├── page.tsx      # Budget dashboard
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Budget detail
│       │   │   │
│       │   │   ├── slas/
│       │   │   │   ├── page.tsx      # SLA monitor dashboard
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # SLA detail
│       │   │   │
│       │   │   ├── regressions/
│       │   │   │   ├── page.tsx      # Regression timeline
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Regression detail
│       │   │   │
│       │   │   └── settings/
│       │   │       ├── page.tsx      # Settings home
│       │   │       ├── organization/
│       │   │       │   └── page.tsx  # Org settings
│       │   │       ├── team/
│       │   │       │   └── page.tsx  # Team management
│       │   │       ├── api-keys/
│       │   │       │   └── page.tsx  # API key management
│       │   │       └── integrations/
│       │   │           └── page.tsx  # Slack, webhooks
│       │   │
│       │   ├── api/
│       │   │   └── auth/
│       │   │       └── [...nextauth]/
│       │   │           └── route.ts  # NextAuth handler
│       │   │
│       │   ├── layout.tsx            # Root layout (providers, fonts)
│       │   ├── globals.css           # Tailwind imports
│       │   └── favicon.ico
│       │
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   │   ├── button.tsx
│       │   │   ├── card.tsx
│       │   │   ├── table.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── dropdown-menu.tsx
│       │   │   ├── input.tsx
│       │   │   ├── label.tsx
│       │   │   ├── tabs.tsx
│       │   │   ├── badge.tsx
│       │   │   ├── command.tsx
│       │   │   ├── select.tsx
│       │   │   ├── checkbox.tsx
│       │   │   └── toast.tsx
│       │   │
│       │   ├── layout/               # Layout components
│       │   │   ├── sidebar.tsx       # Left sidebar nav
│       │   │   ├── top-bar.tsx       # Top navigation bar
│       │   │   └── user-menu.tsx     # User dropdown menu
│       │   │
│       │   ├── traces/               # Trace-specific components
│       │   │   ├── trace-table.tsx   # List view table
│       │   │   ├── trace-timeline.tsx # Timeline visualization
│       │   │   ├── span-list.tsx     # Span table view
│       │   │   ├── span-detail.tsx   # Span detail panel
│       │   │   └── trace-filters.tsx # Filter controls
│       │   │
│       │   ├── session-replay/       # Session Replay feature
│       │   │   ├── replay-viewer.tsx # Main replay component
│       │   │   ├── timeline-scrubber.tsx
│       │   │   ├── state-viewer.tsx  # JSON state display
│       │   │   └── state-diff.tsx    # Diff highlighter
│       │   │
│       │   ├── run-diff/             # Run Diff feature
│       │   │   ├── diff-viewer.tsx   # Main diff component
│       │   │   ├── diff-timeline.tsx # Side-by-side timelines
│       │   │   ├── metric-comparison.tsx
│       │   │   └── span-alignment.tsx
│       │   │
│       │   ├── experiments/          # Experiment components
│       │   │   ├── experiment-table.tsx
│       │   │   ├── leaderboard.tsx   # Visual comparison
│       │   │   ├── results-table.tsx
│       │   │   └── config-editor.tsx
│       │   │
│       │   ├── datasets/             # Dataset components
│       │   │   ├── dataset-table.tsx
│       │   │   ├── item-list.tsx
│       │   │   └── item-editor.tsx
│       │   │
│       │   ├── budgets/              # Budget components
│       │   │   ├── budget-card.tsx   # Budget overview card
│       │   │   ├── budget-widget.tsx # Always-visible widget
│       │   │   ├── spend-graph.tsx   # Cost over time
│       │   │   └── agent-breakdown.tsx
│       │   │
│       │   ├── slas/                 # SLA components
│       │   │   ├── sla-card.tsx      # SLA overview card
│       │   │   ├── compliance-graph.tsx
│       │   │   └── violations-list.tsx
│       │   │
│       │   ├── regressions/          # Regression components
│       │   │   ├── regression-card.tsx
│       │   │   ├── regression-timeline.tsx
│       │   │   └── before-after.tsx
│       │   │
│       │   └── shared/               # Shared components
│       │       ├── command-palette.tsx # Cmd+K search
│       │       ├── date-range-picker.tsx
│       │       ├── loading-skeleton.tsx
│       │       ├── error-boundary.tsx
│       │       └── empty-state.tsx
│       │
│       ├── lib/
│       │   ├── api-client.ts         # API client wrapper
│       │   ├── auth.ts               # NextAuth config
│       │   ├── utils.ts              # Utility functions (cn, formatters)
│       │   ├── hooks/                # React hooks
│       │   │   ├── use-traces.ts     # TanStack Query hooks
│       │   │   ├── use-experiments.ts
│       │   │   ├── use-datasets.ts
│       │   │   └── use-keyboard.ts   # Keyboard shortcut handler
│       │   │
│       │   └── stores/               # Zustand stores
│       │       ├── filter-store.ts   # Global filter state
│       │       ├── sidebar-store.ts  # Sidebar collapse state
│       │       └── theme-store.ts    # Dark mode state
│       │
│       ├── public/
│       │   ├── favicon.ico
│       │   ├── logo.svg
│       │   └── screenshots/          # Marketing screenshots
│       │       ├── trace-timeline.png
│       │       ├── session-replay.png
│       │       ├── run-diff.png
│       │       ├── budget-dashboard.png
│       │       ├── sla-monitor.png
│       │       └── experiment-leaderboard.png
│       │
│       ├── types/
│       │   ├── next-auth.d.ts        # NextAuth type extensions
│       │   └── api.ts                # API response types
│       │
│       ├── .env.local                # Environment variables
│       ├── .eslintrc.json
│       ├── .gitignore
│       ├── components.json           # shadcn config
│       ├── next.config.js
│       ├── package.json
│       ├── postcss.config.js
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── packages/                         # EXISTING — shared packages
│   ├── api-client/
│   ├── db/
│   ├── sdk/
│   ├── sdk-py/
│   ├── cli/
│   ├── mcp-server/
│   ├── billing/
│   ├── notifications/
│   └── types/
│
├── docs/                             # EXISTING — documentation
│   ├── plans/
│   │   ├── 2026-04-13-dashboard-ui-comprehensive-plan.md  # NEW
│   │   ├── 2026-04-13-dashboard-ui-quick-start.md         # NEW
│   │   ├── 2026-04-13-ui-competitive-analysis.md          # NEW
│   │   └── 2026-04-13-dashboard-ui-executive-summary.md   # NEW
│   └── specs/
│
└── turbo.json                        # EXISTING — Turborepo config
```

---

## Key Files to Create (Day 1-2)

### Essential Setup Files

1. **`apps/web/package.json`**
   ```json
   {
     "name": "@foxhound/web",
     "version": "0.1.0",
     "private": true,
     "scripts": {
       "dev": "next dev -p 3001",
       "build": "next build",
       "start": "next start",
       "lint": "next lint",
       "typecheck": "tsc --noEmit"
     }
   }
   ```

2. **`apps/web/.env.local`**
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-random-secret-here
   NEXTAUTH_URL=http://localhost:3001
   ```

3. **`apps/web/tailwind.config.ts`**
   ```typescript
   import type { Config } from 'tailwindcss';

   const config: Config = {
     darkMode: ['class'],
     content: [
       './app/**/*.{ts,tsx}',
       './components/**/*.{ts,tsx}',
     ],
     theme: {
       extend: {
         colors: {
           border: 'hsl(var(--border))',
           input: 'hsl(var(--input))',
           ring: 'hsl(var(--ring))',
           background: 'hsl(var(--background))',
           foreground: 'hsl(var(--foreground))',
           primary: {
             DEFAULT: 'hsl(var(--primary))',
             foreground: 'hsl(var(--primary-foreground))',
           },
           // ... shadcn colors
         },
       },
     },
     plugins: [require('tailwindcss-animate')],
   };

   export default config;
   ```

4. **`apps/web/app/layout.tsx`**
   ```typescript
   import './globals.css';
   import { Inter } from 'next/font/google';

   const inter = Inter({ subsets: ['latin'] });

   export const metadata = {
     title: 'Foxhound - AI Agent Observability',
     description: 'Open-source observability for AI agent fleets',
   };

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
     return (
       <html lang="en">
         <body className={inter.className}>{children}</body>
       </html>
     );
   }
   ```

5. **`apps/web/app/globals.css`**
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   @layer base {
     :root {
       --background: 0 0% 100%;
       --foreground: 222.2 84% 4.9%;
       --primary: 222.2 47.4% 11.2%;
       /* ... other CSS variables */
     }

     .dark {
       --background: 222.2 84% 4.9%;
       --foreground: 210 40% 98%;
       /* ... dark mode overrides */
     }
   }
   ```

---

## Component Import Patterns

### Using shadcn components:
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
```

### Using custom components:
```typescript
import { Sidebar } from '@/components/layout/sidebar';
import { TraceTimeline } from '@/components/traces/trace-timeline';
import { ReplayViewer } from '@/components/session-replay/replay-viewer';
```

### Using API client:
```typescript
import { getAuthenticatedClient } from '@/lib/api-client';

const client = getAuthenticatedClient(session.user.token);
const traces = await client.get('/v1/traces');
```

---

## Routing Patterns

### Server Component (RSC) with data fetching:
```typescript
// app/(dashboard)/traces/page.tsx
import { getServerSession } from 'next-auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function TracesPage() {
  const session = await getServerSession(authOptions);
  const client = getAuthenticatedClient(session!.user.token);
  const traces = await client.get('/v1/traces');

  return <TraceTable initialData={traces} />;
}
```

### Client Component with TanStack Query:
```typescript
// components/traces/trace-table.tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function TraceTable({ initialData }) {
  const { data } = useQuery({
    queryKey: ['traces'],
    queryFn: () => fetch('/api/traces').then(r => r.json()),
    initialData,
  });

  return <Table>...</Table>;
}
```

---

## State Management Patterns

### Global Filter State (Zustand):
```typescript
// lib/stores/filter-store.ts
import { create } from 'zustand';

interface FilterState {
  status: 'all' | 'success' | 'error';
  agentId: string | null;
  dateRange: { start: Date; end: Date };
  setStatus: (status: FilterState['status']) => void;
  setAgentId: (agentId: string | null) => void;
  setDateRange: (range: FilterState['dateRange']) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  status: 'all',
  agentId: null,
  dateRange: { start: new Date(), end: new Date() },
  setStatus: (status) => set({ status }),
  setAgentId: (agentId) => set({ agentId }),
  setDateRange: (dateRange) => set({ dateRange }),
}));
```

### Using in component:
```typescript
'use client';

import { useFilterStore } from '@/lib/stores/filter-store';

export function TraceFilters() {
  const { status, setStatus } = useFilterStore();

  return (
    <select value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="all">All</option>
      <option value="success">Success</option>
      <option value="error">Error</option>
    </select>
  );
}
```

---

## Testing Structure (Future)

```
apps/web/
├── __tests__/
│   ├── components/
│   │   ├── traces/
│   │   │   ├── trace-table.test.tsx
│   │   │   └── trace-timeline.test.tsx
│   │   └── layout/
│   │       └── sidebar.test.tsx
│   │
│   ├── lib/
│   │   ├── api-client.test.ts
│   │   └── utils.test.ts
│   │
│   └── e2e/                         # Playwright tests
│       ├── auth.spec.ts
│       ├── trace-viewer.spec.ts
│       └── session-replay.spec.ts
│
└── vitest.config.ts
```

---

## Build & Development Commands

```bash
# From root directory:
pnpm dev                    # Run all apps (api + web)
pnpm dev --filter=web       # Run just web dashboard
pnpm build --filter=web     # Build for production
pnpm typecheck --filter=web # Type-check only web app

# From apps/web:
pnpm dev                    # Dev server on localhost:3001
pnpm build                  # Production build
pnpm start                  # Serve production build
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript check
```

---

## Deployment Files (Vercel)

### `apps/web/vercel.json` (optional, for custom config):
```json
{
  "buildCommand": "pnpm turbo build --filter=web",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.foxhound.dev"
  }
}
```

### GitHub Actions (`.github/workflows/deploy-web.yml`):
```yaml
name: Deploy Web Dashboard

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm turbo build --filter=web
      
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## File Size Expectations

### After Day 1-2 Setup:
- `apps/web/`: ~15 MB (mostly node_modules)
- Source code: ~50 KB
- Total files: ~200 (mostly dependencies)

### After Full Build (Week 8):
- Source code: ~500 KB
- Components: ~150 files
- Total files: ~300 (excluding node_modules)

---

## Quick Reference: File Ownership

| Directory | Purpose | When to Edit |
|-----------|---------|--------------|
| `app/(auth)/` | Auth pages | Once during setup |
| `app/(dashboard)/` | Main app routes | Every feature you add |
| `components/ui/` | shadcn components | Rarely (use as-is) |
| `components/traces/` | Trace features | Week 1-2 |
| `components/session-replay/` | Session Replay | Week 3 |
| `components/run-diff/` | Run Diff | Week 3 |
| `components/experiments/` | Experiments | Week 4 |
| `components/budgets/` | Budgets | Week 5 |
| `components/slas/` | SLAs | Week 5 |
| `lib/` | Utilities, API client | Throughout |
| `public/` | Static assets | Throughout |

---

## Common File Operations

### Add a new page:
1. Create `app/(dashboard)/new-page/page.tsx`
2. Add route to sidebar (`components/layout/sidebar.tsx`)
3. Create components in `components/new-page/`

### Add a new API route:
1. Create `app/api/new-route/route.ts`
2. Define GET/POST/etc handlers
3. Use in client components with `fetch('/api/new-route')`

### Add a new shadcn component:
```bash
pnpm dlx shadcn@latest add <component-name>
```

### Add a new custom component:
1. Create `components/<category>/<name>.tsx`
2. Export component
3. Import where needed: `import { Name } from '@/components/<category>/<name>'`

---

## Next Steps

1. **Review this structure** — understand where each file lives
2. **Bootstrap the app** — follow Quick Start Guide to create initial files
3. **Iterate rapidly** — add features one at a time, test in browser

**File structure is ready. Time to build.**
