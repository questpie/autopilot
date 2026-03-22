import { resolve } from "node:path";

// ── Workspace / Project / Session Types ─────────────────────

export interface WorkspaceMeta {
  id: string;
  name: string;
  repoRoot: string;
  activeProject?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  repoRoot: string;
  provider: "claude" | "codex";
  createdAt: string;
  updatedAt: string;
  source?: {
    mode: "init" | "import";
    promptsDir?: string;
    planFile?: string;
    validatedPlanFile?: string;
    linearIssue?: string;
  };
}

export interface SessionMeta {
  id: string;
  projectId: string;
  workspaceId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed" | "aborted";
  provider: string;
  taskCount: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentTaskId?: string;
  lastEventAt?: string;
  eventLogPath?: string;
  changelogPath?: string;
  notes: string[];
  /** What triggered this session: "run", "run-next", "run-task", "autopilot" */
  triggerAction?: "run" | "run-next" | "run-task" | "autopilot";
  /** Current execution phase (implement, validate-primary, etc.) */
  currentPhase?: string;
  /** Currently active tool name */
  activeTool?: string;
  /** Last assistant text update (truncated) */
  lastAssistantUpdate?: string;
  /** Path to the per-session provider events JSONL */
  sessionEventsPath?: string;
  /** SDK session ID if using Agent SDK backend */
  sdkSessionId?: string;
  /** Provider backend used: "cli" or "sdk" */
  backend?: string;
  /** Autopilot master session ID (set on child sessions spawned by autopilot) */
  autopilotSessionId?: string;
  /** For autopilot master sessions: list of child session IDs */
  childSessionIds?: string[];
}

// ── Constants ──

export const QAP_DIR = ".qap";
export const WORKSPACES_DIR = "workspaces";

// ── Path Helpers ──

export function getQapRoot(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
  return `${home}/${QAP_DIR}`;
}

/**
 * Derive a stable workspace ID from a repo root path.
 * Slugifies the absolute path into a filesystem-safe identifier.
 */
export function workspaceIdFromPath(repoRoot: string): string {
  return repoRoot
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function getWorkspaceDir(workspaceId: string): string {
  return `${getQapRoot()}/${WORKSPACES_DIR}/${workspaceId}`;
}

export function getProjectDir(
  workspaceId: string,
  projectId: string
): string {
  return `${getWorkspaceDir(workspaceId)}/projects/${projectId}`;
}

export function getSessionsDir(
  workspaceId: string,
  projectId: string
): string {
  return `${getProjectDir(workspaceId, projectId)}/sessions`;
}

export function getSteeringPath(
  workspaceId: string,
  projectId: string
): string {
  return `${getProjectDir(workspaceId, projectId)}/steering.md`;
}

/**
 * Resolve the qap project directory from a repo root path and project ID.
 * Uses the same absolute-path normalization as WorkspaceManager.
 */
export function getProjectDirFromRepo(repoRoot: string, projectId: string): string {
  return getProjectDir(workspaceIdFromPath(resolve(repoRoot)), projectId);
}

/**
 * Path for the project-level runtime state file (replaces repo-root .autopilot-state.json).
 */
export function getProjectStatePath(repoRoot: string, projectId: string): string {
  return `${getProjectDirFromRepo(repoRoot, projectId)}/run-state.json`;
}

/**
 * Path for the project-level changelog (replaces repo-root .autopilot-changelog.md).
 */
export function getProjectChangelogPath(repoRoot: string, projectId: string): string {
  return `${getProjectDirFromRepo(repoRoot, projectId)}/changelog.md`;
}

/**
 * Path for the project-level structured event log.
 */
export function getProjectEventLogPath(repoRoot: string, projectId: string): string {
  return `${getProjectDirFromRepo(repoRoot, projectId)}/events.jsonl`;
}

/**
 * Path for the project-level live status file for interactive runs.
 */
export function getProjectLiveStatusPath(repoRoot: string, projectId: string): string {
  return `${getProjectDirFromRepo(repoRoot, projectId)}/LIVE_STATUS.md`;
}

/**
 * Path for the autopilot summary report.
 */
export function getProjectSummaryPath(repoRoot: string, projectId: string): string {
  return `${getProjectDirFromRepo(repoRoot, projectId)}/summary.md`;
}

/**
 * Path for the autopilot live status report.
 */
export function getProjectAutopilotStatusPath(repoRoot: string, projectId: string): string {
  return `${getProjectDirFromRepo(repoRoot, projectId)}/AUTOPILOT_STATUS.md`;
}
