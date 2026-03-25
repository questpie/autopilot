# Agents & Roles

## The Team

| Agent | ID | Role | Primary Tools |
|-------|-----|------|--------------|
| **Sam** | `ceo` | CEO / Orchestrator | `create_task`, `send_message`, `ask_agent` |
| **Ivan** | `ivan` | Strategist | `search_knowledge`, `create_task`, `send_message` |
| **Adam** | `adam` | Planner | `create_task`, `write_file`, `search_knowledge` |
| **Peter** | `peter` | Developer | `write_file`, `git_commit`, `run_command`, `git_create_pr` |
| **Marek** | `marek` | Reviewer | `read_file`, `send_message`, `update_task` |
| **Viktor** | `ops` | DevOps | `run_command`, `write_file`, `http_request`, `git_commit` |
| **Sofia** | `marketer` | Marketing | `write_file`, `search_knowledge`, `send_message` |
| **Luna** | `designer` | Design | `write_file`, `search_knowledge`, `send_message` |

## How Agents Work

Each agent is a Claude session with:
- **System prompt** — role definition, responsibilities, conventions
- **Tools** — subset of the 13 primitives, scoped to their role
- **FS scope** — sandboxed access to relevant directories
- **Memory** — persistent facts, decisions, patterns from past sessions
- **Context** — role-scoped snapshot of current company state

## Customizing Agents

Edit `team/agents.yaml` in your company directory:

```yaml
agents:
  peter:
    name: Peter
    role: developer
    description: "Full-stack developer specializing in React and Node.js"
    model: claude-opus-4  # or claude-sonnet-4
    tools:
      - write_file
      - read_file
      - git_commit
      - git_create_branch
      - git_create_pr
      - run_command
      - install_tool
      - search_knowledge
      - send_message
    fs_scope:
      - "projects/**"
      - "knowledge/technical/**"
    schedule: []
```

## Adding Custom Agents

Add a new entry to `team/agents.yaml`:

```yaml
agents:
  # ... existing agents ...

  data-analyst:
    name: Dana
    role: analyst
    description: "Data analyst — builds dashboards, runs queries, generates reports"
    model: claude-sonnet-4
    tools:
      - read_file
      - write_file
      - run_command
      - search_knowledge
      - pin_to_board
      - send_message
    fs_scope:
      - "projects/**"
      - "knowledge/**"
      - "dashboard/**"
```

The orchestrator picks up changes automatically (filesystem watcher).

## Agent Memory

Each agent has persistent memory stored in `context/memory/{agent-id}/`:

```
context/memory/peter/
├── facts.yaml       # Things the agent has learned
├── decisions.yaml   # Past decisions and reasoning
├── patterns.yaml    # Recurring patterns observed
└── mistakes.yaml    # Past mistakes to avoid
```

Memory is extracted automatically after each session using Claude Haiku. The agent's next session includes relevant memories in context.

## Context Layers

Each agent session receives 4 layers of context:

1. **Identity** (~2K tokens) — role, tools, team, conventions
2. **Company State** (~3-5K tokens) — current projects, tasks, team status
3. **Memory** (~15-20K tokens) — persistent learnings
4. **Task Context** (~8-15K tokens) — task details, specs, code context

Total budget: ~100K tokens (half of the 200K context window).
