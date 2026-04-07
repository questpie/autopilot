# CLI Reference

This reference tracks the current CLI/API-first surface. The future operator app is not part of the current deployment contract.

## Setup

| Command | Description |
|---------|-------------|
| `autopilot bootstrap` | Scaffold `.autopilot/` config for a company/project |
| `autopilot sync` | Sync generated compatibility files and pack materialization |
| `autopilot start` | Local convenience: orchestrator + local worker |
| `autopilot server start` | Start only the orchestrator API/webhook server |
| `autopilot worker start` | Start a worker and connect it to an orchestrator |

## Query And Tasks

| Command | Description |
|---------|-------------|
| `autopilot query "<prompt>"` | Run a taskless query/personal-assistant invocation |
| `autopilot query list` | List query records |
| `autopilot query show <id>` | Inspect a query record |
| `autopilot tasks` | List tasks |
| `autopilot runs` | List runs |
| `autopilot inbox` | Show pending operator items |
| `autopilot doctor` | Validate local setup, deployment env, runtimes, and orchestrator health |

Useful modes:

```bash
autopilot doctor --offline
autopilot doctor --url http://localhost:7778
autopilot doctor --require-runtime
autopilot doctor --json
```

## Workers

| Command | Description |
|---------|-------------|
| `autopilot worker token create` | Create a one-time join token |
| `autopilot worker list` | List registered workers |
| `autopilot worker start --url <url> --token <token>` | Enroll/start a worker |

## Admin

| Command | Description |
|---------|-------------|
| `autopilot auth setup` | Create the first owner account |
| `autopilot auth login` | Log in to an orchestrator |
| `autopilot secrets` | Manage shared secrets |
| `autopilot workflows` | Inspect workflow config |

## Environment

| Variable | Description |
|----------|-------------|
| `ORCHESTRATOR_URL` | Canonical base URL for rendered links |
| `AUTOPILOT_MASTER_KEY` | 64-character hex key for shared secret encryption |
| `BETTER_AUTH_SECRET` | Secret for Better Auth cookies/tokens in production |
| `PORT` | Orchestrator API port, default `7778` |
| `WEBHOOK_PORT` | Webhook port, default `7777` |
