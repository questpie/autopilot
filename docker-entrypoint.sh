#!/bin/sh
set -e

COMPANY="${COMPANY_ROOT:-/data/company}"

# ── Bootstrap: ensure .autopilot/company.yaml exists ──────────────────────
# A fresh volume mount has no config. Scaffold the minimum viable company
# so the orchestrator can start without manual intervention.
if [ ! -f "$COMPANY/.autopilot/company.yaml" ]; then
  echo "[entrypoint] No .autopilot/company.yaml found in $COMPANY — bootstrapping..."
  bun packages/cli/bin/autopilot.ts bootstrap --yes --cwd "$COMPANY"
fi

# Start the orchestrator (API + webhooks).
# Uses --company-root to point at the mounted volume directly.
# Operator surfaces: CLI, API, MCP, Telegram, query.
exec bun packages/cli/bin/autopilot.ts server start --company-root "$COMPANY"
