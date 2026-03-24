# @questpie/autopilot

AI-native company operating system. Agents call structured primitives (not chat). Human approval gates keep you in control. Filesystem-native — one Bun process, one SQLite file.

## Install

```bash
bun add -g @questpie/autopilot
```

## Quick start

```bash
# Initialize a new company directory
autopilot init my-company

# Start the orchestrator
autopilot start

# Ask an agent to do something
autopilot ask "Draft a Q2 marketing plan"
```

## Configure

Set your LLM provider via environment variable or `.env` file in your company directory:

```bash
# Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Or OpenAI API key (for Codex SDK provider)
OPENAI_API_KEY=sk-...
```

The Claude Agent SDK provider also works with a Claude Max subscription — no API key needed.

## CLI commands

| Command | Description |
| --- | --- |
| `init` | Initialize a new company directory |
| `start` | Start the orchestrator |
| `ask` | Send a task to an agent |
| `status` | Show orchestrator status |
| `tasks` | List and manage tasks |
| `agents` | List and manage agents |
| `inbox` | View pending notifications |
| `attach` | Attach to a running agent session |
| `approve` | Approve a pending action |
| `reject` | Reject a pending action |
| `board` | Open the task board |
| `channels` | List and manage channels |
| `chat` | Send a message to a channel |
| `knowledge` | Manage the knowledge base |
| `artifacts` | List and manage artifacts |
| `dashboard` | Open the web dashboard |
| `auth` | Manage authentication |
| `git` | Git integration commands |
| `secrets` | Manage encrypted secrets |

## Agent providers

- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) — primary provider
- [Codex SDK](https://github.com/openai/codex) — OpenAI provider

## Links

- [Documentation](https://autopilot.questpie.com)
- [GitHub](https://github.com/questpie/autopilot)

## License

MIT
