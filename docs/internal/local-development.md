# QUESTPIE Autopilot — Local Development Guide

> Internal reference for developing the Autopilot monorepo.
> Last updated: 2026-03-24

---

## 1. Prerequisites

- **Bun 1.3+** — `curl -fsSL https://bun.sh/install | bash`
- **Git** — for company state versioning and repo operations
- **Anthropic API key** — for running agents locally

## 2. Setup

```bash
git clone git@github.com:questpie/questpie-autopilot.git
cd questpie-autopilot
bun install
```

## 3. Running the Orchestrator

The orchestrator needs a company directory to run against. Create one first:

```bash
# Scaffold a test company (from monorepo root)
bun packages/cli/bin/autopilot.ts init test-company
cd test-company

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the orchestrator
bun ../packages/cli/bin/autopilot.ts start
```

This starts the watcher, scheduler, webhook server (:7777), and API server (:7778).

### Using the installed CLI

If you have the CLI installed globally (`bun add -g @questpie/autopilot`), it uses the published package. For local development, always use `bun packages/cli/bin/autopilot.ts` to run against your local source.

## 4. Running the Dashboard

```bash
cd apps/dashboard-v2
bun dev
```

Opens at `http://localhost:3000`. Connects to the orchestrator API at `http://localhost:7778`.

## 5. Running the Docs Site

```bash
cd apps/docs
bun dev
```

Opens at `http://localhost:3000`. Uses Fumadocs with MDX content from `apps/docs/content/`.

## 6. Running the Landing Page

```bash
cd apps/web
bun dev
```

Opens at `http://localhost:3000`. TanStack Start SSR app.

## 7. Running Tests

```bash
# All tests
bun test

# Specific test file
bun test packages/orchestrator/tests/server.test.ts

# Specific package
bun test packages/orchestrator/

# Watch mode
bun test --watch packages/orchestrator/
```

Tests use Bun's built-in test runner. Orchestrator tests create temporary company directories and spin up real orchestrator instances.

## 8. Testing Webhooks Locally

External services (GitHub, Slack, Linear) need to reach your local webhook server. Use `cloudflared` to create a tunnel:

```bash
# Install (macOS)
brew install cloudflared

# Create a tunnel to the webhook port
cloudflared tunnel --url http://localhost:7777
```

This prints a public URL like `https://random-words.trycloudflare.com`. Use this URL as the webhook endpoint in the external service.

The tunnel stays open as long as the command runs. No account needed for quick tunnels.

## 9. Environment Setup

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for agent sessions |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7778` | API server port |
| `WEBHOOK_PORT` | `7777` | Webhook server port |
| `NODE_ENV` | `development` | Set `production` for secure cookies |
| `AUTOPILOT_MASTER_KEY` | Auto-generated | Secrets encryption key |

For local dev, auth is always enabled by default.

## 10. Monorepo Structure

```
questpie-autopilot/
├── apps/
│   ├── dashboard-v2/     # Living Dashboard (Vite + React + TanStack Start)
│   ├── docs/             # Public documentation (Fumadocs)
│   └── web/              # Landing page (TanStack Start)
├── packages/
│   ├── cli/              # CLI tool (@questpie/autopilot)
│   ├── orchestrator/     # Core runtime (server, agents, workflows)
│   └── spec/             # TypeScript types and YAML schemas
├── templates/
│   └── solo-dev-shop/    # Default company template
└── docs/
    └── internal/         # Internal docs (not published)
```

## 11. Debugging Tips

### Orchestrator won't start

- Check that you're in a valid company directory (has `company.yaml`)
- Check port conflicts: `lsof -i :7777` and `lsof -i :7778`
- Run with verbose output: logs go to stdout by default

### Agent sessions failing

- Verify `ANTHROPIC_API_KEY` is set and valid
- Check `logs/sessions/` for session JSONL files with error details
- Check budget limits in `company.yaml` — `daily_token_limit` may be exceeded

### SQLite database issues

- Delete `.data/autopilot.db` — it's fully rebuilt on next startup from YAML/Markdown files
- The database is not precious; it's a cache/index of the filesystem

### Hot reload

- The orchestrator watches `tasks/`, `comms/`, `dashboard/`, and `team/` directories
- Changes to `company.yaml` require a restart
- Changes to `schedules.yaml` are hot-reloaded
- Changes to `roles.yaml` are hot-reloaded
- Dashboard dev server (`bun dev`) has HMR

### Testing auth locally

```bash
# Create an owner account
bun packages/cli/bin/autopilot.ts auth setup

# Login
bun packages/cli/bin/autopilot.ts auth login
```

## 12. Common Tasks

### Add a new CLI command

1. Create `packages/cli/src/commands/your-command.ts`
2. Import it in `packages/cli/src/commands/index.ts`
3. Follow the pattern in existing commands (Commander.js)

### Add a new API route

1. Add route in `packages/orchestrator/src/api/` (Hono router)
2. Register in `packages/orchestrator/src/api/index.ts`

### Add a new test

1. Create `packages/orchestrator/tests/your-feature.test.ts`
2. Use `describe`/`test`/`expect` from Bun's test runner
3. See `packages/orchestrator/tests/server.test.ts` for orchestrator test patterns
