// ── Task States ──────────────────────────────────────────────
export const TASK_STATES = [
  "todo",
  "ready",
  "in_progress",
  "implemented",
  "validated_primary",
  "validated_secondary",
  "committed",
  "done",
  "blocked",
  "failed",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

// ── Valid Transitions ────────────────────────────────────────
export const TRANSITIONS: Record<TaskState, TaskState[]> = {
  todo: ["ready", "blocked"],
  ready: ["in_progress", "blocked"],
  in_progress: ["implemented", "blocked", "failed"],
  implemented: ["validated_primary", "blocked", "failed"],
  validated_primary: ["validated_secondary", "blocked", "failed"],
  validated_secondary: ["committed", "blocked", "failed"],
  committed: ["done"],
  done: [],
  blocked: ["todo", "ready"],
  failed: ["todo", "ready"],
};

// ── Derived States ───────────────────────────────────────────
export type EpicState =
  | "todo"
  | "in_progress"
  | "ready_for_validation"
  | "validated"
  | "done"
  | "blocked"
  | "failed";

export type ProjectState =
  | "bootstrapping"
  | "executing"
  | "epic_validation"
  | "global_validation"
  | "done"
  | "blocked";

// ── Config Types ─────────────────────────────────────────────
export type TaskKind =
  | "implementation"
  | "validation"
  | "cleanup"
  | "migration"
  | "poc";

export type TaskTrack = "main" | "sidecar" | "gate";

export type PromptMode =
  | "implement"
  | "validate-primary"
  | "validate-secondary"
  | "validate-epic"
  | "validate-global";

export type AgentProvider = "claude" | "codex";

export type PermissionProfile = "safe" | "elevated" | "max";

export type ExecutionMode = "prompt-only" | "autonomous";

// ── Provider Config ──────────────────────────────────────────
export interface ProviderConfig {
  binary: string;
  enabled: boolean;
  defaultArgs?: string[];
  timeoutMs?: number;
  permissionProfiles?: Record<PermissionProfile, string[]>;
}

// ── Task Config ──────────────────────────────────────────────
export interface TaskConfig {
  id: string;
  title: string;
  epicId: string;
  kind: TaskKind;
  track: TaskTrack;
  dependsOn?: string[];
  blocks?: string[];
  promptFile?: string;
  issueUrl?: string;
  branchName?: string;
  worktreePath?: string;
  sourceRefs?: string[];
  acceptanceCriteria?: string[];
  provider?: AgentProvider;
  permissionProfile?: PermissionProfile;
  timeoutMs?: number;
  retryPolicy?: {
    maxAttempts: number;
  };
}

export interface EpicConfig {
  id: string;
  title: string;
  track: TaskTrack;
  promptFile?: string;
  dependsOn?: string[];
}

// ── Project Config ───────────────────────────────────────────
export interface ProjectConfig {
  project: {
    id: string;
    name: string;
    rootDir: string;
    sharedContextFile?: string;
  };
  execution: {
    mode: ExecutionMode;
    defaultProvider: AgentProvider;
    defaultPermissionProfile: PermissionProfile;
    maxParallelTasks?: number;
    stopOnFailure?: boolean;
    validateAfterEachTask?: boolean;
    validateCommand?: string;
    /** What to do when validateCommand fails: "warn" = log + continue, "block" = fail task */
    validateCommandPolicy?: "warn" | "block";
  };
  tracker?: {
    provider: "linear";
    projectId?: string;
    teamId?: string;
    /** Linear ops are delegated to the coding agent via Linear MCP — no API key needed */
    enabled?: boolean;
  };
  agents?: Partial<Record<AgentProvider, ProviderConfig>>;
  prompts: {
    sharedContext?: string;
    templatesDir?: string;
  };
  reporting?: {
    sessionLogFile?: string;
    projectChangelogFile?: string;
  };
  epics: EpicConfig[];
  tasks: TaskConfig[];
}

// ── Runtime State ────────────────────────────────────────────
export interface AgentRunRecord {
  provider: AgentProvider;
  permissionProfile: PermissionProfile;
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  startedAt: string;
  finishedAt: string;
}

export interface TaskRunState {
  id: string;
  state: TaskState;
  startedAt?: string;
  completedAt?: string;
  commitHash?: string;
  branchName?: string;
  notes: string[];
  runs: AgentRunRecord[];
  error?: string;
  retries: number;
}

export interface RunState {
  projectId: string;
  startedAt: string;
  lastUpdatedAt: string;
  tasks: Record<string, TaskRunState>;
  changelog: ChangelogEntry[];
  sessionId: string;
}

export interface ChangelogEntry {
  timestamp: string;
  taskId?: string;
  epicId?: string;
  action: string;
  detail: string;
  agentProvider?: AgentProvider;
}

// ── Agent Result ─────────────────────────────────────────────
export interface AgentResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
  error?: string;
  record: AgentRunRecord;
}
