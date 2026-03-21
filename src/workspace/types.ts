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
  /** What triggered this session: "run", "run-next", "run-task" */
  triggerAction?: "run" | "run-next" | "run-task";
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
