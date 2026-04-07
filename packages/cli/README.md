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

Set your OpenRouter API key via environment variable or `.env` file in your company directory:

```bash
OPENROUTER_API_KEY=sk-or-...
```

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

- [TanStack AI](https://tanstack.com/ai) with [OpenRouter](https://openrouter.ai) — supports Anthropic, OpenAI, Google, and more

## Links

- [Documentation](https://autopilot.questpie.com)
- [GitHub](https://github.com/questpie/autopilot)

## License

MIT
