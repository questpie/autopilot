import type { TuiState } from "./state.js";
import { loadTuiState } from "./state.js";
import { WorkspaceManager } from "../workspace/manager.js";
import { initProject, importProject } from "../ai/project-init.js";

// ── TUI Command Handler ─────────────────────────────────────

export interface CommandResult {
  newState?: TuiState;
  log?: string;
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export async function handleCommand(
  raw: string,
  currentState: TuiState
): Promise<CommandResult> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  // Strip leading / if present
  const cmd = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const parts = cmd.split(/\s+/);
  const action = parts[0]?.toLowerCase();

  switch (action) {
    case "project":
      return cmdProject(parts.slice(1), currentState);

    case "sessions":
      return cmdSessions(currentState);

    case "session":
      return cmdSession(parts.slice(1), currentState);

    case "run":
      return cmdRun(parts.slice(1), currentState);

    case "run-task":
      return cmdRunTask(parts.slice(1), currentState);

    case "status":
      return cmdStatus(currentState);

    case "refresh":
      return cmdRefresh();

    case "help":
      return {
        log: `[${timestamp()}] Commands: /project [init|import|list|use <id>], /sessions, /session show <id>, /run, /run-task <id>, /status, /refresh, /help`,
      };

    default:
      return {
        log: `[${timestamp()}] Unknown command: ${action}. Type /help for available commands.`,
      };
  }
}

async function cmdProject(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  const sub = args[0]?.toLowerCase();

  switch (sub) {
    case "init": {
      const repo = args[1] ?? process.cwd();
      const name = extractFlag(args, "--name");
      try {
        const { meta } = await initProject({ repo, name: name ?? undefined });
        const newState = await loadTuiState();
        return {
          newState: newState ?? undefined,
          log: `[${timestamp()}] Project "${meta.name}" initialized`,
        };
      } catch (err) {
        return {
          log: `[${timestamp()}] Init failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    case "import": {
      const repo = args[1] ?? process.cwd();
      const name = extractFlag(args, "--name");
      const prompts = extractFlag(args, "--prompts");
      try {
        const { meta } = await importProject({
          repo,
          name: name ?? undefined,
          prompts: prompts ?? undefined,
        });
        const newState = await loadTuiState();
        return {
          newState: newState ?? undefined,
          log: `[${timestamp()}] Project "${meta.name}" imported`,
        };
      } catch (err) {
        return {
          log: `[${timestamp()}] Import failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    case "use": {
      const id = args[1];
      if (!id) return { log: `[${timestamp()}] Usage: /project use <id>` };
      if (!currentState.workspace) {
        return { log: `[${timestamp()}] No workspace found` };
      }
      const ws = new WorkspaceManager();
      const exists = await ws.projectExists(currentState.workspace.id, id);
      if (!exists)
        return { log: `[${timestamp()}] Project "${id}" not found` };
      await ws.setActiveProject(currentState.workspace.id, id);
      const newState = await loadTuiState();
      return {
        newState: newState ?? undefined,
        log: `[${timestamp()}] Active project: ${id}`,
      };
    }

    case "list": {
      if (!currentState.workspace) {
        return { log: `[${timestamp()}] No workspace found` };
      }
      const ws = new WorkspaceManager();
      const projects = await ws.listProjects(currentState.workspace.id);
      if (projects.length === 0) {
        return { log: `[${timestamp()}] No projects found` };
      }
      const activeId = currentState.workspace.activeProject;
      const listing = projects
        .map(
          (p) =>
            `  ${p.id === activeId ? "● " : "  "}${p.id} (${p.provider})`
        )
        .join("\n");
      return {
        log: `[${timestamp()}] Projects:\n${listing}`,
      };
    }

    default:
      if (!sub) {
        // /project with no sub — show info or switch view
        return {
          log: `[${timestamp()}] Usage: /project [init|import|list|use <id>]`,
        };
      }
      return {
        log: `[${timestamp()}] Usage: /project [init|import|list|use <id>]`,
      };
  }
}

async function cmdSessions(
  currentState: TuiState
): Promise<CommandResult> {
  if (!currentState.workspace || !currentState.activeProject) {
    return { log: `[${timestamp()}] No active project` };
  }

  const ws = new WorkspaceManager();
  const sessions = await ws.listSessions(
    currentState.workspace.id,
    currentState.activeProject.id
  );

  if (sessions.length === 0) {
    return { log: `[${timestamp()}] No sessions yet` };
  }

  const listing = sessions
    .map(
      (s) =>
        `  ${s.id.slice(0, 8)} ${s.status.padEnd(10)} ${s.startedAt.slice(0, 19)} ${s.tasksCompleted}/${s.taskCount} tasks`
    )
    .join("\n");

  return {
    newState: { ...currentState, activeView: "sessions", sessions },
    log: `[${timestamp()}] Sessions:\n${listing}`,
  };
}

async function cmdSession(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  const sub = args[0]?.toLowerCase();

  if (sub === "show") {
    const id = args[1];
    if (!id) return { log: `[${timestamp()}] Usage: /session show <id>` };
    if (!currentState.workspace || !currentState.activeProject) {
      return { log: `[${timestamp()}] No active project` };
    }

    const ws = new WorkspaceManager();
    const session = await ws.loadSession(
      currentState.workspace.id,
      currentState.activeProject.id,
      id
    );

    if (!session) {
      return { log: `[${timestamp()}] Session "${id}" not found` };
    }

    return {
      log: `[${timestamp()}] Session ${session.id}\n  Status: ${session.status}\n  Started: ${session.startedAt}\n  Tasks: ${session.tasksCompleted}/${session.taskCount} completed, ${session.tasksFailed} failed`,
    };
  }

  return {
    log: `[${timestamp()}] Usage: /session show <id>`,
  };
}

async function cmdRun(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  if (!currentState.configPath) {
    return {
      log: `[${timestamp()}] No active config. Set up a project first.`,
    };
  }

  try {
    const { loadConfig } = await import("../config/loader.js");
    const { Runner } = await import("../core/runner.js");
    const config = await loadConfig(currentState.configPath);
    const runner = new Runner(config, {
      dryRun: args.includes("--dry-run"),
      maxTasks: 1,
    });

    runner.runNext().then(async () => {
      // State will refresh on next /refresh
    });

    return {
      log: `[${timestamp()}] Running next task...`,
    };
  } catch (err) {
    return {
      log: `[${timestamp()}] Run failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function cmdRunTask(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  const taskId = args[0];
  if (!taskId)
    return { log: `[${timestamp()}] Usage: /run-task <task-id>` };

  if (!currentState.configPath) {
    return {
      log: `[${timestamp()}] No active config. Set up a project first.`,
    };
  }

  try {
    const { loadConfig } = await import("../config/loader.js");
    const { Runner } = await import("../core/runner.js");
    const config = await loadConfig(currentState.configPath);
    const runner = new Runner(config, {
      dryRun: args.includes("--dry-run"),
      taskFilter: taskId,
    });

    runner.run().then(async () => {
      // State will refresh on next /refresh
    });

    return {
      log: `[${timestamp()}] Running task ${taskId}...`,
    };
  } catch (err) {
    return {
      log: `[${timestamp()}] Run failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function cmdStatus(currentState: TuiState): Promise<CommandResult> {
  const c = currentState.taskCounts;
  return {
    log: `[${timestamp()}] ${c.total} tasks | ${c.ready} ready | ${c.inProgress} in-progress | ${c.done} done | ${c.failed} failed | ${c.blocked} blocked`,
  };
}

async function cmdRefresh(): Promise<CommandResult> {
  const newState = await loadTuiState();
  return {
    newState: newState ?? undefined,
    log: `[${timestamp()}] Refreshed`,
  };
}

// ── Helpers ──

function extractFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1]! : null;
}
