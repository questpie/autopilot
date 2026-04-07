# Getting Started

## Current V1 Shape

Autopilot is currently operated through CLI, API, MCP, Telegram, and the query plane. The future operator app is deferred.

## Local Bootstrap

```bash
bun add -g @questpie/autopilot
mkdir my-company && cd my-company
autopilot bootstrap --yes
autopilot sync
autopilot start
```

`autopilot start` is a local convenience mode. It starts the orchestrator API plus a local worker with local-dev auth bypass. Do not expose it as a production topology.

Local endpoints:

```text
API:      http://localhost:7778
Webhooks: http://localhost:7777
Health:   http://localhost:7778/api/health
```

## Docker Bootstrap

```bash
git clone https://github.com/questpie/autopilot
cd autopilot
cp .env.example .env
# Set OPENROUTER_API_KEY or direct provider keys.
docker compose up -d
```

Docker runs the orchestrator only. Workers run separately on host machines with runtime binaries installed.

## Query Plane

```bash
autopilot query "Summarize the current workflows"
autopilot query "Suggest a safer deploy approval step" --allow-mutation
```

## Validate Setup

```bash
autopilot doctor --offline
autopilot doctor --url http://localhost:7778
```

Use `--offline` for filesystem/env/runtime checks without probing a running orchestrator.

## Worker Setup

```bash
# On orchestrator machine
autopilot worker token create --description "my laptop"

# On worker machine
bun add -g @questpie/autopilot
npm install -g @anthropics/claude-code
claude login
autopilot worker start --url http://ORCHESTRATOR_HOST:7778 --token <join-token>
```

For deployment variants, use [Deployment Variants](./guides/deployment-variants.md).
