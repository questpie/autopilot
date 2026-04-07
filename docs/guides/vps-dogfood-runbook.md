# VPS Deployment Runbook

> Practical step-by-step for deploying Autopilot on a VPS with remote workers.
> Last updated: 2026-04-07 (Pass 25.8)

This runbook covers a real deployment: orchestrator on a VPS (Docker), worker on a separate machine, connected over public DNS, LAN, or private overlay. It uses only commands that exist today.

---

## Prerequisites

**Orchestrator machine (VPS):**
- Docker + Docker Compose
- An OpenRouter API key (or direct provider keys)
- A company directory (will be created on first boot if empty)

**Worker machine (laptop, CI server, etc.):**
- Bun runtime (`curl -fsSL https://bun.sh/install | bash`)
- Autopilot CLI: `bun add -g @questpie/autopilot@latest`
- At least one runtime binary: Claude Code, Codex, or OpenCode (see [Runtime Setup](./runtime-setup.md))
- Network access to the orchestrator URL

---

## Step 1: Start orchestrator on VPS

```bash
# On the VPS
mkdir -p ~/autopilot && cd ~/autopilot

# Option A: Clone repo (includes compose files)
git clone https://github.com/questpie/autopilot .
cp .env.example .env

# Option B: Use deploy directory only
scp -r deploy/ user@server:~/autopilot/
cd ~/autopilot/deploy
cp .env.example .env
```

Edit `.env` with required values:

```bash
# Required
OPENROUTER_API_KEY=sk-or-...

# Production secrets (generate fresh)
AUTOPILOT_MASTER_KEY=$(openssl rand -hex 32)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)

# Set to your server's reachable URL (see network section below)
ORCHESTRATOR_URL=http://YOUR_SERVER_IP:7778
```

Start the orchestrator:

```bash
docker compose up -d
```

---

## Step 2: Verify orchestrator health

```bash
# From the VPS itself
curl http://localhost:7778/api/health
# Expected: {"ok":true,"ts":"...","version":"2.0.0"}

# From an operator machine (replace with your URL)
curl http://YOUR_SERVER_IP:7778/api/health

# Using doctor
autopilot doctor --url http://YOUR_SERVER_IP:7778
```

If `/api/health` does not respond:
```bash
docker compose logs orchestrator    # Check for errors
docker compose ps                   # Check container status
```

---

## Step 3: Create owner account

```bash
docker compose exec orchestrator autopilot auth setup
```

This creates the first operator account. You will use these credentials to log in from worker machines and the CLI.

---

## Step 4: Create a worker join token

```bash
docker compose exec orchestrator autopilot worker token create --description "Andrej laptop"
```

Output:
```
Token ID:   tok_abc123
Secret:     wjt_xyz789...
Expires:    2026-04-08T12:00:00Z

Use: autopilot worker start --url <orchestrator> --token wjt_xyz789...
```

Save the token — you will use it on the worker machine.

---

## Step 5: Set up worker machine

On the worker machine:

```bash
# 1. Install Autopilot CLI
bun add -g @questpie/autopilot@latest

# 2. Install runtime (Claude Code example)
npm install -g @anthropic-ai/claude-code
claude login    # or export ANTHROPIC_API_KEY=sk-ant-...

# 3. Clone or access the company repo
git clone <your-company-repo>
cd <company-repo>

# 4. Validate setup
autopilot doctor --offline --require-runtime
```

See [Runtime Setup](./runtime-setup.md) for Codex and OpenCode instructions.

---

## Step 6: Start worker and enroll

```bash
autopilot worker start \
  --url http://YOUR_SERVER_IP:7778 \
  --token wjt_xyz789... \
  --name "andrej-laptop"
```

The worker enrolls with the orchestrator, stores a durable credential in `~/.autopilot/credentials.json`, and begins polling for runs.

On subsequent starts, the token is not needed:
```bash
autopilot worker start --url http://YOUR_SERVER_IP:7778 --name "andrej-laptop"
```

---

## Step 7: Verify worker is connected

```bash
# From the VPS
docker compose exec orchestrator autopilot worker list

# Expected: worker appears as "online" with runtime capabilities

# From an operator machine (after auth login)
autopilot worker list
```

---

## Step 8: Verify — run a task or query

### Quick query test

```bash
# From an operator machine (after auth login)
autopilot auth login --url http://YOUR_SERVER_IP:7778

# Run a taskless query
autopilot query "What files are in this repo?"

# Check query result
autopilot query list
```

### Task test

If you have workflows and agents configured (via `autopilot bootstrap`):

```bash
# Create a task
autopilot tasks create --title "Test task" --type feature

# Watch for it to be claimed and executed
autopilot runs

# Check inbox for any approval/review items
autopilot inbox
```

---

## Step 9: Observe logs

```bash
# Orchestrator logs (on VPS)
docker compose logs -f orchestrator

# Worker logs (on worker machine)
# Worker outputs to stdout — visible in the terminal where you ran `autopilot worker start`
```

Key things to watch for:
- Worker enrollment success: `[worker] enrolled as <name>`
- Run claims: `[worker] claimed run <id>`
- Run completions: `[worker] completed run <id>`
- Errors: any `[error]` or stack traces

---

## Step 10: Update and rollback

See [Release Channels](./release-channels.md) for the full guide. Quick reference:

```bash
# Check versions
autopilot version --url http://YOUR_SERVER_IP:7778

# Check for updates
autopilot update check

# Update orchestrator (back up first!)
cd ~/autopilot
tar czf autopilot-backup-$(date +%Y%m%d).tar.gz ./company
docker compose pull && docker compose up -d

# Update worker CLI
bun add -g @questpie/autopilot@latest

# Rollback: pin image tag in docker-compose.yml, then restart
```

---

## Network variants

The runbook above uses `http://YOUR_SERVER_IP:7778`. The exact URL depends on your network setup:

### Public DNS

```bash
# .env on VPS
ORCHESTRATOR_URL=https://autopilot.yourdomain.com

# Worker
autopilot worker start --url https://autopilot.yourdomain.com --token <token>
```

If you want TLS, enable the Caddy profile:
```bash
echo "DOMAIN=autopilot.yourdomain.com" >> .env
docker compose --profile reverse-proxy up -d
```

Requires: DNS A record pointing to the VPS, ports 80/443 open.

### LAN / private IP

```bash
# .env on VPS
ORCHESTRATOR_URL=http://192.168.1.100:7778

# Worker (on same LAN)
autopilot worker start --url http://192.168.1.100:7778 --token <token>
```

No DNS or TLS needed. Suitable for home lab or office network.

### Tailscale / private overlay

```bash
# .env on VPS (on Tailscale)
ORCHESTRATOR_URL=https://autopilot.my-tailnet.ts.net

# Worker (on same Tailnet)
autopilot worker start --url https://autopilot.my-tailnet.ts.net --token <token>
```

Benefits:
- Tailscale MagicDNS provides `*.ts.net` hostnames automatically
- Tailscale HTTPS provides free TLS certificates
- No port forwarding or public DNS records needed
- Works across NATs and firewalls

### WireGuard / ZeroTier

Same pattern — use the private mesh IP:

```bash
autopilot worker start --url http://10.0.0.1:7778 --token <token>
```

### ORCHESTRATOR_URL vs worker --url

These can differ:

| Setting | Purpose |
|---------|---------|
| `ORCHESTRATOR_URL` (env) | Public base URL for rendered links (notifications, previews) |
| `--url` (worker flag) | URL the worker uses to reach the orchestrator API |

Behind a reverse proxy, `ORCHESTRATOR_URL` is the public domain while a LAN worker connects directly.

---

## Multiple workers

Multiple workers can connect to the same orchestrator. Each claims runs independently.

```bash
# Machine A (Claude Code)
autopilot worker start --url http://orch:7778 --name "machine-a"

# Machine B (Codex)
autopilot worker start --url http://orch:7778 --name "machine-b" --runtime codex

# Machine C (OpenCode)
autopilot worker start --url http://orch:7778 --name "machine-c" --runtime opencode
```

Create a separate join token for each worker.

---

## Sharp edges and known limits

### No dashboard/app

There is no web dashboard or operator app. All interaction is via CLI, API, MCP, Telegram, or query. The future operator app is deferred until the primitive layers are proven.

### No automatic release pipeline

Stable and canary channels are defined but automated publishing is not yet active. Updates are manual `docker compose pull` or `bun add -g`.

### Worker runtime auth is machine-local

API keys and OAuth sessions for runtimes (Anthropic, OpenAI, etc.) are stored on the worker machine. The orchestrator does not manage runtime credentials.

### Worker sessions are not centralized

Runtime sessions (Claude Code sessions, Codex threads, OpenCode sessions) are stored on the worker machine. Session continuation only works when a run is claimed by the same worker that ran the previous session.

### Full runtime selection pipeline is not implemented

Workflow targeting constraints can already require a specific runtime on a run, but the full agent-level model/provider/variant routing pipeline is deferred to Pass 26.1. Workers advertise their runtime at enrollment; targeting tags can restrict which workers claim a given run.

### MCP auth hardening is later

The MCP server currently uses worker-level API keys. Per-user or per-session MCP auth is planned for Pass 26.2.

### Codex/OpenCode MCP config is replaced during runs

For Codex and OpenCode, the worker backs up existing project-level MCP config, replaces it with Autopilot's config during the run, and restores it on cleanup. This is a documented V1 tradeoff. Claude Code uses a CLI flag instead and does not modify project files.

### Schedules and standing orders are later

There is no scheduled task execution or standing orders yet. These are planned for Pass 26.3 and 26.4.

---

## Checklist

Use this as a quick reference when setting up a new deployment:

- [ ] VPS: Docker + Docker Compose installed
- [ ] VPS: `.env` configured (API key, secrets, orchestrator URL)
- [ ] VPS: `docker compose up -d` running
- [ ] VPS: `/api/health` responds with `ok: true`
- [ ] VPS: Owner account created (`autopilot auth setup`)
- [ ] VPS: Join token created for each worker
- [ ] Worker: Bun + Autopilot CLI installed
- [ ] Worker: Runtime binary installed and authenticated
- [ ] Worker: `autopilot doctor --offline --require-runtime` passes
- [ ] Worker: `autopilot worker start` enrolled successfully
- [ ] Worker: Appears in `autopilot worker list`
- [ ] Test: `autopilot query` returns a result
- [ ] Test: Orchestrator logs show run claimed and completed

---

## See also

- [Deployment Variants](./deployment-variants.md) — Architecture and topology overview
- [Docker Guide](./docker.md) — Container configuration details
- [Runtime Setup](./runtime-setup.md) — Per-runtime install and auth
- [Release Channels](./release-channels.md) — Update, rollback, and channel management
- [CLI Reference](../cli.md) — All available commands
