import { WorkspaceManager } from "../workspace/manager.js";
import type { ProjectMeta } from "../workspace/types.js";

// ── TUI State ───────────────────────────────────────────────

export interface TaskEntry {
  id: string;
  title: string;
  state: string;
  track: string;
  kind: string;
  epicId: string;
}

export interface TaskCounts {
  total: number;
  ready: number;
  inProgress: number;
  done: number;
  failed: number;
  blocked: number;
}

export interface TuiState {
  activeProject: ProjectMeta | null;
  readyTasks: TaskEntry[];
  completedTasks: TaskEntry[];
  taskCounts: TaskCounts;
  logs: string[];
  configPath: string | null;
}

export function createInitialState(): TuiState {
  return {
    activeProject: null,
    readyTasks: [],
    completedTasks: [],
    taskCounts: {
      total: 0,
      ready: 0,
      inProgress: 0,
      done: 0,
      failed: 0,
      blocked: 0,
    },
    logs: ["QUESTPIE Autopilot started", "Type /help for commands"],
    configPath: null,
  };
}

export async function loadTuiState(): Promise<TuiState | null> {
  const ws = new WorkspaceManager();
  const activeId = await ws.getActiveProjectId();

  if (!activeId) {
    return {
      ...createInitialState(),
      logs: [
        "No active project",
        "Use /init or /project import to create one",
        "Or use /project use <id> to select one",
      ],
    };
  }

  const project = await ws.loadProject(activeId);
  if (!project) {
    return {
      ...createInitialState(),
      logs: [`Project "${activeId}" not found`, "Use /project list to see available projects"],
    };
  }

  const configPath = await ws.getActiveConfigPath();

  // Try loading tasks from config if available
  let readyTasks: TaskEntry[] = [];
  let completedTasks: TaskEntry[] = [];
  let taskCounts: TaskCounts = {
    total: 0,
    ready: 0,
    inProgress: 0,
    done: 0,
    failed: 0,
    blocked: 0,
  };

  if (configPath) {
    try {
      const { loadConfig } = await import("../config/loader.js");
      const { findReadyTasks } = await import("../core/readiness.js");
      const { Store } = await import("../storage/store.js");

      const config = await loadConfig(configPath);
      const store = new Store(config.project.rootDir, config.project.id);
      await store.load();

      for (const task of config.tasks) {
        store.initTask(task.id);
      }

      const allStates = store.getAllTasks();
      const ready = findReadyTasks(config.tasks, allStates);

      readyTasks = ready.map((t) => ({
        id: t.id,
        title: t.title,
        state: allStates[t.id]?.state ?? "todo",
        track: t.track,
        kind: t.kind,
        epicId: t.epicId,
      }));

      completedTasks = config.tasks
        .filter((t) => {
          const s = allStates[t.id]?.state;
          return s === "done" || s === "committed" || s === "failed";
        })
        .map((t) => ({
          id: t.id,
          title: t.title,
          state: allStates[t.id]?.state ?? "todo",
          track: t.track,
          kind: t.kind,
          epicId: t.epicId,
        }));

      // Compute counts
      const states = config.tasks.map((t) => allStates[t.id]?.state ?? "todo");
      taskCounts = {
        total: config.tasks.length,
        ready: ready.length,
        inProgress: states.filter((s) => s === "in_progress").length,
        done: states.filter((s) => s === "done" || s === "committed").length,
        failed: states.filter((s) => s === "failed").length,
        blocked: states.filter((s) => s === "blocked").length,
      };
    } catch (err) {
      // Config loading may fail if no tasks defined yet — that's ok
    }
  }

  return {
    activeProject: project,
    readyTasks,
    completedTasks,
    taskCounts,
    logs: [
      `Project: ${project.name}`,
      `Provider: ${project.provider}`,
      `Repo: ${project.repoRoot}`,
      configPath ? `Config: ${configPath}` : "No config — run /init to set up",
      `${taskCounts.total} tasks | ${taskCounts.ready} ready | ${taskCounts.done} done`,
    ],
    configPath,
  };
}
