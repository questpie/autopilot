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

## Version and Updates

| Command | Description |
|---------|-------------|
| `autopilot -v` | Show CLI version (short) |
| `autopilot version` | Show all package versions and remote orchestrator version |
| `autopilot version --offline` | Skip remote orchestrator check |
| `autopilot version --json` | Machine-readable output |
| `autopilot update check` | Check npm for latest stable version |
| `autopilot update check --channel canary` | Check canary channel |

See [Release Channels](./guides/release-channels.md) for the full channel model and compatibility policy.

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

## See Also

- [Deployment Variants](./guides/deployment-variants.md) — Architecture and topology
- [Docker Guide](./guides/docker.md) — Container configuration
- [Runtime Setup](./guides/runtime-setup.md) — Per-runtime install and auth for workers
- [VPS Dogfood Runbook](./guides/vps-dogfood-runbook.md) — End-to-end deployment walkthrough
- [Release Channels](./guides/release-channels.md) — Update, rollback, and channel management
