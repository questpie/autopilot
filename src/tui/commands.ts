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
    case "init":
      return cmdInit(parts.slice(1));

    case "project":
      return cmdProject(parts.slice(1), currentState);

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
        log: `[${timestamp()}] Commands: /init, /project import|use|list, /run, /run-task <id>, /status, /refresh, /help`,
      };

    default:
      return {
        log: `[${timestamp()}] Unknown command: ${action}. Type /help for available commands.`,
      };
  }
}

async function cmdInit(args: string[]): Promise<CommandResult> {
  const repo = args[0] ?? process.cwd();
  try {
    const meta = await initProject({ repo });
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

async function cmdProject(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  const sub = args[0]?.toLowerCase();

  switch (sub) {
    case "import": {
      const repo = args[1] ?? process.cwd();
      const prompts = args.find((a, i) => args[i - 1] === "--prompts");
      try {
        const meta = await importProject({ repo, prompts });
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
      const ws = new WorkspaceManager();
      const exists = await ws.projectExists(id);
      if (!exists)
        return { log: `[${timestamp()}] Project "${id}" not found` };
      await ws.setActiveProject(id);
      const newState = await loadTuiState();
      return {
        newState: newState ?? undefined,
        log: `[${timestamp()}] Active project: ${id}`,
      };
    }

    case "list": {
      const ws = new WorkspaceManager();
      const projects = await ws.listProjects();
      if (projects.length === 0) {
        return { log: `[${timestamp()}] No projects found` };
      }
      const activeId = await ws.getActiveProjectId();
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
      return {
        log: `[${timestamp()}] Usage: /project import|use|list`,
      };
  }
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

    // Run in background — don't block TUI
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
