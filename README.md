# QUESTPIE Autopilot

Local-first workflow engine for coding agents.

Run structured software delivery loops from your terminal — plan, execute, validate, and monitor tasks driven by Claude Code or Codex.

## Install

Requires [Bun](https://bun.sh) >= 1.3.

```bash
bun add -g @questpie/autopilot
```

## Quick Start

```bash
# Open the terminal UI
qap

# Or set up a project first
qap project init --repo /path/to/your/repo
qap project import --repo /path/to/repo --prompts /path/to/prompts

# Check status from CLI
qap status
qap next

# Run a task
qap run-task TASK-001
```

## What It Does

Autopilot turns a backlog of tasks into a structured execution loop:

1. **Plan** — define tasks, dependencies, and prompts
2. **Execute** — agents (Claude Code, Codex) run tasks autonomously
3. **Validate** — primary and secondary validation per task
4. **Monitor** — watch progress from the TUI or CLI

### What You Get

- Task DAG with dependency tracking and readiness engine
- Autonomous execution loop with retry policies
- Claude Code and Codex CLI runners
- Per-task validation steps
- Local state persistence and event logging
- Terminal UI for real-time monitoring
- AI-assisted project setup

## Terminal UI

Run `qap` with no arguments to open the TUI.

```
┌── ■ QUESTPIE AUTOPILOT v0.1.0 ── PROJECT my-project ── 12T 3R 5D 0F ───┐
├─ PROJECT ─────────────┬─ READY ─────────────────────────────────────────┤
│ Name    my-project     │ ● TASK-007  [main] Implement auth module       │
│ ID      my-project     │ ● TASK-008  [main] Add API endpoints           │
│ Provider claude        │ ● TASK-012  [sidecar] Write integration tests  │
│ Repo    /path/to/repo  │                                                │
├─ LOG ─────────────────┼─ COMPLETED / FAILED ────────────────────────────┤
│ Project loaded         │ ✓ TASK-001  [gate] Initial setup               │
│ 12 tasks | 3 ready     │ ✓ TASK-002  [main] Database schema             │
│                        │ ✗ TASK-005  [main] Failed: timeout             │
├────────────────────────┴─────────────────────────────────────────────────┤
│ ▸ Type a command... (/help)  ESC clear · Ctrl+C exit                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### TUI Commands

| Command | Description |
|---------|-------------|
| `/init [path]` | Initialize new project from repo |
| `/project import [path]` | Import existing artifacts |
| `/project use <id>` | Switch active project |
| `/project list` | List all projects |
| `/run` | Run next ready task |
| `/run-task <id>` | Run a specific task |
| `/status` | Show task counts |
| `/refresh` | Reload project state |
| `/help` | Show help |

### Keyboard

| Key | Action |
|-----|--------|
| `Enter` | Submit command |
| `ESC` | Clear input / close help |
| `Ctrl+C` | Exit |
| `Ctrl+L` | Refresh state |

## CLI Reference

```
qap                           Open terminal UI (default)
qap ui                        Open terminal UI

qap project init              Initialize new project (AI-assisted)
qap project import            Import existing artifacts
qap project list              List all local projects
qap project use <id>          Set active project

qap status                    Show project status
qap next                      Show next ready task(s)
qap list                      List all tasks with states
qap show <id>                 Show task or epic details
qap run [--max <n>]           Run autonomous loop
qap run-next                  Run just the next ready task
qap run-task <id>             Run a specific task
qap prompt <id> --mode <m>    Render prompt for a task

qap start <task>              Mark task as in_progress
qap mark <task> <state>       Set task state
qap note <task> <text>        Add a note
qap validate readiness        Check dependency graph
qap report session            Show session changelog
qap report project            Show project summary

qap update                    Check for new version
qap update --check            Force check (bypass throttle)
qap update --apply            Download and install latest
```

### Options

| Option | Description |
|--------|-------------|
| `--config <path>` | Config file (auto-detected from active project) |
| `--dry-run` | Preview without side effects |
| `--no-sync` | Disable Linear tracker sync |
| `--max <n>` | Max tasks to run in loop |
| `--skip-validation` | Skip validation steps |

## Project Setup

### AI-Assisted (Primary Path)

Point Autopilot at your repo and let Claude generate the project workspace:

```bash
# From planning artifacts
qap project init \
  --repo /path/to/repo \
  --plan /path/to/plan.md \
  --provider claude

# From existing prompts
qap project import \
  --repo /path/to/repo \
  --prompts /path/to/prompt-directory \
  --provider claude
```

This creates a workspace at `~/.qap/projects/<project-id>/` with:

```
project.json           Project metadata
autopilot.config.ts    Execution config (tasks, epics, deps)
handoff.md             Setup summary
prompts/               Task prompt files
state.json             Runtime state
```

### Manual Config (Fallback)

Create `autopilot.config.ts` anywhere and pass it with `--config`:

```typescript
import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: {
    id: "my-project",
    name: "My Project",
    rootDir: ".",
  },
  execution: {
    mode: "autonomous",
    defaultProvider: "claude",
    defaultPermissionProfile: "elevated",
    stopOnFailure: true,
  },
  prompts: {
    templatesDir: "./prompts",
  },
  epics: [
    { id: "EPIC-001", title: "Core Features", track: "main" },
  ],
  tasks: [
    {
      id: "TASK-001",
      title: "Set up database schema",
      epicId: "EPIC-001",
      kind: "implementation",
      track: "gate",
      promptFile: "./prompts/001-db-schema.md",
      acceptanceCriteria: [
        "Migration runs without errors",
        "All tables created with correct types",
      ],
    },
    {
      id: "TASK-002",
      title: "Implement user API",
      epicId: "EPIC-001",
      kind: "implementation",
      track: "main",
      dependsOn: ["TASK-001"],
      promptFile: "./prompts/002-user-api.md",
    },
  ],
};

export default config;
```

## Task Model

### States

```
todo → ready → in_progress → implemented → validated_primary
  → validated_secondary → committed → done
```

Tasks can also be `blocked` or `failed`, with recovery paths back to `todo`/`ready`.

### Dependencies & Tracks

- `dependsOn` — tasks that must complete first
- `track` — priority: `gate` > `main` > `sidecar`
- `kind` — type: `implementation`, `validation`, `cleanup`, `migration`, `poc`

### Execution Loop

1. Compute ready queue from dependency graph
2. Select highest-priority task
3. Render prompt from template + context
4. Spawn agent (Claude Code or Codex CLI)
5. Capture result, run validation
6. Persist state, emit events, recompute queue

## Providers

| Provider | Binary | Permission Profiles |
|----------|--------|-------------------|
| Claude Code | `claude` | safe, elevated, max |
| Codex | `codex` | safe, elevated, max |

## Updates

Autopilot includes a simple, local-first self-update system.

### How It Works

- On startup, `qap` checks the npm registry for a newer version (at most once per 24 hours)
- If an update is available, a one-line banner is shown — never blocking
- Network failures are silently ignored

### Manual Update

```bash
# Check for updates
qap update

# Force check (ignores throttle)
qap update --check

# Apply update
qap update --apply

# Or update directly via Bun
bun add -g @questpie/autopilot@latest
```

### Auto-Update (Opt-In)

Enable automatic background updates in `~/.qap/settings.json`:

```json
{
  "update": {
    "checkOnStart": true,
    "autoUpdate": true,
    "checkIntervalHours": 24
  }
}
```

When `autoUpdate` is `true`, the update runs in the background and never kills the running process. On next startup you'll see:

```
Updated to x.y.z — restart qap to use the new version
```

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `update.checkOnStart` | `true` | Check for updates on CLI startup |
| `update.autoUpdate` | `false` | Auto-install updates in background |
| `update.checkIntervalHours` | `24` | Minimum hours between checks |

Update metadata is cached at `~/.qap/meta/update.json`.

## Philosophy

- **Local-first** — your workspace is the source of truth
- **Tracker-optional** — Linear sync is a mirror, not a dependency
- **Model-agnostic** — swap providers without changing config
- **Artifact-driven** — prompts, plans, and validation are files
- **Developer-controlled** — you decide what runs, when, and how

## Development

```bash
git clone https://github.com/questpie/questpie-autopilot.git
cd questpie-autopilot
bun install
bun test
bun run typecheck
bun run src/index.ts --help
```

## License

MIT
