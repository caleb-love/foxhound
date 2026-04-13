# @foxhound/types

Shared TypeScript types for the Foxhound observability platform.

## Installation

This is a workspace package - install via pnpm workspaces:

```json
{
  "dependencies": {
    "@foxhound/types": "workspace:^"
  }
}
```

## Available Types

### Core Observability Types

#### Trace
Top-level trace object representing a single agent execution.

```typescript
interface Trace {
  id: string;
  agentId: string;
  sessionId?: string;
  startTimeMs: number;
  endTimeMs?: number;
  spans: Span[];
  metadata: Record<string, string | number | boolean | null>;
}
```

#### Span
Individual operation within a trace (LLM call, tool call, agent step, etc.)

```typescript
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeMs: number;
  endTimeMs?: number;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean | null>;
  events: SpanEvent[];
}
```

### Enums

#### SpanKind
```typescript
type SpanKind = 'llm_call' | 'tool_call' | 'agent_step' | 'workflow' | 'custom';
```

#### SpanStatus
```typescript
type SpanStatus = 'ok' | 'error' | 'unset';
```

## Important Contracts

### Attributes & Metadata Types

**CRITICAL:** Both `Span.attributes` and `Trace.metadata` use the same type:

```typescript
Record<string, string | number | boolean | null>
```

**This means:**
- ✅ You can use: strings, numbers, booleans, null
- ❌ You cannot use: undefined, objects, arrays, functions

**When creating demo data or test fixtures:**

```typescript
// ✅ RIGHT
const span: Span = {
  attributes: {
    model: "gpt-4",
    tokens: 1234,
    cost: 0.05,
    cached: true,
  }
};

// ❌ WRONG
const span: Span = {
  attributes: {
    model: "gpt-4",
    tokens: 1234,
    cached: undefined,  // ❌ undefined not allowed
    metadata: { key: "value" },  // ❌ nested objects not allowed
  }
};
```

## Usage Examples

### Basic Import
```typescript
import type { Trace, Span, SpanKind } from '@foxhound/types';

function processTrace(trace: Trace) {
  // TypeScript knows the structure
}
```

### Creating Test Data
```typescript
import type { Trace, Span } from '@foxhound/types';

const mockTrace: Trace = {
  id: 'trace-123',
  agentId: 'test-agent',
  startTimeMs: Date.now(),
  spans: [],
  metadata: {
    environment: 'test',
    version: '1.0.0',
  },
};
```

### Filtering by Span Kind
```typescript
const llmCalls = trace.spans.filter(
  (span): span is Span & { kind: 'llm_call' } => 
    span.kind === 'llm_call'
);
```

### Type Guards
```typescript
function isLLMCall(span: Span): span is Span & { kind: 'llm_call' } {
  return span.kind === 'llm_call';
}

const llmSpans = trace.spans.filter(isLLMCall);
```

## Adding New Types

When adding types to this package:

1. Add to `src/index.ts`
2. Export from main index
3. Bump package version
4. Update this README

**Don't** create local types in apps that should be shared. Add them here instead.

## Type Evolution Guidelines

### When to Add a New Type
- Shared across 2+ packages/apps
- Part of the core domain model
- API contract types
- Configuration types used by multiple consumers

### When NOT to Add Here
- Component-specific props (keep in component file)
- Single-app utility types
- Temporary/experimental types
- Implementation details (internal types)

### Breaking Changes
- Never remove exported types
- Never change existing type definitions
- Add new types or properties instead
- Use deprecation comments for old types:

```typescript
/**
 * @deprecated Use NewType instead
 */
export type OldType = string;
```

## Related Packages

- `@foxhound/api-client` - Uses these types for API requests/responses
- `@foxhound/sdk` - Uses these types for instrumentation
- `@foxhound/sdk-py` - Python equivalents (Pydantic models)
- `apps/web` - Uses these types for UI components
- `apps/api` - Uses these types for API handlers

## Type Safety Checklist

Before defining types in your app:

1. ✅ Check if type already exists here
2. ✅ Use exact type definitions (don't make stricter/looser)
3. ✅ Import types, don't redefine them
4. ✅ If type should be shared, add it here

## Development

```bash
# Build types
pnpm build

# Type check
pnpm typecheck

# Watch mode
pnpm dev
```

## Contributing

When contributing new types:

1. Add type to `src/index.ts`
2. Add usage example to this README
3. Update type location guide in apps/web/CLAUDE.md
4. Consider Python SDK equivalent
