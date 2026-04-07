# VPS Deployment Guide

This guide is intentionally thin. The canonical deployment docs are:

- [Deployment Variants](./deployment-variants.md)
- [Docker Guide](./docker.md)
- [Production deploy README](../../deploy/README.md)

## Default VPS Shape

Run the orchestrator API directly and connect workers from other machines.

```bash
ssh root@SERVER_IP
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

Default endpoints:

```text
API:      http://SERVER_IP:7778
Webhooks: http://SERVER_IP:7777
```

Connect a worker:

```bash
autopilot worker start --url http://SERVER_IP:7778 --token <join-token>
```

Workers need runtime binaries and auth on the worker host:

```bash
npm install -g @anthropics/claude-code
claude login
```

## Optional TLS

Use the `deploy/` stack with the optional reverse proxy profile:

```bash
cp deploy/.env.example deploy/.env
# Set DOMAIN, ORCHESTRATOR_URL, CORS_ORIGIN, and provider keys in deploy/.env.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env --profile reverse-proxy up -d
```

## Firewall

Minimum direct API setup:

```bash
ufw allow 22/tcp
ufw allow 7778/tcp
ufw allow 7777/tcp
ufw enable
```

If using the reverse-proxy profile:

```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

## Monitoring

```bash
docker compose ps
docker compose logs -f orchestrator
curl -s http://localhost:7778/api/health
```
