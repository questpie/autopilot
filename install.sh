#!/bin/bash
set -euo pipefail

echo ""
echo "  QUESTPIE Autopilot — Self-Hosted Setup"
echo "  ======================================="
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

# Prompt for API key (optional — subscription login is recommended)
echo ""
echo "  Authentication options:"
echo "    1. Subscription login (recommended): autopilot provider login claude"
echo "       Works headless — prints a link to open on any device."
echo "    2. API key: enter below"
echo ""
read -rp "Anthropic API Key (leave empty for subscription login): " API_KEY
if [ -n "$API_KEY" ]; then
    sed -i "s|^# ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" .env
fi

# Generate master key
MASTER_KEY=$(openssl rand -base64 32)
sed -i "s|^# AUTOPILOT_MASTER_KEY=.*|AUTOPILOT_MASTER_KEY=$MASTER_KEY|" .env

# Create company directory
mkdir -p company

# Start
echo ""
echo "Starting QUESTPIE Autopilot..."
docker compose up -d

echo ""
echo "  QUESTPIE Autopilot is running!"
echo ""
echo "  Dashboard: http://localhost:3001"
echo "  API:       http://localhost:7778"
echo "  Webhooks:  http://localhost:7777"
echo ""
echo "  Logs:      docker compose logs -f"
echo "  Stop:      docker compose down"
echo ""
echo "  Next: open http://localhost:3001 in your browser"
echo ""
