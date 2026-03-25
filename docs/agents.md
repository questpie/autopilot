# Agents & Roles

## The Team

| Agent | ID | Role | Primary Tools |
|-------|-----|------|--------------|
| **CEO** | `ceo` | Meta / Orchestrator | `create_task`, `send_message`, `ask_agent` |
| **Sam** | `sam` | Strategist | `search_knowledge`, `create_task`, `send_message` |
| **Alex** | `alex` | Planner | `create_task`, `search_knowledge`, `skill_request` |
| **Max** | `max` | Developer | `create_artifact`, `skill_request`, `search`, `http_request` |
| **Riley** | `riley` | Reviewer | `search_knowledge`, `send_message`, `update_task` |
| **Ops** | `ops` | DevOps | `http_request`, `create_artifact`, `skill_request` |
| **Morgan** | `morgan` | Marketing | `create_artifact`, `search_knowledge`, `send_message` |
| **Jordan** | `jordan` | Design | `create_artifact`, `search_knowledge`, `send_message` |

## How Agents Work

Each agent is a Claude session with:
- **System prompt** — role definition, responsibilities, conventions
- **Tools** — subset of the 14 primitives, scoped to their role
- **FS scope** — sandboxed access to relevant directories
- **Memory** — persistent facts, decisions, patterns from past sessions
- **Context** — role-scoped snapshot of current company state

## Customizing Agents

Edit `team/agents.yaml` in your company directory:

```yaml
agents:
  max:
    name: Max
    role: developer
    description: "Full-stack developer specializing in React and Node.js"
    model: claude-opus-4  # or claude-sonnet-4
    tools:
      - create_task
      - update_task
      - send_message
      - search_knowledge
      - create_artifact
      - skill_request
      - search
      - http_request
      - pin_to_board
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
      - search_knowledge
      - create_artifact
      - skill_request
      - search
      - pin_to_board
      - send_message
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
6. **Tool List** — available primitives scoped to the agent's role

Total budget: ~100K tokens (half of the 200K context window).
