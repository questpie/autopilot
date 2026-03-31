# Production Deployment

One-command deployment with automatic TLS.

## Prerequisites

- Docker + Docker Compose
- A domain pointing to your server (A record)
- Ports 80 and 443 open

## Quick Start

```bash
# 1. Copy deploy files to your server
scp -r deploy/ user@server:~/autopilot/
ssh user@server
cd ~/autopilot

# 2. Configure
cp .env.example .env
nano .env  # Set DOMAIN and ANTHROPIC_API_KEY

# 3. Initialize company data
docker compose run --rm autopilot autopilot init /data/company

# 4. Enable auth in company config
# Edit company/company.yaml:
#   settings:
#     auth:
#       enabled: true
#       cors_origin: "https://autopilot.yourdomain.com"

# 5. Launch
docker compose up -d

# 6. Create owner account
docker compose exec autopilot autopilot auth setup

# 7. Generate master key for secrets
echo "AUTOPILOT_MASTER_KEY=$(openssl rand -base64 32)" >> .env
docker compose up -d  # restart to pick up key
```

Your instance is live at `https://autopilot.yourdomain.com`.

## What's Included

| Service | Purpose |
|---------|---------|
| **caddy** | Reverse proxy + automatic TLS (Let's Encrypt) |
| **autopilot** | Orchestrator API + Dashboard (no ports exposed directly) |
| **watchtower** | Auto-update (optional, enable with `--profile auto-update`) |

## Routing

All traffic goes through Caddy on ports 80/443:

```
https://autopilot.yourdomain.com
  /api/*         → orchestrator (REST API, auth, SSE)
  /artifacts/*   → artifact proxy (auto-start, preview)
  /fs/*          → filesystem browser
  /streams/*     → durable stream proxy
  /*             → dashboard (React UI)
```

## Webhooks

To receive webhooks from GitHub, Slack, etc., uncomment the webhooks section in `Caddyfile`:

```
webhooks.autopilot.yourdomain.com {
    reverse_proxy autopilot:7777
}
```

Then add a DNS record for `webhooks.autopilot.yourdomain.com`.

## Commands

```bash
# View logs
docker compose logs -f autopilot

# Restart
docker compose restart

# Update to latest
docker compose pull && docker compose up -d

# Auto-update (pulls new images every 5 min)
docker compose --profile auto-update up -d

# Backup
docker compose stop
tar -czf backup-$(date +%Y%m%d).tar.gz company/
docker compose start

# Shell into container
docker compose exec autopilot sh
```

## Troubleshooting

**Caddy won't start**: Port 80/443 in use. Stop nginx/apache first.

**TLS not working**: Check DNS points to server. Caddy needs port 80 for ACME challenge.

**Login fails**: Ensure `cors_origin` in company.yaml matches your domain exactly (including `https://`).

**Webhooks not received**: Uncomment webhook section in Caddyfile, add DNS record, restart Caddy.
