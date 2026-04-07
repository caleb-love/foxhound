# Foxhound

Compliance-grade observability platform for AI agent fleets — trace, replay, and audit every agent decision from tool call to business outcome.

## Architecture

```
foxhound/
├── apps/
│   ├── api/        # Fastify REST API (port 3001)
│   └── web/        # Next.js dashboard (port 3000)
├── packages/
│   ├── sdk/        # Client SDK for agents to emit traces
│   ├── types/      # Shared TypeScript types
│   └── db/         # Drizzle ORM schema + migrations (PostgreSQL)
├── .github/
│   └── workflows/  # GitHub Actions CI
└── docker-compose.dev.yml
```

**Stack:** TypeScript · Node 20 · pnpm workspaces · Turborepo · Fastify · Next.js · Drizzle ORM · PostgreSQL

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- Docker & Docker Compose

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Start dev services (PostgreSQL)
docker compose -f docker-compose.dev.yml up -d

# 3. Copy env files and configure
cp apps/api/.env.example apps/api/.env

# 4. Run database migrations
pnpm --filter @foxhound/db db:migrate

# 5. Start all apps in dev mode
pnpm dev
```

Apps will be available at:
- Web dashboard: http://localhost:3000
- API: http://localhost:3001
- Health check: http://localhost:3001/health

## Development

```bash
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm typecheck    # TypeScript check all packages
pnpm format       # Format with Prettier
```

## SDK Usage

```typescript
import { FoxhoundClient } from "@foxhound/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY,
  endpoint: "https://api.foxhound.ai",
});

const tracer = fox.startTrace({ agentId: "my-agent-id" });
const span = tracer.startSpan({ name: "tool_call:web_search", kind: "tool_call" });
span.setAttribute("query", "latest AI research").end();
await tracer.flush();
```

## CI

GitHub Actions runs on every push and PR to `main`:
1. Lint + format check
2. TypeScript typecheck
3. Tests
4. Build

See `.github/workflows/ci.yml`.
