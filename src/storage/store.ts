import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  RunState,
  TaskRunState,
  ChangelogEntry,
} from "../core/types.js";
import { TASK_STATES } from "../core/types.js";
import { getProjectStatePath } from "../workspace/types.js";

/** Legacy filename written into the target repo root (no longer used for writes). */
const LEGACY_STATE_FILE = ".autopilot-state.json";
/** Transitional filename previously written into the qap project dir. */
const LEGACY_PROJECT_STATE_FILE = "state.json";

export class Store {
  private state: RunState;
  private filePath: string;
  /** Transitional path in qap project dir — read-only for backward compatibility. */
  private legacyProjectPath: string;
  /** Legacy path in repo root — used only for one-time migration read. */
  private legacyPath: string;

  constructor(
    repoRoot: string,
    private projectId: string
  ) {
    this.filePath = getProjectStatePath(repoRoot, projectId);
    this.legacyProjectPath = this.filePath.replace(/\/run-state\.json$/, `/${LEGACY_PROJECT_STATE_FILE}`);
    this.legacyPath = `${repoRoot}/${LEGACY_STATE_FILE}`;
    this.state = this.emptyState();
  }

  private emptyState(): RunState {
    return {
      projectId: this.projectId,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      tasks: {},
      changelog: [],
      sessionId: crypto.randomUUID(),
    };
  }

  async load(): Promise<void> {
    // Try loading from the new qap project dir first
    let loaded = await this.tryLoad(this.filePath);

    // Fall back to the earlier project-dir path only if it matches RunState schema
    if (!loaded) {
      loaded = await this.tryLoad(this.legacyProjectPath);
    }

    // Fall back to legacy repo-root state for one-time migration
    if (!loaded) {
      loaded = await this.tryLoad(this.legacyPath);
    }

    if (!loaded) {
      this.state = this.emptyState();
    }
  }

  private async tryLoad(path: string): Promise<boolean> {
    try {
      const raw = await readFile(path, "utf-8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeRunState(parsed, this.projectId);
      if (!normalized) return false;
      this.state = normalized;
      return true;
    } catch {
      return false;
    }
  }

  async save(): Promise<void> {
    this.state.lastUpdatedAt = new Date().toISOString();
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2));
  }

  getTask(id: string): TaskRunState | undefined {
    return this.state.tasks[id];
  }

  setTask(id: string, task: TaskRunState): void {
    this.state.tasks[id] = task;
  }

  getAllTasks(): Record<string, TaskRunState> {
    return this.state.tasks;
  }

  initTask(id: string): TaskRunState {
    if (!this.state.tasks[id]) {
      this.state.tasks[id] = {
        id,
        state: "todo",
        notes: [],
        runs: [],
        retries: 0,
        validationHistory: [],
        remediationAttempts: 0,
        remediationHistory: [],
      };
    }
    return this.state.tasks[id]!;
  }

  addChangelog(entry: Omit<ChangelogEntry, "timestamp">): void {
    this.state.changelog.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  getChangelog(): ChangelogEntry[] {
    return this.state.changelog;
  }

  getState(): RunState {
    return this.state;
  }

  getSessionId(): string {
    return this.state.sessionId;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTaskState(value: unknown): value is (typeof TASK_STATES)[number] {
  return typeof value === "string" && (TASK_STATES as readonly string[]).includes(value);
}

function normalizeLegacyStatus(
  value: unknown
): TaskRunState["state"] | null {
  if (isTaskState(value)) return value;
  if (typeof value !== "string") return null;

  switch (value) {
    case "in-progress":
    case "partial":
      return "in_progress";
    default:
      return null;
  }
}

function normalizeTaskRunState(
  id: string,
  value: unknown
): TaskRunState | null {
  if (!isObject(value)) return null;

  const state = normalizeLegacyStatus(value.state) ?? normalizeLegacyStatus(value.status);
  if (!state) return null;

  const notes = Array.isArray(value.notes)
    ? value.notes.filter((note): note is string => typeof note === "string")
    : [];
  if (typeof value.summary === "string") {
    notes.push(`Summary: ${value.summary}`);
  }

  return {
    id,
    state,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
    completedAt:
      typeof value.completedAt === "string"
        ? value.completedAt
        : typeof value.finishedAt === "string"
          ? value.finishedAt
          : undefined,
    commitHash:
      typeof value.commitHash === "string"
        ? value.commitHash
        : typeof value.commit === "string"
          ? value.commit
          : undefined,
    branchName: typeof value.branchName === "string" ? value.branchName : undefined,
    notes,
    runs: Array.isArray(value.runs) ? (value.runs as TaskRunState["runs"]) : [],
    error: typeof value.error === "string" ? value.error : undefined,
    retries: typeof value.retries === "number" ? value.retries : 0,
    lastValidation: isObject(value.lastValidation)
      ? (value.lastValidation as TaskRunState["lastValidation"])
      : undefined,
    validationHistory: Array.isArray(value.validationHistory)
      ? (value.validationHistory as TaskRunState["validationHistory"])
      : [],
    remediationAttempts:
      typeof value.remediationAttempts === "number"
        ? value.remediationAttempts
        : 0,
    remediationHistory: Array.isArray(value.remediationHistory)
      ? (value.remediationHistory as TaskRunState["remediationHistory"])
      : [],
    lastTrackerSync: isObject(value.lastTrackerSync)
      ? (value.lastTrackerSync as TaskRunState["lastTrackerSync"])
      : undefined,
  };
}

function normalizeChangelogEntry(value: unknown): ChangelogEntry | null {
  if (!isObject(value)) return null;

  if (
    typeof value.timestamp === "string" &&
    typeof value.action === "string" &&
    typeof value.detail === "string"
  ) {
    return value as ChangelogEntry;
  }

  if (typeof value.ts === "string" && typeof value.note === "string") {
    return {
      timestamp: value.ts,
      action: "NOTE",
      detail: value.note,
    };
  }

  return null;
}

function normalizeRunState(
  value: unknown,
  fallbackProjectId: string
): RunState | null {
  if (!isObject(value) || !isObject(value.tasks)) return null;

  const tasks: Record<string, TaskRunState> = {};
  for (const [id, task] of Object.entries(value.tasks)) {
    const normalized = normalizeTaskRunState(id, task);
    if (!normalized) return null;
    tasks[id] = normalized;
  }

  return {
    projectId:
      typeof value.projectId === "string" ? value.projectId : fallbackProjectId,
    startedAt:
      typeof value.startedAt === "string"
        ? value.startedAt
        : new Date().toISOString(),
    lastUpdatedAt:
      typeof value.lastUpdatedAt === "string"
        ? value.lastUpdatedAt
        : new Date().toISOString(),
    tasks,
    changelog: Array.isArray(value.changelog)
      ? value.changelog
          .map(normalizeChangelogEntry)
          .filter((entry): entry is ChangelogEntry => entry !== null)
      : [],
    sessionId:
      typeof value.sessionId === "string"
        ? value.sessionId
        : crypto.randomUUID(),
  };
}
