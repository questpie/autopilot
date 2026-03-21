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
# Navigate to your repo
cd /path/to/your/repo

# Open the terminal UI — workspace is auto-detected from cwd
qap

# Or set up a project first
qap project init --name my-feature
qap project import --name v3-rollout --prompts ./prompts

# Check status from CLI
qap status
qap next
```

## Core Concepts

### Workspace

A workspace is a repo root. When you run `qap` from inside a repo, Autopilot resolves the workspace automatically from your current directory. You never need to manage workspace IDs manually.

One workspace can contain multiple projects.

### Project

A project is a specific initiative inside a workspace. For example, a repo `questpie` might have projects like `v3-rollout`, `admin-cleanup`, and `perf-audit` — each with its own task graph, prompts, state, and sessions.

Projects are created via `qap project init` or `qap project import`. If a workspace has exactly one project, it loads automatically. If there are multiple, the TUI shows a project picker.

### Session

A session is a run history record for a project. Each time Autopilot executes tasks, it creates a session that tracks what ran, what succeeded, and what failed.

## Default Flow

```
1. cd /path/to/repo
2. qap
3. Workspace auto-detected from cwd
4. If one project exists → loads automatically
5. If multiple projects → project picker shown
6. You're in the TUI — run tasks, check status, monitor progress
```

## CLI Overview

```
qap                           Open terminal UI (default)
qap ui                        Open terminal UI

Project Management:
  qap project init              Initialize new project (AI-assisted)
  qap project import            Import existing project artifacts
  qap project list              List projects in current workspace
  qap project use <id>          Set active project

Workspace Management:
  qap workspace add <path>      Register a repo as a workspace
  qap workspace list            List all known workspaces
  qap workspace show            Show current workspace info

Execution:
  qap status                    Show project status
  qap next                      Show next ready task(s)
  qap list                      List all tasks with states
  qap show <id>                 Show task or epic details
  qap run [--max <n>]           Run autonomous loop
  qap run-next                  Run just the next ready task
  qap run-task <id>             Run a specific task

Steering:
  qap note <task> <text>        Add a note to a task
  qap note show <task>          Show notes for a task
  qap steer project <text>      Add project steering note
  qap steer show                Show project steering notes

Options:
  --config <path>               Config file (auto-detected from workspace)
  --dry-run                     Preview without side effects
  --help                        Show help for any command
```

Every subcommand supports `--help` with no side effects:

```bash
qap project init --help
qap project import --help
```

## TUI Overview

Run `qap` to open the terminal UI.

```
┌── ■ QUESTPIE AUTOPILOT v0.2.0 │ WS my-repo │ PRJ v3-rollout ── 12T 3R 5D 0F ──┐
│ [PROJECT]  SESSIONS   LOGS   HELP                                                │
├─ PROJECT ─────────────┬─ READY ─────────────────────────────────────────────────-─┤
│ Name    v3-rollout     │ ● TASK-007  [main] Implement auth module                │
│ ID      v3-rollout     │ ● TASK-008  [main] Add API endpoints                    │
│ Provider claude        │ ● TASK-012  [sidecar] Write integration tests           │
│ Repo    /path/to/repo  │                                                         │
├─ LOG ─────────────────┼─ COMPLETED / FAILED ────────────────────────────────────-─┤
│ Project loaded         │ ✓ TASK-001  [gate] Initial setup                        │
│ 12 tasks | 3 ready     │ ✓ TASK-002  [main] Database schema                      │
│                        │ ✗ TASK-005  [main] Failed: timeout                      │
├────────────────────────┴──────────────────────────────────────────────────────────┤
│ ▸ Type a command... (/help)  ESC clear · Ctrl+C exit                             │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Tab Navigation

| Key | View |
|-----|------|
| `1` | Project — active project info + task panels |
| `2` | Sessions — run history for the active project |
| `3` | Logs — full log output |
| `4` | Help — command reference overlay |

### TUI Slash Commands

| Command | Description |
|---------|-------------|
| `/project init` | Initialize new project (AI-assisted) |
| `/project import` | Import existing artifacts |
| `/project use <id>` | Switch active project |
| `/project list` | List all projects |
| `/sessions` | Show session history |
| `/session show <id>` | Show session details |
| `/run` | Run next ready task |
| `/run-task <id>` | Run a specific task |
| `/status` | Show task counts |
| `/refresh` | Reload project state |
| `/help` | Toggle help overlay |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Submit command |
| `ESC` | Close help / clear input |
| `Ctrl+L` | Refresh state |
| `Ctrl+C` | Exit |

## AI-Assisted Setup

Project setup is AI-assisted by default. You point Autopilot at your repo and context, and a Claude agent generates the project workspace.

### Initialize from Planning Artifacts

```bash
qap project init \
  --repo /path/to/repo \
  --name my-feature \
  --plan /path/to/plan.md \
  --provider claude
```

### Import Existing Prompts

```bash
qap project import \
  --repo /path/to/repo \
  --name v3-rollout \
  --prompts /path/to/prompt-directory \
  --provider claude
```

The agent reads your repo structure and artifacts, then generates:
- `autopilot.config.ts` — task graph with dependencies
- `handoff.md` — setup summary
- prompt templates for each task

If the AI agent is unavailable, a fallback config is generated automatically.

The project name is always an explicit input (`--name`) or inferred from context — never hardcoded to the repo basename.

### Manual Config (Fallback)

Advanced users can hand-author `autopilot.config.ts` and pass it with `--config`:

```typescript
import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: { id: "my-project", name: "My Project", rootDir: "." },
  execution: {
    mode: "autonomous",
    defaultProvider: "claude",
    defaultPermissionProfile: "elevated",
  },
  prompts: { templatesDir: "./prompts" },
  epics: [{ id: "EPIC-001", title: "Core", track: "main" }],
  tasks: [
    {
      id: "TASK-001",
      title: "Set up schema",
      epicId: "EPIC-001",
      kind: "implementation",
      track: "gate",
      promptFile: "./prompts/001-schema.md",
    },
  ],
};

export default config;
```

## Local Storage Layout

All data is stored locally under `~/.qap/`:

```
~/.qap/
  workspaces/
    <workspace-id>/
      workspace.json                 # Workspace metadata + active project
      projects/
        <project-id>/
          project.json               # Project metadata
          autopilot.config.ts        # Task graph and execution config
          handoff.md                 # Setup summary
          prompts/                   # Task prompt templates
          planning/                  # Planning artifacts
          source/                    # Source references
          sessions/                  # Run history
            <session-id>.json
```

The workspace ID is derived from the repo root path. You never need to know or type it — `qap` resolves it from your current directory.

## Sessions

A session records the full lifecycle of a single execution run. Each `qap run` or `qap run-task` creates a session that tracks:

- `id`, `projectId`, `workspaceId` — identity
- `startedAt`, `finishedAt` — timing
- `status` — `running`, `completed`, `failed`, `aborted`
- `provider` — which agent provider was used
- `currentTaskId` — task currently being executed
- `lastEventAt` — timestamp of the most recent event
- `tasksCompleted`, `tasksFailed` — counters updated progressively
- `eventLogPath`, `changelogPath` — paths to detailed logs
- `notes` — session-level steering notes

Sessions are updated **progressively** during execution, not just at the end. The TUI polls session state every 3 seconds to show live progress.

## Steering Notes

Steering notes let you inject guidance into the AI agent's prompt at runtime. There are three levels:

### Project Steering

Persistent notes that apply to every task in the project.

```bash
qap steer project "Focus on type safety, avoid any-casts"
qap steer show
```

Stored in: `~/.qap/workspaces/<ws-id>/projects/<prj-id>/steering.md`

### Task Notes

Notes attached to a specific task. These are injected when that task runs.

```bash
qap note <task-id> "Use the new auth middleware from PR #42"
qap note show <task-id>
```

### Session Notes

Notes stored in the session record, injected during the current run.

### Steering Precedence

When rendering a prompt, steering notes are injected in this order:
1. Project steering (broadest)
2. Task notes (task-specific)
3. Session notes (run-specific)

All three are included in the `# Steering Notes` section of the execution prompt.

## Live Monitoring

The TUI auto-refreshes every 3 seconds during execution:

- **Execution panel** — shows current running session, progress, active task
- **Task counts** — ready, in-progress, done, failed
- **Recent events** — last event timestamp

No manual `/refresh` needed. The TUI detects running sessions automatically.

### TUI Steering Commands

| Command | Description |
|---------|-------------|
| `/note <task-id> <text>` | Add a note to a task |
| `/note show <task-id>` | Show notes for a task |
| `/steer project <text>` | Add project steering note |
| `/steer show` | Show project steering notes |

## Task Model

### States

```
todo → ready → in_progress → implemented → validated_primary
  → validated_secondary → committed → done
```

Tasks can also be `blocked` or `failed`, with recovery paths.

### Dependencies and Tracks

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

## Current Limitations

- TUI only — no web UI or remote cockpit
- CLI-based agent runners only — no SDK integration yet
- Session browser shows metadata — no full replay
- Planning workflow is thin — no multi-agent validation
- No distributed or multi-machine execution
- Linear sync is optional and one-directional

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
