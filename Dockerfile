# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace config first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./

# Copy only the packages needed for the API server
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/billing/package.json packages/billing/
COPY packages/types/package.json packages/types/
COPY packages/notifications/package.json packages/notifications/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ apps/api/
COPY packages/db/ packages/db/
COPY packages/billing/ packages/billing/
COPY packages/types/ packages/types/
COPY packages/notifications/ packages/notifications/
COPY tsconfig.base.json ./

# Build all packages
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/billing/dist ./packages/billing/dist
COPY --from=builder /app/packages/billing/package.json ./packages/billing/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/notifications/dist ./packages/notifications/dist
COPY --from=builder /app/packages/notifications/package.json ./packages/notifications/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy drizzle migrations for runtime migration
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
