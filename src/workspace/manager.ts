import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  WorkspaceMeta,
  ProjectMeta,
  SessionMeta,
} from "./types.js";
import {
  getQapRoot,
  getWorkspaceDir,
  getProjectDir,
  getSessionsDir,
  workspaceIdFromPath,
  WORKSPACES_DIR,
} from "./types.js";

// ── Workspace Manager ───────────────────────────────────────

export class WorkspaceManager {
  private root: string;

  constructor() {
    this.root = getQapRoot();
  }

  async ensureRoot(): Promise<void> {
    await mkdir(`${this.root}/${WORKSPACES_DIR}`, { recursive: true });
  }

  // ── Workspace CRUD ──

  async listWorkspaces(): Promise<WorkspaceMeta[]> {
    await this.ensureRoot();
    const dir = `${this.root}/${WORKSPACES_DIR}`;

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const workspaces: WorkspaceMeta[] = [];
    for (const entry of entries) {
      const meta = await this.loadWorkspace(entry);
      if (meta) workspaces.push(meta);
    }
    return workspaces;
  }

  async loadWorkspace(workspaceId: string): Promise<WorkspaceMeta | null> {
    const metaPath = `${getWorkspaceDir(workspaceId)}/workspace.json`;
    try {
      const raw = await readFile(metaPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveWorkspace(meta: WorkspaceMeta): Promise<void> {
    const dir = getWorkspaceDir(meta.id);
    await mkdir(`${dir}/projects`, { recursive: true });
    meta.updatedAt = new Date().toISOString();
    await writeFile(`${dir}/workspace.json`, JSON.stringify(meta, null, 2));
  }

  async workspaceExists(workspaceId: string): Promise<boolean> {
    return existsSync(`${getWorkspaceDir(workspaceId)}/workspace.json`);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const dir = getWorkspaceDir(workspaceId);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true });
    }
  }

  /**
   * Find or create a workspace for a given repo root path.
   */
  async ensureWorkspace(repoRoot: string): Promise<WorkspaceMeta> {
    const absRoot = resolve(repoRoot);
    const wsId = workspaceIdFromPath(absRoot);
    const existing = await this.loadWorkspace(wsId);
    if (existing) return existing;

    const meta: WorkspaceMeta = {
      id: wsId,
      name: absRoot.split("/").pop() ?? wsId,
      repoRoot: absRoot,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveWorkspace(meta);
    return meta;
  }

  // ── CWD Resolution ──

  /**
   * Resolve workspace from current working directory.
   * Walks up from cwd to find a known workspace whose repoRoot matches.
   */
  async resolveWorkspaceFromCwd(
    cwd: string = process.cwd()
  ): Promise<WorkspaceMeta | null> {
    const workspaces = await this.listWorkspaces();
    const absCwd = resolve(cwd);

    // Find workspace whose repoRoot is cwd or a parent of cwd
    for (const ws of workspaces) {
      const absRoot = resolve(ws.repoRoot);
      if (absCwd === absRoot || absCwd.startsWith(absRoot + "/")) {
        return ws;
      }
    }
    return null;
  }

  // ── Project CRUD (workspace-scoped) ──

  async listProjects(workspaceId: string): Promise<ProjectMeta[]> {
    const dir = `${getWorkspaceDir(workspaceId)}/projects`;
    await mkdir(dir, { recursive: true });

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const projects: ProjectMeta[] = [];
    for (const entry of entries) {
      const meta = await this.loadProject(workspaceId, entry);
      if (meta) projects.push(meta);
    }
    return projects;
  }

  async loadProject(
    workspaceId: string,
    projectId: string
  ): Promise<ProjectMeta | null> {
    const metaPath = `${getProjectDir(workspaceId, projectId)}/project.json`;
    try {
      const raw = await readFile(metaPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveProject(
    workspaceId: string,
    meta: ProjectMeta
  ): Promise<void> {
    const dir = getProjectDir(workspaceId, meta.id);
    await mkdir(dir, { recursive: true });

    // Create standard subdirectories
    await mkdir(`${dir}/prompts`, { recursive: true });
    await mkdir(`${dir}/planning`, { recursive: true });
    await mkdir(`${dir}/source`, { recursive: true });
    await mkdir(`${dir}/sessions`, { recursive: true });

    meta.updatedAt = new Date().toISOString();
    await writeFile(`${dir}/project.json`, JSON.stringify(meta, null, 2));
  }

  async projectExists(
    workspaceId: string,
    projectId: string
  ): Promise<boolean> {
    return existsSync(
      `${getProjectDir(workspaceId, projectId)}/project.json`
    );
  }

  async deleteProject(
    workspaceId: string,
    projectId: string
  ): Promise<void> {
    const dir = getProjectDir(workspaceId, projectId);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true });
    }

    // Clear active if it was this project
    const ws = await this.loadWorkspace(workspaceId);
    if (ws && ws.activeProject === projectId) {
      ws.activeProject = undefined;
      await this.saveWorkspace(ws);
    }
  }

  // ── Active Project (per workspace) ──

  async getActiveProjectId(workspaceId: string): Promise<string | undefined> {
    const ws = await this.loadWorkspace(workspaceId);
    return ws?.activeProject;
  }

  async setActiveProject(
    workspaceId: string,
    projectId: string
  ): Promise<void> {
    const ws = await this.loadWorkspace(workspaceId);
    if (!ws) throw new Error(`Workspace "${workspaceId}" not found`);
    ws.activeProject = projectId;
    await this.saveWorkspace(ws);
  }

  /**
   * Get config path for active project in a workspace.
   */
  async getActiveConfigPath(workspaceId: string): Promise<string | null> {
    const activeId = await this.getActiveProjectId(workspaceId);
    if (!activeId) return null;

    const configPath = `${getProjectDir(workspaceId, activeId)}/autopilot.config.ts`;
    return existsSync(configPath) ? configPath : null;
  }

  // ── File helpers ──

  async writeProjectFile(
    workspaceId: string,
    projectId: string,
    filename: string,
    content: string
  ): Promise<string> {
    const dir = getProjectDir(workspaceId, projectId);
    const filePath = `${dir}/${filename}`;
    await mkdir(resolve(filePath, ".."), { recursive: true });
    await writeFile(filePath, content);
    return filePath;
  }

  async readProjectFile(
    workspaceId: string,
    projectId: string,
    filename: string
  ): Promise<string | null> {
    const filePath = `${getProjectDir(workspaceId, projectId)}/${filename}`;
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  getProjectPath(workspaceId: string, projectId: string): string {
    return getProjectDir(workspaceId, projectId);
  }

  // ── Sessions ──

  async listSessions(
    workspaceId: string,
    projectId: string
  ): Promise<SessionMeta[]> {
    const dir = getSessionsDir(workspaceId, projectId);
    await mkdir(dir, { recursive: true });

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const sessions: SessionMeta[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = await readFile(`${dir}/${entry}`, "utf-8");
        sessions.push(JSON.parse(raw));
      } catch {
        // skip malformed session files
      }
    }

    // Sort by startedAt descending
    sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return sessions;
  }

  async saveSession(
    workspaceId: string,
    projectId: string,
    session: SessionMeta
  ): Promise<void> {
    const dir = getSessionsDir(workspaceId, projectId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}/${session.id}.json`,
      JSON.stringify(session, null, 2)
    );
  }

  async loadSession(
    workspaceId: string,
    projectId: string,
    sessionId: string
  ): Promise<SessionMeta | null> {
    const filePath = `${getSessionsDir(workspaceId, projectId)}/${sessionId}.json`;
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
