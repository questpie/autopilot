import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  RunState,
  TaskRunState,
  ChangelogEntry,
} from "../core/types.js";

const STATE_FILE = ".autopilot-state.json";

export class Store {
  private state: RunState;
  private filePath: string;

  constructor(
    rootDir: string,
    private projectId: string
  ) {
    this.filePath = `${rootDir}/${STATE_FILE}`;
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
    try {
      const raw = await readFile(this.filePath, "utf-8");
      this.state = JSON.parse(raw);
      // Migrate existing task states to include new fields
      for (const task of Object.values(this.state.tasks)) {
        if (!task.validationHistory) task.validationHistory = [];
        if (task.remediationAttempts == null) task.remediationAttempts = 0;
        if (!task.remediationHistory) task.remediationHistory = [];
      }
    } catch {
      this.state = this.emptyState();
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
