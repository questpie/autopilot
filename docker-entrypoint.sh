#!/bin/sh
set -e

# Start the orchestrator (API + webhooks) in background
bun packages/cli/bin/autopilot.ts start &
ORCHESTRATOR_PID=$!

# Start the dashboard in background (Nitro server)
node /app/apps/dashboard-v2/.output/server/index.mjs &
DASHBOARD_PID=$!

# Shutdown handler — forward signals to child processes
shutdown() {
  kill $ORCHESTRATOR_PID $DASHBOARD_PID 2>/dev/null || true
  wait $ORCHESTRATOR_PID $DASHBOARD_PID 2>/dev/null || true
  exit 0
}
trap shutdown SIGTERM SIGINT

# Wait for both processes (if either exits, shut down the other)
wait $ORCHESTRATOR_PID $DASHBOARD_PID 2>/dev/null || true
shutdown
