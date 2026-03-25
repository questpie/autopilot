# CLI Reference

## Setup

| Command | Description |
|---------|------------|
| `autopilot init <name>` | Create a new company from template |
| `autopilot start` | Start orchestrator + dashboard |
| `autopilot status` | Company overview — agents, tasks, budget |

## Intent & Tasks

| Command | Description |
|---------|------------|
| `autopilot ask "<intent>"` | Send a high-level intent to the CEO agent |
| `autopilot tasks` | List all tasks |
| `autopilot tasks --status active` | Filter by status |
| `autopilot tasks --agent peter` | Filter by assigned agent |
| `autopilot inbox` | Show items waiting for your approval |
| `autopilot approve <id>` | Approve a task at a human gate |
| `autopilot reject <id> --reason "..."` | Reject with feedback |

## Agents

| Command | Description |
|---------|------------|
| `autopilot agents` | List all agents and their status |
| `autopilot attach <agent>` | Stream live session (like `kubectl logs -f`) |
| `autopilot chat <agent>` | Direct chat with a specific agent |

## Communication

| Command | Description |
|---------|------------|
| `autopilot channels` | List communication channels |
| `autopilot board` | View dashboard pins from agents |

## Knowledge & Secrets

| Command | Description |
|---------|------------|
| `autopilot knowledge` | Browse the knowledge base |
| `autopilot secrets` | Manage encrypted API keys |
| `autopilot secrets add <name>` | Add a new secret |

## Provider Authentication

| Command | Description |
|---------|------------|
| `autopilot provider login claude` | Authenticate with Claude subscription (recommended) |
| `autopilot provider login codex` | Authenticate with ChatGPT subscription |
| `autopilot provider status` | Show current provider auth status |
| `autopilot provider logout <name>` | Remove saved provider credentials |

Subscription login works on headless VPS — prints a URL to open on any device.
API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are an alternative to subscription login.

## Admin

| Command | Description |
|---------|------------|
| `autopilot auth` | Manage authentication (users, roles, tokens) |
| `autopilot git` | Git operations for company repo |
| `autopilot dashboard` | Open the web dashboard in browser |
| `autopilot artifacts` | List agent-created previews and files |

## Options

```bash
autopilot start --port 8000        # Custom webhook port (API = port+1)
autopilot ask --agent peter "..."  # Direct to specific agent (skip CEO)
autopilot attach peter --compact   # Compact output mode
autopilot tasks --json             # JSON output for scripting
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|------------|
| `ANTHROPIC_API_KEY` | — | Claude API key (alternative to `autopilot provider login claude`) |
| `OPENAI_API_KEY` | — | OpenAI API key (alternative to `autopilot provider login codex`) |
| `COMPANY_ROOT` | `./` | Company directory path |
| `PORT` | `7778` | API server port |
| `WEBHOOK_PORT` | `7777` | Webhook server port |
| `AUTOPILOT_MASTER_KEY` | auto | Encryption key for secrets |
| `NODE_ENV` | `development` | Environment mode |
