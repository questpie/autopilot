# Multi-stage Dockerfile for QUESTPIE Autopilot landing page
# Build from monorepo root: docker build -f apps/web/Dockerfile -t questpie/autopilot-docs .

# Stage 1: Prune monorepo
FROM oven/bun:1.3.0-alpine AS pruner
RUN bun add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @questpie/autopilot-web --docker

# Stage 2: Build
FROM oven/bun:1.3.0-alpine AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
WORKDIR /app/apps/web
RUN DISABLE_PRERENDER=true BASE_PATH=/autopilot/ bun run build

# Stage 3: Run
FROM oven/bun:1.3.0-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/serve.ts ./serve.ts
RUN bun add react react-dom @tanstack/react-router @tanstack/react-start
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["bun", "run", "serve.ts"]
