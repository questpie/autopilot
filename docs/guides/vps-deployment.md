# VPS Deployment Guide

## Deploy to Hetzner Cloud (Recommended)

Hetzner offers the best price/performance for self-hosting.
[Sign up and get €20 free credits →](https://hetzner.cloud/?ref=Akyzglz8k22M)

### Recommended Servers

| Plan | Specs | Price |
|------|-------|-------|
| **CX22** | 2 vCPU, 4GB RAM, 40GB SSD | €4.35/mo |
| **CAX21** (ARM) | 4 vCPU, 8GB RAM, 80GB SSD | €7.49/mo |

ARM (CAX) recommended — better value, Bun runs great on ARM64.

### Setup

1. Create a Hetzner Cloud account
2. Create a server (Ubuntu 24.04, CAX21 recommended)
3. SSH into your server:

```bash
ssh root@YOUR_SERVER_IP
```

4. Run the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

Or manually:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Create directory
mkdir -p /opt/autopilot && cd /opt/autopilot

# Download files
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/.env.example -o .env

# Authenticate (choose one):
# Option A (recommended): autopilot provider login claude
#   Works headless — prints a URL to open on any device.
# Option B: Add ANTHROPIC_API_KEY to .env
nano .env

# Generate master key
echo "AUTOPILOT_MASTER_KEY=$(openssl rand -base64 32)" >> .env

# Start
docker compose up -d

# Check logs
docker compose logs -f
```

5. Access dashboard at `http://YOUR_SERVER_IP:3001`

## Add Domain + HTTPS

### Option A: Caddy (easiest)

```bash
apt install -y caddy

cat > /etc/caddy/Caddyfile << 'EOF'
autopilot.yourdomain.com {
    reverse_proxy localhost:3001

    handle /api/* {
        reverse_proxy localhost:7778
    }

    handle /hooks/* {
        reverse_proxy localhost:7777
    }
}
EOF

systemctl restart caddy
```

HTTPS is automatic with Caddy (Let's Encrypt).

### Option B: Cloudflare Tunnel (no open ports)

```bash
# Install cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create autopilot
cloudflared tunnel route dns autopilot autopilot.yourdomain.com

# Configure
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: autopilot.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# Run as service
cloudflared service install
```

## Other Providers

### DigitalOcean

```bash
# Create a $6/mo droplet (Ubuntu 24.04, 1GB RAM)
# SSH in, then same Docker flow:
curl -fsSL https://raw.githubusercontent.com/questpie/autopilot/main/install.sh | bash
```

### Fly.io

```bash
fly launch --dockerfile Dockerfile
# Authenticate with subscription login (recommended) or API key:
fly secrets set ANTHROPIC_API_KEY=sk-ant-...  # API key option
fly volumes create autopilot_data --size 1
```

### Railway

1. Connect your GitHub repo
2. Authenticate: set `ANTHROPIC_API_KEY` in environment variables, or use `autopilot provider login claude` after deploy
3. Deploy — Railway auto-detects the Dockerfile

### Local Machine

```bash
# macOS/Linux with Docker Desktop
docker compose up

# Or bare Bun (no Docker)
bun add -g @questpie/autopilot
autopilot init my-company && cd my-company
autopilot start
```

## Firewall

Only these ports need to be open:

| Port | Service | Required |
|------|---------|----------|
| 22 | SSH | Yes |
| 3001 | Dashboard | Yes (or behind reverse proxy) |
| 7778 | API | Optional (if accessed remotely) |
| 7777 | Webhooks | Optional (if using external webhooks) |
| 80/443 | HTTP/HTTPS | If using Caddy/reverse proxy |

```bash
# UFW example
ufw allow 22/tcp
ufw allow 3001/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Backup to S3/R2

```bash
# Install rclone
curl https://rclone.org/install.sh | bash

# Configure (follow prompts for S3 or R2)
rclone config

# Daily backup cron
echo "0 3 * * * rclone sync /opt/autopilot/company remote:autopilot-backup" | crontab -
```

## Monitoring (Optional)

Check container health:

```bash
# Health status
docker compose ps

# Resource usage
docker stats autopilot

# API health
curl -s http://localhost:7778/api/status | jq
```
