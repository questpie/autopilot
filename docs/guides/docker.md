# Docker Guide

## Quick Start

```bash
git clone https://github.com/questpie/autopilot
cd autopilot
cp .env.example .env
docker compose up

# Authenticate (choose one):
autopilot provider login claude   # Use Claude subscription (recommended, works headless)
# OR set ANTHROPIC_API_KEY in .env  # Use API key
```

Dashboard: http://localhost:3001
API: http://localhost:7778

## docker-compose.yml Explained

```yaml
services:
  orchestrator:
    build: .                          # Builds from Dockerfile
    ports:
      - "7778:7778"                   # API server
      - "7777:7777"                   # Webhook server
      - "3001:3001"                   # Dashboard
    volumes:
      - ./company:/data/company       # Company files (persisted)
    environment:
      - COMPANY_ROOT=/data/company    # Path inside container
      - ANTHROPIC_API_KEY=...         # From .env file
```

## Volume Mounts

| Mount | Purpose |
|-------|---------|
| `./company:/data/company` | Company filesystem — all YAML, tasks, knowledge |

The SQLite database lives inside the company directory at `.data/autopilot.db`. Since the company directory is mounted as a volume, the database persists across container restarts.

## Environment Variables

See `.env.example` for all options. Key ones:

| Variable | Required | Description |
|----------|----------|------------|
| `ANTHROPIC_API_KEY` | No | Claude API key (alternative to `autopilot provider login claude`) |
| `COMPANY_ROOT` | Docker only | Path inside container (default: `/data/company`) |
| `AUTOPILOT_MASTER_KEY` | Production | Encryption key for secrets |

## Profiles

```bash
# Default: orchestrator + dashboard
docker compose up

# With auto-updates (Watchtower)
docker compose --profile auto-update up

# Development mode (hot reload, source mounted)
docker compose --profile dev up
```

## Updating

```bash
# Pull latest image
docker compose pull

# Restart with new version
docker compose up -d
```

Or enable auto-updates:
```bash
docker compose --profile auto-update up -d
```

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
# - Missing authentication (run: autopilot provider login claude, or set ANTHROPIC_API_KEY)
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
rm -rf ./company/.data  # Reset database (keeps files)
docker compose up -d
```
