#!/bin/bash
set -euo pipefail

echo ""
echo "  QUESTPIE Autopilot — Self-Hosted Setup"
echo "  ======================================="
echo ""
echo "  This installs the ORCHESTRATOR (control plane)."
echo "  Workers run separately on host machines with runtime binaries installed."
echo "  Primary operator surfaces: CLI, API, MCP, Telegram."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    curl -fsSL https://get.docker.com | sh
    echo "Docker installed."
    echo ""
fi

# Check docker compose
if ! docker compose version &> /dev/null; then
    echo "Error: docker compose plugin not available."
    echo "Install Docker with compose plugin: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create directory
INSTALL_DIR="${1:-/opt/autopilot}"
echo "Installing to: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR" && cd "$INSTALL_DIR"

# Download compose file and env example
REPO_RAW="https://raw.githubusercontent.com/questpie/autopilot/main"
curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/.env.example" -o .env

# Prompt for API key
echo ""
echo "  AI Provider setup:"
echo "    OpenRouter is the default (one key for all models)."
echo "    Get a key at: https://openrouter.ai/keys"
echo ""
read -rp "OpenRouter API Key (leave empty to configure later): " API_KEY
if [ -n "$API_KEY" ]; then
    sed -i.bak "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$API_KEY|" .env && rm -f .env.bak
fi

# Generate master key (64-char hex as required by crypto.ts)
MASTER_KEY=$(openssl rand -hex 32)
sed -i.bak "s|^# AUTOPILOT_MASTER_KEY=.*|AUTOPILOT_MASTER_KEY=$MASTER_KEY|" .env && rm -f .env.bak

# Generate Better Auth secret for cookies/tokens.
AUTH_SECRET=$(openssl rand -hex 32)
sed -i.bak "s|^# BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$AUTH_SECRET|" .env && rm -f .env.bak

# Create company directory — the Docker entrypoint auto-bootstraps
# .autopilot/company.yaml on first start if missing.
mkdir -p company

# Start
echo ""
echo "Starting QUESTPIE Autopilot..."
docker compose up -d

echo ""
echo "  QUESTPIE Autopilot is running!"
echo ""
echo "  API:       http://localhost:7778"
echo "  Health:    http://localhost:7778/api/health"
echo ""
echo "  Logs:      docker compose logs -f"
echo "  Stop:      docker compose down"
echo ""
echo "  ── What this runs ──"
echo "  The Docker container runs the ORCHESTRATOR (control plane)."
echo "  It does NOT include AI runtime adapters (Claude Code, Codex, OpenCode)."
echo ""
echo "  ── Next steps ──"
echo "  1. Connect a worker from this or another machine:"
echo ""
echo "     # On the worker machine, install the CLI:"
echo "     bun add -g @questpie/autopilot"
echo ""
echo "     # Create a join token (from orchestrator):"
echo "     docker compose exec orchestrator autopilot worker token create --description 'My laptop'"
echo ""
echo "     # Start the worker:"
echo "     autopilot worker start --url http://<orchestrator-ip>:7778 --token <token>"
echo ""
echo "  2. Workers need runtime binaries installed locally:"
echo "     - Claude Code: npm install -g @anthropics/claude-code"
echo "     - Codex:       npm install -g @openai/codex"
echo "     - OpenCode:    go install github.com/opencode-ai/opencode@latest"
echo ""
echo "  ── Important ──"
echo "  This is a LOCAL setup. For production, use deploy/ with Caddy + TLS."
echo "  See: docs/guides/deployment-variants.md"
echo ""
