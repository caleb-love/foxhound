# Foxhound Web App

Next.js 15 dashboard for Foxhound observability platform. See [PATTERNS.md](./PATTERNS.md) for React patterns and best practices.

**Parent context:** See [@AGENTS.md](../../CLAUDE.md) in repo root for project-wide operating principles.

## Type Safety Rules

### Before Defining Any Interface

1. **Check `@foxhound/types` first**
   ```bash
   grep -r "interface Trace\|interface Span" packages/types/src/
   ```

2. **Import from workspace packages**
   ```typescript
   import type { Trace, Span } from '@foxhound/types';
   ```

3. **Match package contracts exactly**
   ```typescript
   // ✅ RIGHT - Matches types package
   type SpanAttributes = Record<string, string | number | boolean | null>;
   
   // ❌ WRONG - Stricter than package
   interface SpanAttributes {
     model?: string;
     tokens?: number;
     [key: string]: string | number | boolean | null;
   }
   ```

4. **If type doesn't exist, add it to `packages/types`**
   - Don't create local types that should be shared
   - Update the types package, bump version, update consumers

### Type Location Guide

| Type | Where to Define |
|------|----------------|
| API request/response | `@foxhound/types` |
| Component props | Component file |
| Zustand store | Store file |
| Utility functions | Function file |
| Shared interfaces | `@foxhound/types` |

## Code Conventions

### Unused Variables

Prefix with underscore when intentionally unused:

```typescript
// ✅ Function signature requires parameter, but we don't use it yet
function generateTrace(_baseTime: number): Trace {
  return { /* ... */ };
}

// ✅ Interface requires handler, but we don't need the event
function onClick(_event: MouseEvent) {
  doSomething();
}
```

**ESLint is configured to allow `_` prefixed variables.**

## Testing

### Test File Location

```
lib/
  stores/
    filter-store.ts
    __tests__/
      filter-store.test.ts  ← Tests go here
```

### Vitest Config

Standard config in `vitest.config.ts` - don't add plugins unless needed.

```typescript
// ✅ RIGHT - Minimal config
export default defineConfig({
  test: { globals: true, setupFiles: ['./vitest.setup.ts'] },
  resolve: { alias: { '@': resolve(__dirname, './') } },
});

// ❌ WRONG - Unnecessary plugin
import react from '@vitejs/plugin-react';  // Not needed!
```

### Test Structure

```typescript
describe('useFilterStore', () => {
  beforeEach(() => {
    // Reset store state
    useFilterStore.getState().clearFilters();
  });

  it('should do something', () => {
    const { action } = useFilterStore.getState();
    action();
    expect(useFilterStore.getState().value).toBe(expected);
  });
});
```

## Common Pitfalls

### ❌ Don't: setState in useEffect
Causes cascading renders. Use key prop to reset state. See [PATTERNS.md](./PATTERNS.md#reset-component-state-on-prop-change).

### ❌ Don't: JSX in try/catch
Errors in render won't be caught. Use error boundaries.

### ❌ Don't: Define types that exist in packages
Always check `@foxhound/types` first. See [packages/types/README.md](../../packages/types/README.md).

### ❌ Don't: Add Vite plugins to Vitest
Vitest handles JSX/TS transformation automatically.

### ✅ Do: Read PATTERNS.md
Common React patterns with working examples: [PATTERNS.md](./PATTERNS.md)

## Project Structure

```
app/
  (dashboard)/          — Main dashboard routes
    layout.tsx          — Shared layout with sidebar
    page.tsx            — Dashboard home
    traces/             — Traces list & detail
    agents/             — Agent management
    settings/           — Settings pages
  api/                  — API routes (if needed)
components/
  ui/                   — shadcn/ui components
  layout/               — Layout components (Sidebar, Header)
  traces/               — Trace-specific components
  agents/               — Agent-specific components
lib/
  stores/               — Zustand stores
    __tests__/          — Store tests
  utils/                — Utility functions
  hooks/                — Custom React hooks
  constants.ts          — App constants
```

## Development

```bash
# Start dev server
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Environment Variables

```bash
# Required
NEXT_PUBLIC_API_URL=http://localhost:3000  # API base URL

# Optional
NEXT_PUBLIC_ENVIRONMENT=development         # Environment name
```

## Dependencies

- **Next.js 15** — React framework with App Router
- **React 19** — UI library
- **Tailwind CSS** — Styling
- **shadcn/ui** — UI component library
- **Zustand** — State management
- **Recharts** — Charting library
- **date-fns** — Date utilities
- **@foxhound/types** — Shared types from workspace

## Known Issues

None currently.

## Related Documentation

- [React Patterns](./PATTERNS.md) — Common patterns and best practices
- [Types Package](../../packages/types/README.md) — Shared TypeScript types
- [Root CLAUDE.md](../../CLAUDE.md) — Project-wide principles
- [Strategic Roadmap](../../docs/specs/2026-04-10-foxhound-strategic-roadmap-design.md) — Product direction
