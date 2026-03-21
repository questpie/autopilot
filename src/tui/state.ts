import { WorkspaceManager } from "../workspace/manager.js";
import type { WorkspaceMeta, ProjectMeta, SessionMeta } from "../workspace/types.js";
import { checkForUpdate } from "../update/checker.js";
import { getUpdateStatusText } from "../update/notify.js";

// ── TUI State ───────────────────────────────────────────────

export type TuiView = "project" | "sessions" | "logs" | "help";

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

export interface RunningSession {
  id: string;
  status: string;
  currentTaskId?: string;
  tasksCompleted: number;
  tasksFailed: number;
  taskCount: number;
  lastEventAt?: string;
}

export interface TuiState {
  workspace: WorkspaceMeta | null;
  activeProject: ProjectMeta | null;
  projects: ProjectMeta[];
  sessions: SessionMeta[];
  readyTasks: TaskEntry[];
  completedTasks: TaskEntry[];
  inProgressTasks: TaskEntry[];
  taskCounts: TaskCounts;
  logs: string[];
  configPath: string | null;
  activeView: TuiView;
  needsProjectPicker: boolean;
  updateStatus: string | null;
  runningSession: RunningSession | null;
}

export function createInitialState(): TuiState {
  return {
    workspace: null,
    activeProject: null,
    projects: [],
    sessions: [],
    readyTasks: [],
    completedTasks: [],
    inProgressTasks: [],
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
    activeView: "project",
    needsProjectPicker: false,
    updateStatus: null,
    runningSession: null,
  };
}

export async function loadTuiState(): Promise<TuiState | null> {
  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();

  if (!workspace) {
    return {
      ...createInitialState(),
      logs: [
        "No workspace found for current directory",
        "Use /project init or /project import to create one",
        "Or run: qap workspace add .",
      ],
    };
  }

  const projects = await ws.listProjects(workspace.id);

  // No projects — show empty state
  if (projects.length === 0) {
    return {
      ...createInitialState(),
      workspace,
      projects: [],
      logs: [
        `Workspace: ${workspace.name}`,
        `Repo: ${workspace.repoRoot}`,
        "No projects yet",
        "Use /project init or /project import to create one",
      ],
    };
  }

  // Multiple projects without an active one — show picker
  const activeId = workspace.activeProject;
  let activeProject: ProjectMeta | null = null;

  if (activeId) {
    activeProject = projects.find((p) => p.id === activeId) ?? null;
  }

  if (!activeProject && projects.length === 1) {
    // Auto-select single project
    activeProject = projects[0]!;
    await ws.setActiveProject(workspace.id, activeProject.id);
  }

  const needsProjectPicker = !activeProject && projects.length > 1;

  if (needsProjectPicker) {
    return {
      ...createInitialState(),
      workspace,
      projects,
      needsProjectPicker: true,
      logs: [
        `Workspace: ${workspace.name}`,
        `${projects.length} projects found — select one:`,
        ...projects.map((p, i) => `  ${i + 1}. ${p.id} (${p.provider})`),
        "Use /project use <id> to select",
      ],
    };
  }

  if (!activeProject) {
    return {
      ...createInitialState(),
      workspace,
      projects,
      logs: [
        `Workspace: ${workspace.name}`,
        "No active project",
        "Use /project init or /project import to create one",
      ],
    };
  }

  // Load sessions
  const sessions = await ws.listSessions(workspace.id, activeProject.id);

  // Load config + tasks
  const configPath = await ws.getActiveConfigPath(workspace.id);

  let readyTasks: TaskEntry[] = [];
  let completedTasks: TaskEntry[] = [];
  let inProgressTasks: TaskEntry[] = [];
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

      inProgressTasks = config.tasks
        .filter((t) => allStates[t.id]?.state === "in_progress")
        .map((t) => ({
          id: t.id,
          title: t.title,
          state: "in_progress",
          track: t.track,
          kind: t.kind,
          epicId: t.epicId,
        }));

      const states = config.tasks.map((t) => allStates[t.id]?.state ?? "todo");
      taskCounts = {
        total: config.tasks.length,
        ready: ready.length,
        inProgress: states.filter((s) => s === "in_progress").length,
        done: states.filter((s) => s === "done" || s === "committed").length,
        failed: states.filter((s) => s === "failed").length,
        blocked: states.filter((s) => s === "blocked").length,
      };
    } catch {
      // Config loading may fail if no tasks defined yet
    }
  }

  // Detect running session
  let runningSession: RunningSession | null = null;
  const runningS = sessions.find((s) => s.status === "running");
  if (runningS) {
    runningSession = {
      id: runningS.id,
      status: runningS.status,
      currentTaskId: runningS.currentTaskId,
      tasksCompleted: runningS.tasksCompleted,
      tasksFailed: runningS.tasksFailed,
      taskCount: runningS.taskCount,
      lastEventAt: runningS.lastEventAt,
    };
  }

  // Non-blocking update check
  let updateStatus: string | null = null;
  try {
    const updateResult = await checkForUpdate();
    updateStatus = getUpdateStatusText(updateResult);
  } catch {
    // Never fail TUI load for update check
  }

  const logs = [
    `Workspace: ${workspace.name}`,
    `Project: ${activeProject.name}`,
    `Provider: ${activeProject.provider}`,
    `Repo: ${activeProject.repoRoot}`,
    configPath ? `Config: ${configPath}` : "No config — run /project init to set up",
    `${taskCounts.total} tasks | ${taskCounts.ready} ready | ${taskCounts.done} done`,
    `${sessions.length} session(s)`,
  ];
  if (updateStatus) logs.push(updateStatus);

  return {
    workspace,
    activeProject,
    projects,
    sessions,
    readyTasks,
    completedTasks,
    inProgressTasks,
    taskCounts,
    logs,
    configPath,
    activeView: "project",
    needsProjectPicker: false,
    updateStatus,
    runningSession,
  };
}
