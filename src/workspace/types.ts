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
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed" | "aborted";
  taskCount: number;
  tasksCompleted: number;
  tasksFailed: number;
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
