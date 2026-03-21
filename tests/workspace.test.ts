import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { WorkspaceManager } from "../src/workspace/manager.js";
import { getQapRoot, getProjectDir } from "../src/workspace/types.js";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ProjectMeta } from "../src/workspace/types.js";

// Use a temp directory for tests
const TEST_HOME = "/tmp/qap-test-" + Date.now();
const origHome = process.env.HOME;

beforeEach(async () => {
  process.env.HOME = TEST_HOME;
  await mkdir(TEST_HOME, { recursive: true });
});

afterEach(async () => {
  process.env.HOME = origHome;
  if (existsSync(TEST_HOME)) {
    await rm(TEST_HOME, { recursive: true });
  }
});

describe("WorkspaceManager", () => {
  test("ensureRoot creates .qap directory", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureRoot();
    expect(existsSync(`${TEST_HOME}/.qap/projects`)).toBe(true);
  });

  test("listProjects returns empty array when no projects", async () => {
    const ws = new WorkspaceManager();
    const projects = await ws.listProjects();
    expect(projects).toEqual([]);
  });

  test("saveProject and loadProject roundtrip", async () => {
    const ws = new WorkspaceManager();
    const meta: ProjectMeta = {
      id: "test-project",
      name: "Test Project",
      repoRoot: "/tmp/repo",
      provider: "claude",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await ws.saveProject(meta);
    const loaded = await ws.loadProject("test-project");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("test-project");
    expect(loaded!.name).toBe("Test Project");
    expect(loaded!.provider).toBe("claude");
  });

  test("projectExists returns false for missing project", async () => {
    const ws = new WorkspaceManager();
    expect(await ws.projectExists("nonexistent")).toBe(false);
  });

  test("projectExists returns true for existing project", async () => {
    const ws = new WorkspaceManager();
    await ws.saveProject({
      id: "exists",
      name: "Exists",
      repoRoot: "/tmp",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(await ws.projectExists("exists")).toBe(true);
  });

  test("setActiveProject and getActiveProjectId", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureRoot();
    expect(await ws.getActiveProjectId()).toBeUndefined();

    await ws.setActiveProject("my-project");
    expect(await ws.getActiveProjectId()).toBe("my-project");
  });

  test("listProjects returns all saved projects", async () => {
    const ws = new WorkspaceManager();
    await ws.saveProject({
      id: "proj-a",
      name: "Project A",
      repoRoot: "/a",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.saveProject({
      id: "proj-b",
      name: "Project B",
      repoRoot: "/b",
      provider: "codex",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const projects = await ws.listProjects();
    expect(projects.length).toBe(2);
    const ids = projects.map((p) => p.id).sort();
    expect(ids).toEqual(["proj-a", "proj-b"]);
  });

  test("deleteProject removes project and clears active", async () => {
    const ws = new WorkspaceManager();
    await ws.saveProject({
      id: "to-delete",
      name: "Delete Me",
      repoRoot: "/tmp",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.setActiveProject("to-delete");

    await ws.deleteProject("to-delete");
    expect(await ws.projectExists("to-delete")).toBe(false);
    expect(await ws.getActiveProjectId()).toBeUndefined();
  });

  test("writeProjectFile and readProjectFile", async () => {
    const ws = new WorkspaceManager();
    await ws.saveProject({
      id: "file-test",
      name: "File Test",
      repoRoot: "/tmp",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ws.writeProjectFile("file-test", "test.txt", "hello world");
    const content = await ws.readProjectFile("file-test", "test.txt");
    expect(content).toBe("hello world");
  });

  test("readProjectFile returns null for missing file", async () => {
    const ws = new WorkspaceManager();
    const content = await ws.readProjectFile("missing", "nope.txt");
    expect(content).toBeNull();
  });

  test("saveProject creates subdirectories", async () => {
    const ws = new WorkspaceManager();
    await ws.saveProject({
      id: "with-dirs",
      name: "With Dirs",
      repoRoot: "/tmp",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const dir = getProjectDir("with-dirs");
    expect(existsSync(`${dir}/prompts`)).toBe(true);
    expect(existsSync(`${dir}/planning`)).toBe(true);
    expect(existsSync(`${dir}/source`)).toBe(true);
  });
});
