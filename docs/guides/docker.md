# Docker Guide

## What the Docker image contains

The Docker image runs the **orchestrator** (control plane). It does **not** contain AI runtime adapters (Claude Code, Codex, OpenCode). Workers run on separate host machines with runtimes installed locally. The primary operator surfaces are CLI, API, MCP, and Telegram.

See [Deployment Variants](./deployment-variants.md) for the full topology guide.

## Quick Start

```bash
git clone https://github.com/questpie/autopilot
cd autopilot
cp .env.example .env
# Edit .env — set at least OPENROUTER_API_KEY
docker compose up
```

API: http://localhost:7778

## docker-compose.yml Explained

```yaml
services:
  orchestrator:
    image: questpie/autopilot:latest
    ports:
      - "7778:7778"                   # API server
      - "7777:7777"                   # Webhook server
    volumes:
      - ./company:/data/company       # Company files (persisted)
    environment:
      - COMPANY_ROOT=/data/company
      - OPENROUTER_API_KEY=...        # From .env file
      - ORCHESTRATOR_URL=...          # Public URL (for production)
```

## Volume Mounts

| Mount | Purpose |
|-------|---------|
| `./company:/data/company` | Company filesystem — config, knowledge, skills. SQLite DB at `.data/autopilot.db` inside this directory. |

The SQLite database lives inside the company directory at `.data/autopilot.db`. Since the company directory is mounted as a volume, the database persists across container restarts.

## Environment Variables

See `.env.example` for all options. Key ones:

| Variable | Required | Description |
|----------|----------|------------|
| `OPENROUTER_API_KEY` | Yes (or direct keys) | AI provider — one key for all models via OpenRouter |
| `ORCHESTRATOR_URL` | Production | Public base URL for notifications and preview links |
| `COMPANY_ROOT` | Docker | Path inside container (default: `/data/company`) |
| `AUTOPILOT_MASTER_KEY` | Production | Encryption key for shared secrets |
| `BETTER_AUTH_SECRET` | Production | Auth cookie/token secret |
| `CORS_ORIGIN` | Behind proxy | Allowed CORS origin (e.g. `https://autopilot.yourdomain.com`) |

## Connecting Workers

The Docker container is the orchestrator. Workers connect from host machines:

```bash
# On the orchestrator machine, create a join token:
docker compose exec orchestrator autopilot worker token create --description "My laptop"

# On the worker machine:
autopilot worker start --url http://<orchestrator-ip>:7778 --token <token>
```

Workers need runtime binaries (Claude Code, Codex, OpenCode) installed locally. See [Deployment Variants](./deployment-variants.md#runtime-adapter-setup) for setup instructions.

## Profiles

```bash
# Default: orchestrator only
docker compose up

# With auto-updates (Watchtower — opt-in, no silent self-mutation)
docker compose --profile auto-update up

# Development mode (hot reload, source mounted)
docker compose --profile dev up orchestrator-dev mailpit
```

## Updating

```bash
# Pull latest image
docker compose pull

# Restart with new version
docker compose up -d
```

Or enable auto-updates (opt-in):
```bash
docker compose --profile auto-update up -d
```

Release channels and version compatibility are not yet implemented (Pass 25.7).

## Backup

Your company is just files. Back up the company directory:

```bash
# Simple copy
cp -r ./company ./company-backup-$(date +%Y%m%d)

# Or tar
tar czf autopilot-backup-$(date +%Y%m%d).tar.gz ./company

# To S3/R2
aws s3 sync ./company s3://my-bucket/autopilot-backup/
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs orchestrator

# Common issues:
# - Missing API key (set OPENROUTER_API_KEY in .env)
# - Port already in use (change in .env)
# - Company directory permissions
```

### Database locked
```bash
# Only one orchestrator process can access the DB
docker compose down
docker compose up -d
```

### Reset everything
```bash
docker compose down
rm -rf ./company/.data  # Reset database (keeps config files)
docker compose up -d
```
