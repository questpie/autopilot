# QUESTPIE Autopilot — Local Development Guide

> Status: local engineering note, not canonical product/spec truth.
> Canonical Autopilot specs live in `/Users/drepkovsky/questpie/specs/autopilot/`.
> If this file conflicts with the external specs, prefer the external specs.

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

Opens at `http://localhost:3000`.
The dashboard talks directly to the orchestrator at `http://localhost:7778` during source dev unless you override `VITE_API_URL`.
SSR/server-side dashboard calls use `API_INTERNAL_URL` and default to `http://localhost:7778`.

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

Canonical rule: each runtime has one central env reader.

- dashboard: `apps/dashboard-v2/src/lib/env.ts`
- orchestrator: `packages/orchestrator/src/env.ts`
- mcp: `packages/mcp-server/src/env.ts`

Runtime application code should read env only through these modules.

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
| `API_INTERNAL_URL` | `http://localhost:7778` | Dashboard server-side internal URL to the orchestrator API |
| `VITE_API_URL` | unset | Optional browser API override. Source dev falls back to `http://localhost:7778` when unset. |

For local source dev, auth browser calls default to `http://localhost:7778`. For reverse-proxied deploys, leave `VITE_API_URL` unset so the browser uses the current origin.

### Auth + Routing Notes

- Local source dev is intentionally direct: dashboard browser calls go to `http://localhost:7778` by default.
- Reverse-proxied Docker/self-hosted deployments should leave `VITE_API_URL` unset so browser calls stay same-origin.
- SSR/server-side dashboard calls always use `API_INTERNAL_URL`.
- Browser-visible env must use `VITE_`. Server-only env must not.

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
- Changes to `team/schedules/*.yaml` are hot-reloaded
- Changes to `roles.yaml` are hot-reloaded
- Dashboard dev server (`bun dev`) has HMR

### Testing auth locally

```bash
# Create an owner account
bun packages/cli/bin/autopilot.ts auth setup

# Login
bun packages/cli/bin/autopilot.ts auth login
```

Important runtime details:

- Dashboard browser requests authenticate via Better Auth session cookies, not only Bearer headers.
- Email verification callbacks must point back to the dashboard origin, not the raw orchestrator origin.
- The local master key file (`secrets/.master-key`) is created automatically if missing.

### Common auth/setup gotchas

- Blank setup pane with console error about `fs/promises`:
  Browser code imported a server-only export chain. In particular, browser code must not depend on the root `@questpie/autopilot-spec` export if that re-exports Node-only modules. Use browser-safe subpath imports like `@questpie/autopilot-spec/schemas` and `@questpie/autopilot-spec/types`.
- `401 Unauthorized` on authenticated dashboard API calls:
  Check that the request is using the Better Auth session cookie and that orchestrator actor resolution accepts cookie-backed sessions.
- Verify-email link redirects to `http://localhost:7778/`:
  The auth call is missing an explicit dashboard `callbackURL`.
- `ENOENT ... secrets/.master-key` on authenticated requests:
  The local company root is missing the generated master key. Current behavior should auto-create it; if not, restart the orchestrator and inspect `packages/orchestrator/src/auth/crypto.ts`.
- Setup wizard opens on the wrong step after reload:
  Treat setup wizard state as ephemeral UI state. Do not persist step state across reloads unless hydration is explicitly handled.

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
