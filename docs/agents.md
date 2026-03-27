# Agents & Roles

## The Team

| Agent | ID | Role | Primary Tools |
|-------|-----|------|--------------|
| **CEO** | `ceo` | Meta / Orchestrator | `task`, `message`, `pin`, `search` |
| **Sam** | `sam` | Strategist | `task`, `search`, `search_web`, `browse` |
| **Alex** | `alex` | Planner | `task`, `search`, `message`, `pin` |
| **Max** | `max` | Developer | `task`, `message`, `search`, `http` |
| **Riley** | `riley` | Reviewer | `task`, `search`, `message`, `pin` |
| **Ops** | `ops` | DevOps | `task`, `http`, `search_web`, `message` |
| **Morgan** | `morgan` | Marketing | `task`, `message`, `search_web`, `browse` |
| **Jordan** | `jordan` | Design | `task`, `pin`, `search_web`, `browse` |

## How Agents Work

Each agent is a Claude session with:
- **System prompt** — role definition, responsibilities, conventions
- **Tools** — subset of the 7 unified tools, scoped to their role
- **FS scope** — sandboxed access to relevant directories
- **Memory** — persistent facts, decisions, patterns from past sessions
- **Context** — role-scoped snapshot of current company state

## Unified Tool Set

All role configurations are built from these tool names:

- `task` — create/update/approve/reject/block/unblock tasks
- `message` — team channels, task channels, and direct messages
- `pin` — dashboard visibility for key outcomes
- `search` — internal search across tasks/messages/knowledge/pins
- `http` — external API calls (with secrets and allowlists)
- `search_web` — web search for discovery/research
- `browse` — fetch/extract web page content

## Customizing Agents

Edit `team/agents.yaml` in your company directory:

```yaml
agents:
  max:
    name: Max
    role: developer
    description: "Full-stack developer specializing in React and Node.js"
    model: claude-opus-4 # or claude-sonnet-4
    tools:
      - task
      - message
      - pin
      - search
      - http
      - search_web
      - browse
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
    description: "Data analyst - dashboards, queries, reports"
    model: claude-sonnet-4
    tools:
      - task
      - search
      - message
      - pin
      - http
    fs_scope:
      - "projects/**"
      - "knowledge/**"
      - "dashboard/**"
```

The orchestrator picks up changes automatically (filesystem watcher).

## Agent Memory

Each agent has persistent memory stored in `context/memory/{agent-id}/memory.yaml`. Memory is extracted automatically after each session using Claude Haiku. The agent's next session includes relevant memories in context.

## Context Layers

Each agent session receives 6 layers of context:

1. **Identity** (~2K tokens) — role, tools, team, conventions
2. **Company State** (~3-5K tokens) — current projects, tasks, team status
3. **Agent Memory** (~15-20K tokens) — persistent learnings from past sessions
4. **Task Context** (~8-15K tokens) — task details, specs, code context
5. **Skills Discovery** — available skills from `skills/` (20 built-in, agentskills.io format)
6. **Tool List** — available unified tools scoped to the agent's role

Total budget: ~100K tokens (half of the 200K context window).
