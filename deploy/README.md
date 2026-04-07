# VPS / Production Deployment

Orchestrator-only. Workers connect from other machines.
Operator surfaces: CLI, API, MCP, Telegram, query.

## Prerequisites

- Docker + Docker Compose
- An OpenRouter API key (https://openrouter.ai/keys) or direct provider keys

## Quick Start

```bash
# 1. Copy deploy files to your server
scp -r deploy/ user@server:~/autopilot/
ssh user@server
cd ~/autopilot

# 2. Configure
cp .env.example .env
nano .env  # Set OPENROUTER_API_KEY

# Generate production secrets
sed -i.bak "s|^AUTOPILOT_MASTER_KEY=.*|AUTOPILOT_MASTER_KEY=$(openssl rand -hex 32)|" .env
sed -i.bak "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -hex 32)|" .env
rm -f .env.bak

# 3. Launch
docker compose up -d

# 4. Create owner account
docker compose exec orchestrator autopilot auth setup
```

API: `http://SERVER_IP:7778`
Webhooks: `http://SERVER_IP:7777`

## Connecting Workers

```bash
# On the orchestrator (create a join token):
docker compose exec orchestrator autopilot worker token create --description "Andrej laptop"

# On the worker machine:
autopilot worker start \
  --url http://SERVER_IP:7778 \
  --token <join-token> \
  --name "andrej-laptop"
```

Workers need runtime binaries installed locally:
- Claude Code: `npm install -g @anthropics/claude-code && claude login`
- Codex: `npm install -g @openai/codex`
- OpenCode: `go install github.com/opencode-ai/opencode@latest`

See [Deployment Variants](../docs/guides/deployment-variants.md) for full topology details.

## Optional: TLS with Caddy

If you want automatic TLS, enable the reverse-proxy profile:

```bash
# Set domain in .env
echo "DOMAIN=autopilot.yourdomain.com" >> .env
echo "ORCHESTRATOR_URL=https://autopilot.yourdomain.com" >> .env
echo "CORS_ORIGIN=https://autopilot.yourdomain.com" >> .env

# Ensure DNS A record points to this server, ports 80/443 open

# Start with Caddy
docker compose --profile reverse-proxy up -d
```

Caddy auto-provisions TLS via Let's Encrypt. All traffic proxies to the orchestrator.

## Commands

```bash
# View logs
docker compose logs -f orchestrator

# Restart
docker compose restart

# Update to latest
docker compose pull && docker compose up -d

# Auto-update (pulls new images every 5 min — opt-in)
docker compose --profile auto-update up -d

# Backup
docker compose stop
tar -czf backup-$(date +%Y%m%d).tar.gz company/
docker compose start

# Shell into container
docker compose exec orchestrator sh

# List connected workers
docker compose exec orchestrator autopilot worker list

# Validate from an operator machine
autopilot doctor --url http://SERVER_IP:7778
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes (or direct keys) | - | AI provider key |
| `AUTOPILOT_MASTER_KEY` | Yes | - | Encryption key for shared secrets |
| `BETTER_AUTH_SECRET` | Yes | - | Auth cookie/token secret |
| `ORCHESTRATOR_URL` | Recommended | - | Public base URL for notifications/links |
| `COMPANY_ROOT` | No | `./company` | Company data directory on host |
| `CORS_ORIGIN` | If using proxy | - | Allowed CORS origin |
| `DOMAIN` | If using Caddy | - | Domain for TLS (reverse-proxy profile) |

## Troubleshooting

**Container won't start**: Check `docker compose logs orchestrator`. Common: missing API key, port conflict.

**Workers not connecting**: Verify orchestrator is reachable from the worker machine at the URL you passed to `--url`.

**Webhooks not received**: Ensure port 7777 is reachable. If using Caddy, add a webhook route to the Caddyfile.
