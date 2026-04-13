# Foxhound Dashboard

**Modern web UI for Foxhound AI agent observability platform**

Built with Next.js 16, Tailwind CSS 4, and shadcn/ui.

---

## Quick Start

### Demo Mode (No API Required!)

Test the UI with realistic generated data:

```bash
cd apps/web
pnpm dev
# Navigate to http://localhost:3001/demo
```

**Demo mode features:**

- 25 realistic traces with mixed success/error states
- Multiple agent types (customer-support, code-review, data-analysis, etc.)
- LLM calls, tool calls, and agent steps
- Session grouping (~30% of traces)
- No authentication required
- Perfect for screenshots and demos

### Development (With Real API)

```bash
# Install dependencies (from root)
pnpm install

# Run dashboard only
cd apps/web
pnpm dev

# Or run dashboard + API together (from root)
pnpm dev:all
```

Dashboard runs on: **http://localhost:3001**  
Demo mode: **http://localhost:3001/demo**

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
│   └── api/auth/         # NextAuth API routes
├── components/
│   ├── ui/               # shadcn components
│   ├── layout/           # Sidebar, TopBar
│   ├── traces/           # Trace-specific components
│   └── providers.tsx
├── lib/
│   ├── api-client.ts     # API wrapper
│   ├── auth.ts           # NextAuth config
│   └── utils.ts
└── types/
```

---

## Features

### ✅ Implemented (Day 1)

- [x] Authentication (login, logout, protected routes)
- [x] Trace list view
- [x] Trace detail view with visual timeline
- [x] Dashboard layout with sidebar navigation
- [x] Status badges, duration display, span counts
- [x] Color-coded span types (LLM, Tool, Agent, Workflow)

### 🚧 In Progress (Week 1-2)

- [ ] Trace filters (status, agent, date range)
- [ ] Global search
- [ ] Session Replay viewer
- [ ] Run Diff comparison
- [ ] Signup page
- [ ] API key management

### 📅 Planned (Week 3-8)

- [ ] Experiments & evaluations UI
- [ ] Dataset management
- [ ] Cost budget dashboard
- [ ] SLA monitoring
- [ ] Behavior regression detection
- [ ] Command palette (Cmd+K)
- [ ] Dark mode
- [ ] Mobile responsive

---

## Development Workflow

### Adding a New Page

1. Create route file:

   ```bash
   mkdir -p app/(dashboard)/my-feature
   touch app/(dashboard)/my-feature/page.tsx
   ```

2. Add to sidebar (`components/layout/sidebar.tsx`):

   ```typescript
   { href: '/my-feature', label: 'My Feature', icon: Icon }
   ```

3. Create components:
   ```bash
   mkdir components/my-feature
   touch components/my-feature/my-component.tsx
   ```

### Adding a shadcn Component

```bash
pnpm dlx shadcn@latest add <component-name>
```

Available: button, card, table, dialog, dropdown-menu, input, label, tabs, badge, command, select, etc.

### Type Safety

All API responses are typed via `@foxhound/types`. Import from workspace package:

```typescript
import type { Trace, Span } from "@foxhound/types";
```

---

## Testing

### Manual Testing

1. Start API server:

   ```bash
   cd apps/api
   pnpm dev
   ```

2. Start dashboard:

   ```bash
   cd apps/web
   pnpm dev
   ```

3. Navigate to `http://localhost:3001`
4. Log in with test credentials
5. Verify trace list loads
6. Click trace → verify detail view

### Type Checking

```bash
pnpm typecheck
```

### Build Test

```bash
pnpm build
```

---

## Troubleshooting

### "No traces yet" message

**Cause:** API not running or no traces in database  
**Fix:** Start API, send test trace via SDK

### Login fails

**Cause:** API server not responding  
**Fix:** Verify API is running on port 3000

### TypeScript errors

**Cause:** Missing types or wrong API usage  
**Fix:** Run `pnpm typecheck` to see details

### Build fails

**Cause:** Import errors or missing dependencies  
**Fix:** Check `pnpm install` completed, verify workspace packages are built

---

## Deployment

### Vercel (Recommended)

1. Connect GitHub repo to Vercel
2. Set root directory to `apps/web`
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
4. Deploy

### Custom Server

1. Build:

   ```bash
   pnpm build
   ```

2. Start:

   ```bash
   pnpm start
   ```

3. Nginx proxy (optional):
   ```nginx
   location / {
     proxy_pass http://localhost:3001;
   }
   ```

---

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow Next.js App Router conventions
- Use Server Components by default, Client Components only when needed
- Tailwind classes for styling (no CSS modules)

### Component Patterns

- **Server Component:** Data fetching, static rendering
- **Client Component:** Interactivity, state, event handlers
- Mark client components with `'use client'`

### Commit Messages

Follow Conventional Commits:

```
feat(traces): add filter by agent
fix(auth): handle expired sessions
docs(readme): add deployment guide
```

---

## Performance

### Bundle Size Targets

- Initial JS: <500KB
- Total size: <2MB
- First Contentful Paint: <1.5s

### Optimization Tips

- Use `next/image` for images
- Lazy load heavy components
- Server Components for data fetching
- Static generation where possible

---

## Roadmap

See [`docs/plans/2026-04-13-dashboard-ui-comprehensive-plan.md`](../../docs/plans/2026-04-13-dashboard-ui-comprehensive-plan.md) for the full 8-week plan.

**Week 1-2:** Foundation + core trace viewer  
**Week 3:** Session Replay + Run Diff  
**Week 4:** Experiments + evaluations  
**Week 5:** Cost Budgets + SLA monitoring  
**Week 6:** Behavior regression detection  
**Week 7:** Settings + admin  
**Week 8:** Polish + launch

---

## Support

For questions or issues:

1. Check documentation in `docs/plans/`
2. Review `docs/gsd/KNOWLEDGE.md` for patterns
3. Open GitHub issue

---

## License

Same as Foxhound parent project (see root LICENSE file).
