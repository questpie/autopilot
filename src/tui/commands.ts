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

    case "run-next":
      return cmdRunNext(parts.slice(1), currentState);

    case "run-task":
      return cmdRunTask(parts.slice(1), currentState);

    case "retry":
      return cmdRetry(parts.slice(1), currentState);

    case "status":
      return cmdStatus(currentState);

    case "note":
      return cmdNote(parts.slice(1), currentState);

    case "steer":
      return cmdSteer(parts.slice(1), currentState);

    case "say":
      return cmdSay(parts.slice(1), currentState);

    case "interrupt":
      return cmdInterruptSession(parts.slice(1), currentState);

    case "refresh":
      return cmdRefresh();

    case "help":
      return {
        log: `[${timestamp()}] Commands: /project, /sessions, /session, /run, /run-task <id>, /retry <id>, /say <text>, /interrupt, /status, /note, /steer, /refresh, /help | Views: 1=project 2=sessions 3=logs [c/a/r] 4=help`,
      };

    default:
      return {
        log: `[${timestamp()}] Unknown: "${action}". Try /help for commands.`,
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
        // /project with no sub — switch to project view
        return {
          newState: { ...currentState, activeView: "project" },
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
    return {
      newState: { ...currentState, activeView: "sessions", sessions },
      log: `[${timestamp()}] No sessions yet. Use /run or /run-task to start one.`,
    };
  }

  const listing = sessions
    .slice(0, 10)
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

  if (!currentState.workspace || !currentState.activeProject) {
    return { log: `[${timestamp()}] No active project` };
  }

  const ws = new WorkspaceManager();

  if (sub === "show") {
    const id = args[1];
    if (!id) return { log: `[${timestamp()}] Usage: /session show <id>` };

    // Support partial ID match
    const sessions = await ws.listSessions(
      currentState.workspace.id,
      currentState.activeProject.id
    );
    const session = sessions.find(
      (s) => s.id === id || s.id.startsWith(id)
    );

    if (!session) {
      // Suggest closest matches
      const similar = sessions
        .filter((s) => s.id.toLowerCase().includes(id.toLowerCase()))
        .slice(0, 3);
      if (similar.length > 0) {
        const matches = similar.map((s) => s.id.slice(0, 8)).join(", ");
        return { log: `[${timestamp()}] Session "${id}" not found. Did you mean: ${matches}?` };
      }
      return { log: `[${timestamp()}] Session "${id}" not found` };
    }

    return {
      newState: {
        ...currentState,
        activeView: "session-detail",
        selectedSession: session,
      },
    };
  }

  if (sub === "latest") {
    const sessions = await ws.listSessions(
      currentState.workspace.id,
      currentState.activeProject.id
    );
    if (sessions.length === 0) {
      return { log: `[${timestamp()}] No sessions yet` };
    }
    const latest = sessions[0]!; // Already sorted by startedAt desc
    return {
      newState: {
        ...currentState,
        activeView: "session-detail",
        selectedSession: latest,
      },
    };
  }

  if (sub === "current") {
    const sessions = await ws.listSessions(
      currentState.workspace.id,
      currentState.activeProject.id
    );
    const running = sessions.find((s) => s.status === "running");
    if (!running) {
      return { log: `[${timestamp()}] No running session` };
    }
    return {
      newState: {
        ...currentState,
        activeView: "session-detail",
        selectedSession: running,
      },
    };
  }

  return {
    log: `[${timestamp()}] Usage: /session [show <id>|latest|current]`,
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
      workspaceId: currentState.workspace?.id,
      projectId: currentState.activeProject?.id,
    });

    runner.runNext().then(async () => {
      // Auto-refresh will pick up changes
    });

    return {
      log: `[${timestamp()}] Running next task... (new session created)`,
    };
  } catch (err) {
    return {
      log: `[${timestamp()}] Run failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function cmdRunNext(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  // Alias for /run
  return cmdRun(args, currentState);
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

  // Validate task exists
  const matchedTask = currentState.allTasks.find(
    (t) => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase()
  );
  if (!matchedTask) {
    // Suggest closest matches
    const similar = currentState.allTasks
      .filter((t) => t.id.toLowerCase().includes(taskId.toLowerCase()))
      .slice(0, 3);
    if (similar.length > 0) {
      const matches = similar.map((t) => t.id).join(", ");
      return { log: `[${timestamp()}] Task "${taskId}" not found. Did you mean: ${matches}?` };
    }
    return { log: `[${timestamp()}] Task "${taskId}" not found` };
  }

  try {
    const { loadConfig } = await import("../config/loader.js");
    const { Runner } = await import("../core/runner.js");
    const config = await loadConfig(currentState.configPath);
    const runner = new Runner(config, {
      dryRun: args.includes("--dry-run"),
      taskFilter: matchedTask.id,
      workspaceId: currentState.workspace?.id,
      projectId: currentState.activeProject?.id,
    });

    runner.run().then(async () => {
      // Auto-refresh will pick up changes
    });

    return {
      log: `[${timestamp()}] Running task ${matchedTask.id}... (new session created)`,
    };
  } catch (err) {
    return {
      log: `[${timestamp()}] Run failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function cmdRetry(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  const taskId = args[0];
  if (!taskId) {
    // If no arg, find the most recently failed task
    const failed = currentState.completedTasks.filter((t) => t.state === "failed");
    if (failed.length === 0) {
      return { log: `[${timestamp()}] No failed tasks to retry` };
    }
    return { log: `[${timestamp()}] Usage: /retry <task-id>. Failed tasks: ${failed.map((t) => t.id).join(", ")}` };
  }

  if (!currentState.configPath) {
    return { log: `[${timestamp()}] No active config` };
  }

  // Find the task
  const task = currentState.allTasks.find(
    (t) => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase()
  );
  if (!task) {
    const similar = currentState.allTasks
      .filter((t) => t.id.toLowerCase().includes(taskId.toLowerCase()))
      .slice(0, 3);
    if (similar.length > 0) {
      return { log: `[${timestamp()}] Task "${taskId}" not found. Did you mean: ${similar.map((t) => t.id).join(", ")}?` };
    }
    return { log: `[${timestamp()}] Task "${taskId}" not found` };
  }

  if (task.state !== "failed") {
    return { log: `[${timestamp()}] Task ${task.id} is ${task.state}, not failed. Use /run-task to re-run.` };
  }

  // Reset the task state to todo, then run it
  try {
    const { loadConfig } = await import("../config/loader.js");
    const { Store } = await import("../storage/store.js");
    const { Runner } = await import("../core/runner.js");
    const config = await loadConfig(currentState.configPath);
    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const t of config.tasks) store.initTask(t.id);

    // Reset failed task to todo
    const taskState = store.getTask(task.id);
    if (taskState) {
      taskState.state = "todo";
      store.setTask(task.id, taskState);
      await store.save();
    }

    const runner = new Runner(config, {
      taskFilter: task.id,
      workspaceId: currentState.workspace?.id,
      projectId: currentState.activeProject?.id,
    });

    runner.run().then(async () => {
      // Auto-refresh will pick up changes
    });

    return {
      log: `[${timestamp()}] Retrying task ${task.id}... (new session created)`,
    };
  } catch (err) {
    return {
      log: `[${timestamp()}] Retry failed: ${err instanceof Error ? err.message : String(err)}`,
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

async function cmdNote(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  if (!currentState.configPath) {
    return { log: `[${timestamp()}] No active config` };
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "show") {
    const taskId = args[1];
    if (!taskId) return { log: `[${timestamp()}] Usage: /note show <task-id>` };

    try {
      const { loadConfig } = await import("../config/loader.js");
      const { Store } = await import("../storage/store.js");
      const config = await loadConfig(currentState.configPath);
      const store = new Store(config.project.rootDir, config.project.id);
      await store.load();
      for (const task of config.tasks) store.initTask(task.id);

      const taskState = store.getTask(taskId);
      if (!taskState) return { log: `[${timestamp()}] Task "${taskId}" not found` };
      if (taskState.notes.length === 0) return { log: `[${timestamp()}] No notes for ${taskId}` };

      const listing = taskState.notes.map((n) => `  ${n}`).join("\n");
      return { log: `[${timestamp()}] Notes for ${taskId}:\n${listing}` };
    } catch (err) {
      return { log: `[${timestamp()}] Error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // /note <task-id> <text>
  const taskId = args[0];
  const text = args.slice(1).join(" ");
  if (!taskId || !text) {
    return { log: `[${timestamp()}] Usage: /note <task-id> <text> or /note show <task-id>` };
  }

  try {
    const { loadConfig } = await import("../config/loader.js");
    const { Store } = await import("../storage/store.js");
    const config = await loadConfig(currentState.configPath);
    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const task of config.tasks) store.initTask(task.id);

    const taskState = store.getTask(taskId);
    if (!taskState) return { log: `[${timestamp()}] Task "${taskId}" not found` };

    taskState.notes.push(`[${new Date().toISOString()}] ${text}`);
    store.setTask(taskId, taskState);
    await store.save();

    return { log: `[${timestamp()}] Note added to ${taskId}` };
  } catch (err) {
    return { log: `[${timestamp()}] Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function cmdSteer(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  if (!currentState.workspace || !currentState.activeProject) {
    return { log: `[${timestamp()}] No active project` };
  }

  const sub = args[0]?.toLowerCase();
  const ws = new WorkspaceManager();

  if (sub === "show") {
    const content = await ws.readSteering(
      currentState.workspace.id,
      currentState.activeProject.id
    );
    if (!content) return { log: `[${timestamp()}] No project steering notes yet` };
    return { log: `[${timestamp()}] Steering:\n${content}` };
  }

  if (sub === "project") {
    const text = args.slice(1).join(" ");
    if (!text) return { log: `[${timestamp()}] Usage: /steer project <text>` };

    await ws.appendSteering(
      currentState.workspace.id,
      currentState.activeProject.id,
      text
    );
    return { log: `[${timestamp()}] Steering note added` };
  }

  return { log: `[${timestamp()}] Usage: /steer [project <text>|show]` };
}

async function cmdSay(
  args: string[],
  currentState: TuiState
): Promise<CommandResult> {
  const text = args.join(" ");
  if (!text) return { log: `[${timestamp()}] Usage: /say <message>` };

  if (!currentState.workspace || !currentState.activeProject) {
    return { log: `[${timestamp()}] No active project` };
  }

  const ws = new WorkspaceManager();
  const sessions = await ws.listSessions(
    currentState.workspace.id,
    currentState.activeProject.id
  );
  const running = sessions.find((s) => s.status === "running");

  if (running) {
    await ws.addSessionNote(
      currentState.workspace.id,
      currentState.activeProject.id,
      running.id,
      `[user-message] ${text}`
    );
    return {
      log: `[${timestamp()}] Message saved to session ${running.id.slice(0, 8)}. Will apply on next step.`,
    };
  }

  // No running session — save as steering note
  await ws.appendSteering(
    currentState.workspace.id,
    currentState.activeProject.id,
    `[user-message] ${text}`
  );
  return {
    log: `[${timestamp()}] No running session. Saved as steering note for next session.`,
  };
}

async function cmdInterruptSession(
  args: string[],
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
  const running = sessions.find((s) => s.status === "running");

  if (!running) {
    return { log: `[${timestamp()}] No running session to interrupt` };
  }

  const reason = args.join(" ") || "User requested interrupt";
  await ws.addSessionNote(
    currentState.workspace.id,
    currentState.activeProject.id,
    running.id,
    `[interrupt] ${reason}`
  );
  running.status = "aborted";
  running.finishedAt = new Date().toISOString();
  await ws.saveSession(
    currentState.workspace.id,
    currentState.activeProject.id,
    running
  );

  const newState = await loadTuiState();
  return {
    newState: newState ?? undefined,
    log: `[${timestamp()}] Session ${running.id.slice(0, 8)} interrupted: ${reason}`,
  };
}

// ── Helpers ──

function extractFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1]! : null;
}
