# Dockerfile for QuestPie Autopilot (orchestrator + dashboard)
# Build: docker build -t questpie/autopilot .
# Run:   docker run -p 7778:7778 -p 7777:7777 -p 3001:3001 questpie/autopilot

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

# Install deps — skip postinstall scripts (fumadocs-mdx from docs app fails in Docker)
RUN bun install --frozen-lockfile --ignore-scripts

# ── Stage 2: Build dashboard ─────────────────────────────────────────────────
FROM deps AS dashboard-build
WORKDIR /app

# Copy config files needed for build
COPY tsconfig.base.json biome.json turbo.json ./

# Copy all source (dashboard imports types from other workspace packages)
COPY packages packages
COPY apps/dashboard apps/dashboard

# Build dashboard — output goes to apps/dashboard/dist/
RUN cd apps/dashboard && bun run build

# ── Stage 3: Production dependencies only ───────────────────────────────────
FROM oven/bun:1.3-alpine AS prod-deps
WORKDIR /app

# Copy manifests for production install
COPY package.json bun.lock ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/spec/package.json packages/spec/package.json
COPY packages/agents/package.json packages/agents/package.json
COPY packages/avatar/package.json packages/avatar/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/docs/package.json apps/docs/package.json

# Install production deps only, then prune large packages not needed at runtime
# (dashboard is pre-built, docs not included, onnxruntime for optional embeddings)
RUN bun install --frozen-lockfile --ignore-scripts --production && \
    rm -rf node_modules/onnxruntime-node \
           node_modules/onnxruntime-web \
           node_modules/fumadocs-* \
           node_modules/@rolldown \
           node_modules/@phosphor-icons \
           node_modules/lucide-react \
           node_modules/@img \
           node_modules/typescript \
           node_modules/@shikijs \
           node_modules/@babel \
           node_modules/@ts-morph \
           node_modules/@esbuild \
           node_modules/@base-ui \
           node_modules/drizzle-kit \
           node_modules/@huggingface

# ── Stage 4: Production runtime ──────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

# Copy production node_modules only
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy root package.json (needed for workspace resolution)
COPY package.json ./

# Copy runtime packages (source — Bun runs TS directly)
COPY packages/spec packages/spec
COPY packages/agents packages/agents
COPY packages/avatar packages/avatar
COPY packages/orchestrator packages/orchestrator
COPY packages/cli packages/cli

# Copy built dashboard (dist/ has client + server bundles, serve.ts is the entry)
COPY --from=dashboard-build /app/apps/dashboard/dist apps/dashboard/dist
COPY --from=dashboard-build /app/apps/dashboard/serve.ts apps/dashboard/serve.ts
COPY --from=dashboard-build /app/apps/dashboard/package.json apps/dashboard/package.json
COPY --from=dashboard-build /app/apps/dashboard/src apps/dashboard/src

# Copy company templates (used by `autopilot init`)
COPY templates templates

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment defaults
ENV NODE_ENV=production
ENV PORT=7778
ENV WEBHOOK_PORT=7777

# Expose API, webhook, and dashboard ports
EXPOSE 7778 7777 3001

# Health check against the API status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:7778/api/status').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["/docker-entrypoint.sh"]
