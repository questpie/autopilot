// ── Workspace Types ─────────────────────────────────────────

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

export interface WorkspaceGlobal {
  activeProject?: string;
  version: number;
}

export const QAP_DIR = ".qap";
export const PROJECTS_DIR = "projects";
export const GLOBAL_CONFIG_FILE = "config.json";

export function getQapRoot(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
  return `${home}/${QAP_DIR}`;
}

export function getProjectDir(projectId: string): string {
  return `${getQapRoot()}/${PROJECTS_DIR}/${projectId}`;
}
