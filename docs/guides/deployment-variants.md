# Deployment Variants

> V1 deployment guide for QUESTPIE Autopilot.
> All variants compile to the same orchestrator/worker model.
> Last updated: 2026-04-06 (Pass 25.3)

---

## Architecture model

Every deployment variant is the same architecture:

```
┌─────────────────────────────┐
│  Orchestrator               │
│  (control plane)            │
│  - tasks, runs, events      │
│  - worker coordination      │
│  - provider/webhook handling │
│  - SQLite DB                │
│  - preview serving          │
└────────────┬────────────────┘
             │ HTTP
     ┌───────┼───────┐
     │       │       │
┌────┴──┐ ┌──┴───┐ ┌─┴─────┐
│Worker │ │Worker│ │Worker │
│laptop │ │VPS   │ │CI     │
└───────┘ └──────┘ └───────┘
```

- **Orchestrator**: state machine, coordination, API. Runs as a Bun process or Docker container. Primary operator surfaces: CLI, API, MCP, Telegram.
- **Worker**: claims and executes runs using runtime adapters (Claude Code, Codex, OpenCode). Runs on host machines with runtime binaries installed.
- **There is no shared filesystem between orchestrator and remote workers.** Workers communicate over HTTP APIs only.

The deployment variant determines _where_ these processes run and _how_ they connect. The semantics do not change.

---

## Variant 1: Local all-in-one

One machine runs orchestrator + worker in a single process tree.

```bash
# Prerequisites: Bun, a runtime binary (e.g. Claude Code)
autopilot start
```

This boots `autopilot server start` + `autopilot worker start` together with a local dev auth bypass.

**Good for:**
- Development and testing
- Proving the full workflow loop
- Solo dogfood

**Caveats:**
- Local dev auth bypass is active — not production security
- Previews and state only survive while the process runs
- This is convenience, not the canonical topology

**API:** http://localhost:7778

---

## Variant 2: Docker self-host (orchestrator)

The Docker image runs the **orchestrator** (control plane). Workers run separately.

### Quick start (local Docker)

```bash
# Clone or download
git clone https://github.com/questpie/autopilot
cd autopilot

# Configure
cp .env.example .env
# Edit .env — set at least OPENROUTER_API_KEY

# Start
docker compose up -d

# API: http://localhost:7778
```

Or use the one-line install script:

```bash
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

### Production deploy

The default production setup exposes the orchestrator on direct ports (7778 for API, 7777 for webhooks). No reverse proxy is required.

```bash
# On your VPS
scp -r deploy/ user@server:~/autopilot/
ssh user@server
cd ~/autopilot

cp .env.example .env
# Edit .env — set ORCHESTRATOR_URL and OPENROUTER_API_KEY

docker compose up -d

# Create owner account
docker compose exec autopilot autopilot auth setup
```

Your instance is live at `http://SERVER_IP:7778`.

#### Optional: TLS via Caddy

If you need automatic TLS, use the `reverse-proxy` profile in the `deploy/` directory:

```bash
docker compose --profile reverse-proxy up -d
```

This adds a Caddy container that terminates TLS via Let's Encrypt. Set `DOMAIN` in `.env` and your instance is available at `https://autopilot.yourdomain.com`.

### What runs in the container

| Process | Purpose |
|---------|---------|
| `autopilot server start` | Orchestrator API + webhook server |

### What does NOT run in the container

| Missing | Why |
|---------|-----|
| AI runtime adapters | Claude Code, Codex, OpenCode need host-level install + auth |
| Worker execution | Workers need filesystem access to repos and runtime binaries |
| Runtime sessions | Claude sessions are machine-local state |

**The Docker container is the control plane. Workers run on separate machines.**

### Volume mount

```yaml
volumes:
  - ./company:/data/company   # Company data + SQLite DB at .data/autopilot.db
```

### Key environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes (or direct keys) | AI provider — one key for all models |
| `ORCHESTRATOR_URL` | Production | Public base URL (e.g. `https://autopilot.yourdomain.com`) |
| `AUTOPILOT_MASTER_KEY` | Production | Encryption key for shared secrets |
| `BETTER_AUTH_SECRET` | Production | Auth cookie/token secret |
| `CORS_ORIGIN` | Behind proxy | Allowed CORS origin |
| `COMPANY_ROOT` | Docker | Path inside container (default: `/data/company`) |

See `.env.example` for the full list.

---

## Variant 3: Split host (orchestrator + remote workers)

This is the primary production topology. The orchestrator runs on a VPS or server, and workers run on other machines.

### Step 1: Start orchestrator

On your VPS or server:

```bash
# Option A: Docker (recommended)
cd ~/autopilot
docker compose up -d

# Option B: Bare metal
autopilot server start
```

### Step 2: Create a join token

```bash
# From the orchestrator machine (or via API)
autopilot worker token create --description "Andrej laptop"

# Output:
#   Token ID:   tok_abc123
#   Secret:     wjt_xyz789...
#   Expires:    2026-04-07T12:00:00Z
#
#   Use: autopilot worker start --url <orchestrator> --token wjt_xyz789...
```

### Step 3: Start worker on another machine

```bash
# On the worker machine
# 1. Clone or have access to the company repo
git clone <your-company-repo>
cd <company-repo>

# 2. Install runtime binary
npm install -g @anthropics/claude-code
claude login  # or set ANTHROPIC_API_KEY

# 3. Start worker
autopilot worker start \
  --url https://autopilot.yourdomain.com \
  --token wjt_xyz789... \
  --name "andrej-laptop"
```

The worker enrolls, stores a durable credential in `~/.autopilot/credentials.json`, and begins claiming runs.

### Step 4: Verify

```bash
# On orchestrator
autopilot worker list

# Expected: worker appears as "online" with runtime capabilities
```

### URL patterns

The `--url` flag accepts any reachable URL:

| Network | Example |
|---------|---------|
| Public DNS | `https://autopilot.yourdomain.com` |
| LAN IP | `http://192.168.1.100:7778` |
| Tailscale | `https://autopilot.my-tailnet.ts.net` |
| Reverse proxy | `https://autopilot.yourdomain.com` (behind Caddy/nginx) |

### Multiple workers

Multiple workers can connect to the same orchestrator. Each claims runs independently based on capabilities.

```bash
# Machine A (has repo X access, runs Claude Code)
autopilot worker start --url https://orch.example.com --name "machine-a"

# Machine B (has repo Y access, runs Codex)
autopilot worker start --url https://orch.example.com --name "machine-b" --runtime codex
```

### ORCHESTRATOR_URL vs worker --url

These can differ:

| Variable | Purpose |
|----------|---------|
| `ORCHESTRATOR_URL` (env) | Public base URL for rendered links (notifications, previews) |
| `--url` (worker flag) | URL the worker uses to connect to the orchestrator API |

If the orchestrator is behind a reverse proxy, `ORCHESTRATOR_URL` is the public domain (e.g. `https://autopilot.example.com`), while a worker on the same LAN might connect via `http://192.168.1.100:7778` directly.

---

## Variant 4: Private overlay (Tailscale / WireGuard / ZeroTier)

Same as split host, but connectivity is over a private mesh network. No public DNS or port forwarding required.

### Setup

```bash
# On orchestrator machine (on Tailscale)
autopilot server start

# On worker machines (on the same Tailnet)
autopilot worker start --url https://autopilot.my-tailnet.ts.net
```

### Tailscale-specific notes

- Tailscale MagicDNS provides `*.ts.net` hostnames automatically
- Tailscale HTTPS provides free TLS certificates for `.ts.net` domains
- No port forwarding, no public DNS records needed
- Set `ORCHESTRATOR_URL=https://autopilot.my-tailnet.ts.net` for notification links

### WireGuard / ZeroTier

Same pattern — use the private IP or hostname as the orchestrator URL:

```bash
# WireGuard
autopilot worker start --url http://10.0.0.1:7778

# ZeroTier
autopilot worker start --url http://10.147.20.1:7778
```

### When to use private overlay

- You do not want to expose the orchestrator to the public internet
- Your team is already on a shared Tailnet or VPN
- You want zero-config TLS without managing certificates
- You want private DNS without registering public domains

---

## Runtime adapter setup

Workers need runtime binaries installed and authenticated on the host machine. The Docker orchestrator container does **not** include these.

### Claude Code (default runtime)

```bash
npm install -g @anthropics/claude-code

# Authenticate (pick one):
claude login                          # Interactive OAuth
export ANTHROPIC_API_KEY=sk-ant-...   # API key
```

### Codex

```bash
npm install -g @openai/codex

# Authenticate:
export OPENAI_API_KEY=sk-...
```

### OpenCode

```bash
go install github.com/opencode-ai/opencode@latest

# Authenticate:
export ANTHROPIC_API_KEY=sk-ant-...   # or configure per OpenCode docs
```

### V1 caveats

- Runtime binaries must be installed on each worker machine independently
- Runtime authentication (API keys, OAuth sessions) is machine-local
- MCP config for Codex/OpenCode uses backup/restore during runs (documented V1 tradeoff)
- Full runtime setup tutorials are a follow-up deliverable

---

## Release and update story

### Current (V1)

- **Install:** Clone repo + `docker compose up`, or `install.sh`
- **Update:** `docker compose pull && docker compose up -d`
- **Auto-update:** Optional Watchtower profile (`docker compose --profile auto-update up -d`)
- **Rollback:** Pin image tag in docker-compose.yml, or `docker compose pull questpie/autopilot:<tag>`

### Not yet implemented (Pass 25.7)

- Stable / canary release channels
- CLI version check and upgrade commands
- Orchestrator / worker version compatibility validation
- Operator-controlled update policy
- Silent autoupdate is explicitly **not** a V1 default

Auto-update via Watchtower is opt-in. There is no silent background self-mutation.

---

## Security notes

### Local all-in-one

- Local dev auth bypass is active (`X-Local-Dev` header)
- Acceptable for solo development on localhost
- **Do not expose localhost mode to a network**

### Docker / VPS / production

- Set `AUTOPILOT_MASTER_KEY` for shared secret encryption
- Set `BETTER_AUTH_SECRET` for auth cookies/tokens
- Set `CORS_ORIGIN` to your domain
- Use TLS if exposed publicly (optional Caddy profile in `deploy/`, or Tailscale HTTPS)
- Worker enrollment uses one-time join tokens
- Enrolled workers authenticate via durable machine credentials
- Local dev bypass is **not active** in Docker mode

### Private overlay

- TLS is still recommended (Tailscale HTTPS provides this for free)
- Worker enrollment and auth work identically to public deployments
- Private DNS does not change the security model — it changes the transport

---

## Summary matrix

| Variant | Orchestrator | Workers | Network | TLS | Auth |
|---------|-------------|---------|---------|-----|------|
| Local all-in-one | localhost | same process | loopback | none | dev bypass |
| Docker self-host | container | host machines | LAN/public | optional (Caddy profile) | join tokens |
| Split host | VPS/container | remote hosts | public DNS | optional (Caddy/nginx) | join tokens |
| Private overlay | VPS/container | remote hosts | Tailscale/VPN | Tailscale HTTPS | join tokens |

All variants use the same orchestrator/worker primitives. Packaging shape differs; semantics do not.
