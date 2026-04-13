# React Patterns for Foxhound Web

## State Management

### Reset Component State on Prop Change

**Use Case:** Modal forms, wizards, multi-step flows where component needs "fresh" state

❌ **WRONG - setState in useEffect**
```tsx
useEffect(() => {
  if (editingId) {
    setFormData(getInitialData(editingId));  // Cascading renders!
  }
}, [editingId]);
```

❌ **WRONG - useRef during render**
```tsx
const prevId = useRef(editingId);
if (prevId.current !== editingId) {
  setFormData(...);  // Can't access refs during render!
}
```

✅ **RIGHT - key prop**
```tsx
// React unmounts and remounts with fresh state
<Dialog key={editingId || 'new'} open={isOpen}>
  <EditForm />
</Dialog>
```

### When to Use Key Prop Reset
- Modal edit forms that switch between items
- Wizards that restart on prop change
- Any component that needs "clean slate" on prop change
- Alternative to complex cleanup logic

### When NOT to Use
- State should persist across prop changes
- Performance-critical lists (use stable keys)
- Controlled components (parent manages state)

## Server Components vs Client Components

### Default to Server Components
```tsx
// app/(dashboard)/page.tsx
export default async function DashboardPage() {
  const data = await fetchData();  // Server-side only
  return <ClientTable data={data} />;
}
```

### Mark Client Components Explicitly
```tsx
'use client';  // Only when needed

export function InteractiveTable({ data }) {
  const [selected, setSelected] = useState([]);
  // ...
}
```

### Client Component Checklist
Only use 'use client' when you need:
- useState, useEffect, or other hooks
- Event handlers (onClick, onChange, etc.)
- Browser APIs (localStorage, window, etc.)
- Third-party libraries that use hooks

## Error Handling

### Use Error Boundaries
```tsx
// app/(dashboard)/error.tsx
'use client';

export default function DashboardError({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Never JSX in try/catch
❌ WRONG
```tsx
try {
  return <Component />;  // Errors won't be caught!
} catch (error) {
  // ...
}
```

✅ RIGHT
```tsx
let data;
try {
  data = await fetchData();
} catch (error) {
  notFound();
}
return <Component data={data} />;
```

## Type Safety

### Always Import from @foxhound/types
```tsx
import type { Trace, Span } from '@foxhound/types';

// ✅ RIGHT - Use package types
function TraceViewer({ trace }: { trace: Trace }) {
  // ...
}

// ❌ WRONG - Local types that duplicate package
interface MyTrace {
  id: string;
  // ...
}
```

## Performance

### Use useMemo for Expensive Filters
```tsx
const filtered = useMemo(() => {
  return traces.filter(/* expensive logic */);
}, [traces, filters]);
```

### Lazy Load Heavy Components
```tsx
const HeavyChart = lazy(() => import('./heavy-chart'));

<Suspense fallback={<Spinner />}>
  <HeavyChart />
</Suspense>
```

## Component Organization

### Co-locate Related Files
```
components/
  budget-form/
    budget-form-modal.tsx      # Main component
    budget-form-fields.tsx     # Sub-components
    budget-form.test.tsx       # Tests
    budget-form.types.ts       # Local types (if needed)
```

### Prefer Single Export per File
```tsx
// ✅ budget-form-modal.tsx
export function BudgetFormModal() { }

// ❌ components.tsx - avoid barrel files for components
export { BudgetFormModal } from './budget-form-modal';
export { TraceViewer } from './trace-viewer';
```
