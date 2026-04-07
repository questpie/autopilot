# Dockerfile for QUESTPIE Autopilot — orchestrator-only
# Build: docker build -t questpie/autopilot .
# Run:   docker run -p 7778:7778 -p 7777:7777 -v ./company:/data/company questpie/autopilot
#
# Orchestrator (control plane) only. Workers run on host machines.
# Operator surfaces: CLI, API, MCP, Telegram, query.

# ── Stage 1: Install all dependencies ────────────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/spec/package.json packages/spec/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY apps/dashboard-v2/package.json apps/dashboard-v2/package.json
COPY apps/docs/package.json apps/docs/package.json

RUN bun install --frozen-lockfile --ignore-scripts

# ── Stage 2: Production dependencies only ───────────────────────────────────
FROM oven/bun:1.3-alpine AS prod-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/spec/package.json packages/spec/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY apps/dashboard-v2/package.json apps/dashboard-v2/package.json
COPY apps/docs/package.json apps/docs/package.json

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

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

# Runtime packages (source — Bun runs TS directly)
COPY packages/spec packages/spec
COPY packages/orchestrator packages/orchestrator
COPY packages/worker packages/worker
COPY packages/cli packages/cli
COPY packages/mcp-server packages/mcp-server

# The copied workspace packages may contain host-local node_modules symlinks.
# Remove them so Bun resolves dependencies from /app/node_modules in the image.
RUN find packages -name node_modules -type d -prune -exec rm -rf {} +

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=7778
ENV WEBHOOK_PORT=7777

EXPOSE 7778 7777

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:7778/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["/docker-entrypoint.sh"]
