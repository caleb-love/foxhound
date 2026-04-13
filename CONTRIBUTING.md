# Contributing to Foxhound

Thank you for your interest in contributing to Foxhound! This document provides guidelines and conventions for contributing to the project.

## Getting Started

1. **Clone and setup:**
   ```bash
   git clone https://github.com/yourusername/foxhound.git
   cd foxhound
   pnpm install
   pnpm build
   ```

2. **Run tests:**
   ```bash
   pnpm test
   ```

3. **Start development:**
   ```bash
   pnpm dev
   ```

## Development Workflow

See [CLAUDE.md](./CLAUDE.md) for detailed workflow, including:
- Skills-first development
- Planning requirements
- Multi-persona review process
- Security requirements
- Documentation standards

## Code Conventions

### Unused Variables

When a variable is intentionally unused (reserved for future use, required by interface signature, etc.), prefix it with an underscore:

```typescript
// ✅ Correct - underscore prefix for unused parameters
function generateTrace(_baseTime: number): Trace {
  return { id: generateId(), spans: [] };
}

// ✅ Correct - unused event handler parameter
function onClick(_event: MouseEvent) {
  doSomething();
}

// ❌ Incorrect - ESLint will flag this
function generateTrace(baseTime: number): Trace {
  return { id: generateId(), spans: [] };  // baseTime never used
}
```

**Why?** This is an industry-standard convention (TypeScript, React, Next.js) that:
- Makes intent explicit (parameter reserved for future, not forgotten)
- Prevents ESLint warnings
- Maintains interface contracts

### TypeScript

- **Always use strict mode** - Project uses `strict: true`
- **Prefer type over interface** for type aliases
- **Use interface for object shapes** that may be extended
- **Import types explicitly:**
  ```typescript
  import type { Trace, Span } from '@foxhound/types';
  ```

### Naming Conventions

- **Files:** kebab-case (`trace-viewer.tsx`, `filter-store.ts`)
- **Components:** PascalCase (`TraceViewer`, `BudgetFormModal`)
- **Functions/variables:** camelCase (`processTrace`, `agentId`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Types/Interfaces:** PascalCase (`Trace`, `SpanKind`)

### Error Handling

```typescript
// ✅ Correct - typed errors
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof ApiError) {
    handleApiError(error);
  } else if (error instanceof Error) {
    console.error('Unexpected error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}

// ❌ Incorrect - untyped catch
try {
  await riskyOperation();
} catch (error: any) {
  console.error(error);
}
```

### Import Order

1. External packages
2. Workspace packages (`@foxhound/*`)
3. Relative imports (parent directories)
4. Relative imports (same directory)
5. Type imports (grouped at end)

```typescript
import { useState } from 'react';
import { format } from 'date-fns';

import type { Trace, Span } from '@foxhound/types';
import { TraceService } from '@foxhound/api-client';

import { Layout } from '../layout/layout';
import { TraceViewer } from './trace-viewer';

import type { TraceListProps } from './types';
```

## Testing

### Test Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe('method/behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupTest();
      
      // Act
      const result = performAction(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Coverage

- **Minimum:** 70% coverage for new code
- **Target:** 80%+ for critical paths
- **Required:** 100% for security-critical code (auth, data access, multi-tenancy)

### Test File Location

```
src/
  feature/
    feature.ts
    __tests__/
      feature.test.ts
```

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

[optional body]

[optional footer]
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, missing semicolons, etc.)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvement
- `test:` Adding or updating tests
- `chore:` Maintenance (deps, tooling, etc.)

### Scopes
- `api` - API server
- `web` - Web dashboard
- `sdk` - TypeScript SDK
- `sdk-py` - Python SDK
- `db` - Database/schema
- `cli` - CLI tool
- `docs` - Documentation

### Examples

```bash
feat(web): add trace filtering by agent ID
fix(api): prevent SQL injection in trace queries
docs(sdk): add Python quickstart guide
refactor(db): normalize span attributes schema
```

## Pull Request Process

1. **Create feature branch:**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes:**
   - Write code
   - Add tests
   - Update documentation

3. **Run verification:**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

4. **Commit with conventional commits**

5. **Push and create PR:**
   - Fill out PR template
   - Link related issues
   - Request review from appropriate personas (see CLAUDE.md)

6. **Address review feedback**

7. **Squash and merge** when approved

## Documentation

### When to Document

- **Always:** Public APIs, SDKs, CLI commands
- **Required:** Complex algorithms, security-critical code
- **Helpful:** Non-obvious implementations, workarounds

### JSDoc Format

```typescript
/**
 * Processes a trace and extracts LLM metrics
 * 
 * @param trace - The trace to process
 * @param options - Processing options
 * @returns Extracted metrics including cost and token counts
 * @throws {ValidationError} When trace is invalid
 * 
 * @example
 * ```ts
 * const metrics = processTrace(trace, { includeTools: true });
 * console.log(metrics.totalCost);
 * ```
 */
export function processTrace(
  trace: Trace,
  options: ProcessOptions
): TraceMetrics {
  // ...
}
```

## Security Guidelines

See [CLAUDE.md Section 4](./CLAUDE.md#4-security-is-non-negotiable) for full security requirements.

**Critical rules:**
- Every DB query MUST be scoped by `org_id`
- Never log sensitive data (API keys, user data)
- All auth changes require security review
- Input validation on all external data

## Code Review Checklist

Before requesting review:

- [ ] Tests pass locally (`pnpm test`)
- [ ] No type errors (`pnpm typecheck`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Commits follow conventional commit format
- [ ] Documentation is updated
- [ ] Security review completed (if applicable)
- [ ] Breaking changes are documented

## Questions?

- Check [CLAUDE.md](./CLAUDE.md) for project context
- Review [docs/](./docs/) for architecture and decisions
- Ask in GitHub Discussions or Discord

## License

By contributing, you agree that your contributions will be licensed under the project's license.
