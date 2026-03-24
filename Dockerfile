# Dockerfile for QuestPie Autopilot orchestrator
# Build: docker build -t questpie/autopilot .
# Run:   docker run -p 7778:7778 -p 7777:7777 questpie/autopilot

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

# Copy workspace root manifests
COPY package.json bun.lock ./

# Copy all workspace package manifests for dependency resolution
COPY packages/cli/package.json packages/cli/package.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/spec/package.json packages/spec/package.json
COPY packages/agents/package.json packages/agents/package.json
COPY packages/avatar/package.json packages/avatar/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/docs/package.json apps/docs/package.json

RUN bun install --frozen-lockfile

# ── Stage 2: Build dashboard ─────────────────────────────────────────────────
# TODO: Dashboard uses TanStack Start (SSR) which requires its own runtime.
#       For now the dashboard is not bundled into the orchestrator image.
#       To add it later, either:
#       1. Switch dashboard to a static SPA build and serve via orchestrator
#       2. Add a separate dashboard container in docker-compose

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy root package.json (needed for workspace resolution)
COPY package.json ./

# Copy runtime packages
COPY packages/spec packages/spec
COPY packages/agents packages/agents
COPY packages/avatar packages/avatar
COPY packages/orchestrator packages/orchestrator
COPY packages/cli packages/cli

# Copy company templates (used by `autopilot init`)
COPY templates templates

# Environment defaults
ENV NODE_ENV=production
ENV PORT=7778
ENV WEBHOOK_PORT=7777

# Expose API and webhook ports
EXPOSE 7778 7777

# Health check against the API status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:7778/api/status').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["bun", "packages/cli/bin/autopilot.ts", "start"]
