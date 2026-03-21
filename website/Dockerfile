# Dockerfile for autopilot docs
# Build: docker build -t questpie-autopilot-docs ./website
# Run: docker run -p 3000:3000 questpie-autopilot-docs

FROM oven/bun:1.3.0-alpine AS base

# Build stage
FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY source.config.ts ./
COPY content ./content

# Install deps (postinstall runs fumadocs-mdx)
RUN bun install --frozen-lockfile || bun install

# Copy source
COPY . .

# Build
ENV DISABLE_PRERENDER=true
RUN bun run build

# Production stage
FROM base AS runner
WORKDIR /app

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", ".output/server/index.mjs"]
