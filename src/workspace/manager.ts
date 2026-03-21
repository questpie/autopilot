import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectMeta, WorkspaceGlobal } from "./types.js";
import {
  getQapRoot,
  getProjectDir,
  PROJECTS_DIR,
  GLOBAL_CONFIG_FILE,
} from "./types.js";

// ── Workspace Manager ───────────────────────────────────────

export class WorkspaceManager {
  private root: string;

  constructor() {
    this.root = getQapRoot();
  }

  async ensureRoot(): Promise<void> {
    await mkdir(`${this.root}/${PROJECTS_DIR}`, { recursive: true });
  }

  // ── Global Config ──

  private globalPath(): string {
    return `${this.root}/${GLOBAL_CONFIG_FILE}`;
  }

  async loadGlobal(): Promise<WorkspaceGlobal> {
    try {
      const raw = await readFile(this.globalPath(), "utf-8");
      return JSON.parse(raw);
    } catch {
      return { version: 1 };
    }
  }

  async saveGlobal(config: WorkspaceGlobal): Promise<void> {
    await this.ensureRoot();
    await writeFile(this.globalPath(), JSON.stringify(config, null, 2));
  }

  // ── Active Project ──

  async getActiveProjectId(): Promise<string | undefined> {
    const global = await this.loadGlobal();
    return global.activeProject;
  }

  async setActiveProject(projectId: string): Promise<void> {
    const global = await this.loadGlobal();
    global.activeProject = projectId;
    await this.saveGlobal(global);
  }

  // ── Project CRUD ──

  async listProjects(): Promise<ProjectMeta[]> {
    await this.ensureRoot();
    const dir = `${this.root}/${PROJECTS_DIR}`;

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const projects: ProjectMeta[] = [];
    for (const entry of entries) {
      const meta = await this.loadProject(entry);
      if (meta) projects.push(meta);
    }

    return projects;
  }

  async loadProject(projectId: string): Promise<ProjectMeta | null> {
    const metaPath = `${getProjectDir(projectId)}/project.json`;
    try {
      const raw = await readFile(metaPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveProject(meta: ProjectMeta): Promise<void> {
    const dir = getProjectDir(meta.id);
    await mkdir(dir, { recursive: true });

    // Create standard subdirectories
    await mkdir(`${dir}/prompts`, { recursive: true });
    await mkdir(`${dir}/planning`, { recursive: true });
    await mkdir(`${dir}/source`, { recursive: true });

    meta.updatedAt = new Date().toISOString();
    await writeFile(`${dir}/project.json`, JSON.stringify(meta, null, 2));
  }

  async projectExists(projectId: string): Promise<boolean> {
    return existsSync(`${getProjectDir(projectId)}/project.json`);
  }

  async deleteProject(projectId: string): Promise<void> {
    const dir = getProjectDir(projectId);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true });
    }

    // Clear active if it was this project
    const global = await this.loadGlobal();
    if (global.activeProject === projectId) {
      global.activeProject = undefined;
      await this.saveGlobal(global);
    }
  }

  // ── File helpers ──

  async writeProjectFile(
    projectId: string,
    filename: string,
    content: string
  ): Promise<string> {
    const dir = getProjectDir(projectId);
    const filePath = `${dir}/${filename}`;
    await mkdir(resolve(filePath, ".."), { recursive: true });
    await writeFile(filePath, content);
    return filePath;
  }

  async readProjectFile(
    projectId: string,
    filename: string
  ): Promise<string | null> {
    const filePath = `${getProjectDir(projectId)}/${filename}`;
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  getProjectPath(projectId: string): string {
    return getProjectDir(projectId);
  }

  // ── Load active project's config path ──

  async getActiveConfigPath(): Promise<string | null> {
    const activeId = await this.getActiveProjectId();
    if (!activeId) return null;

    const configPath = `${getProjectDir(activeId)}/autopilot.config.ts`;
    return existsSync(configPath) ? configPath : null;
  }
}
