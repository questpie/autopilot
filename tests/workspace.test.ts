import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { WorkspaceManager } from "../src/workspace/manager.js";
import {
  getWorkspaceDir,
  getProjectDir,
  workspaceIdFromPath,
} from "../src/workspace/types.js";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ProjectMeta, WorkspaceMeta } from "../src/workspace/types.js";

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

// ── Path Helpers ──

describe("workspaceIdFromPath", () => {
  test("slugifies absolute path", () => {
    expect(workspaceIdFromPath("/Users/dev/repos/my-app")).toBe(
      "users-dev-repos-my-app"
    );
  });

  test("handles nested paths", () => {
    expect(workspaceIdFromPath("/home/user/projects/foo/bar")).toBe(
      "home-user-projects-foo-bar"
    );
  });
});

// ── Workspace CRUD ──

describe("WorkspaceManager — workspaces", () => {
  test("ensureRoot creates workspaces directory", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureRoot();
    expect(existsSync(`${TEST_HOME}/.qap/workspaces`)).toBe(true);
  });

  test("listWorkspaces returns empty array when none", async () => {
    const ws = new WorkspaceManager();
    const list = await ws.listWorkspaces();
    expect(list).toEqual([]);
  });

  test("saveWorkspace and loadWorkspace roundtrip", async () => {
    const ws = new WorkspaceManager();
    const meta: WorkspaceMeta = {
      id: "test-ws",
      name: "test-repo",
      repoRoot: "/tmp/test-repo",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await ws.saveWorkspace(meta);
    const loaded = await ws.loadWorkspace("test-ws");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("test-ws");
    expect(loaded!.name).toBe("test-repo");
    expect(loaded!.repoRoot).toBe("/tmp/test-repo");
  });

  test("workspaceExists returns false for missing", async () => {
    const ws = new WorkspaceManager();
    expect(await ws.workspaceExists("nonexistent")).toBe(false);
  });

  test("workspaceExists returns true for existing", async () => {
    const ws = new WorkspaceManager();
    await ws.saveWorkspace({
      id: "exists-ws",
      name: "exists",
      repoRoot: "/tmp/exists",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(await ws.workspaceExists("exists-ws")).toBe(true);
  });

  test("ensureWorkspace creates new workspace from path", async () => {
    const ws = new WorkspaceManager();
    const result = await ws.ensureWorkspace("/tmp/my-repo");
    expect(result.repoRoot).toBe("/tmp/my-repo");
    expect(result.name).toBe("my-repo");
    expect(await ws.workspaceExists(result.id)).toBe(true);
  });

  test("ensureWorkspace returns existing workspace", async () => {
    const ws = new WorkspaceManager();
    const first = await ws.ensureWorkspace("/tmp/my-repo");
    const second = await ws.ensureWorkspace("/tmp/my-repo");
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
  });

  test("deleteWorkspace removes workspace", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureWorkspace("/tmp/to-delete");
    const id = workspaceIdFromPath("/tmp/to-delete");
    await ws.deleteWorkspace(id);
    expect(await ws.workspaceExists(id)).toBe(false);
  });

  test("listWorkspaces returns all saved", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureWorkspace("/tmp/repo-a");
    await ws.ensureWorkspace("/tmp/repo-b");
    const list = await ws.listWorkspaces();
    expect(list.length).toBe(2);
  });
});

// ── CWD Resolution ──

describe("WorkspaceManager — CWD resolution", () => {
  test("resolveWorkspaceFromCwd finds matching workspace", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureWorkspace("/tmp/my-project");
    const found = await ws.resolveWorkspaceFromCwd("/tmp/my-project");
    expect(found).not.toBeNull();
    expect(found!.repoRoot).toBe("/tmp/my-project");
  });

  test("resolveWorkspaceFromCwd finds workspace from subdirectory", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureWorkspace("/tmp/my-project");
    const found = await ws.resolveWorkspaceFromCwd(
      "/tmp/my-project/src/components"
    );
    expect(found).not.toBeNull();
    expect(found!.repoRoot).toBe("/tmp/my-project");
  });

  test("resolveWorkspaceFromCwd returns null for unknown path", async () => {
    const ws = new WorkspaceManager();
    await ws.ensureWorkspace("/tmp/my-project");
    const found = await ws.resolveWorkspaceFromCwd("/tmp/other-dir");
    expect(found).toBeNull();
  });
});

// ── Multi-Project Per Workspace ──

describe("WorkspaceManager — projects", () => {
  const WS_ID = "test-workspace";

  async function setupWorkspace() {
    const ws = new WorkspaceManager();
    await ws.saveWorkspace({
      id: WS_ID,
      name: "test-repo",
      repoRoot: "/tmp/test-repo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return ws;
  }

  function makeMeta(id: string, name: string): ProjectMeta {
    return {
      id,
      name,
      repoRoot: "/tmp/test-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  test("listProjects returns empty array when no projects", async () => {
    const ws = await setupWorkspace();
    const projects = await ws.listProjects(WS_ID);
    expect(projects).toEqual([]);
  });

  test("saveProject and loadProject roundtrip", async () => {
    const ws = await setupWorkspace();
    await ws.saveProject(WS_ID, makeMeta("proj-a", "Project A"));
    const loaded = await ws.loadProject(WS_ID, "proj-a");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("proj-a");
    expect(loaded!.name).toBe("Project A");
  });

  test("multiple projects in same workspace", async () => {
    const ws = await setupWorkspace();
    await ws.saveProject(WS_ID, makeMeta("proj-a", "Project A"));
    await ws.saveProject(WS_ID, makeMeta("proj-b", "Project B"));

    const projects = await ws.listProjects(WS_ID);
    expect(projects.length).toBe(2);
    const ids = projects.map((p) => p.id).sort();
    expect(ids).toEqual(["proj-a", "proj-b"]);
  });

  test("projectExists returns false for missing project", async () => {
    const ws = await setupWorkspace();
    expect(await ws.projectExists(WS_ID, "nonexistent")).toBe(false);
  });

  test("projectExists returns true for existing project", async () => {
    const ws = await setupWorkspace();
    await ws.saveProject(WS_ID, makeMeta("exists", "Exists"));
    expect(await ws.projectExists(WS_ID, "exists")).toBe(true);
  });

  test("deleteProject removes project and clears active", async () => {
    const ws = await setupWorkspace();
    await ws.saveProject(WS_ID, makeMeta("to-delete", "Delete Me"));
    await ws.setActiveProject(WS_ID, "to-delete");

    await ws.deleteProject(WS_ID, "to-delete");
    expect(await ws.projectExists(WS_ID, "to-delete")).toBe(false);
    expect(await ws.getActiveProjectId(WS_ID)).toBeUndefined();
  });

  test("saveProject creates standard subdirectories", async () => {
    const ws = await setupWorkspace();
    await ws.saveProject(WS_ID, makeMeta("with-dirs", "With Dirs"));

    const dir = getProjectDir(WS_ID, "with-dirs");
    expect(existsSync(`${dir}/prompts`)).toBe(true);
    expect(existsSync(`${dir}/planning`)).toBe(true);
    expect(existsSync(`${dir}/source`)).toBe(true);
    expect(existsSync(`${dir}/sessions`)).toBe(true);
  });

  // ── Active Project Per Workspace ──

  test("active project is per-workspace", async () => {
    const ws = new WorkspaceManager();
    await ws.saveWorkspace({
      id: "ws-1",
      name: "repo-1",
      repoRoot: "/tmp/repo-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.saveWorkspace({
      id: "ws-2",
      name: "repo-2",
      repoRoot: "/tmp/repo-2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ws.saveProject("ws-1", makeMeta("proj-x", "X"));
    await ws.saveProject("ws-2", makeMeta("proj-y", "Y"));

    await ws.setActiveProject("ws-1", "proj-x");
    await ws.setActiveProject("ws-2", "proj-y");

    expect(await ws.getActiveProjectId("ws-1")).toBe("proj-x");
    expect(await ws.getActiveProjectId("ws-2")).toBe("proj-y");
  });

  // ── File Helpers ──

  test("writeProjectFile and readProjectFile", async () => {
    const ws = await setupWorkspace();
    await ws.saveProject(WS_ID, makeMeta("file-test", "File Test"));

    await ws.writeProjectFile(WS_ID, "file-test", "test.txt", "hello world");
    const content = await ws.readProjectFile(WS_ID, "file-test", "test.txt");
    expect(content).toBe("hello world");
  });

  test("readProjectFile returns null for missing file", async () => {
    const ws = new WorkspaceManager();
    const content = await ws.readProjectFile("missing", "proj", "nope.txt");
    expect(content).toBeNull();
  });
});

// ── Sessions ──

describe("WorkspaceManager — sessions", () => {
  test("listSessions returns empty when no sessions", async () => {
    const ws = new WorkspaceManager();
    await ws.saveWorkspace({
      id: "sess-ws",
      name: "sess-repo",
      repoRoot: "/tmp/sess-repo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.saveProject("sess-ws", {
      id: "sess-proj",
      name: "Sess Project",
      repoRoot: "/tmp/sess-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const sessions = await ws.listSessions("sess-ws", "sess-proj");
    expect(sessions).toEqual([]);
  });

  test("saveSession and listSessions roundtrip", async () => {
    const ws = new WorkspaceManager();
    await ws.saveWorkspace({
      id: "sess-ws",
      name: "sess-repo",
      repoRoot: "/tmp/sess-repo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.saveProject("sess-ws", {
      id: "sess-proj",
      name: "Sess Project",
      repoRoot: "/tmp/sess-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ws.saveSession("sess-ws", "sess-proj", {
      id: "session-001",
      projectId: "sess-proj",
      workspaceId: "sess-ws",
      startedAt: "2024-01-01T00:00:00.000Z",
      status: "completed",
      provider: "claude",
      taskCount: 5,
      tasksCompleted: 4,
      tasksFailed: 1,
      notes: [],
    });

    const sessions = await ws.listSessions("sess-ws", "sess-proj");
    expect(sessions.length).toBe(1);
    expect(sessions[0]!.id).toBe("session-001");
    expect(sessions[0]!.status).toBe("completed");
  });

  test("sessions are sorted by startedAt descending", async () => {
    const ws = new WorkspaceManager();
    await ws.saveWorkspace({
      id: "sess-ws2",
      name: "sess-repo2",
      repoRoot: "/tmp/sess-repo2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.saveProject("sess-ws2", {
      id: "sess-proj2",
      name: "Sess Project 2",
      repoRoot: "/tmp/sess-repo2",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ws.saveSession("sess-ws2", "sess-proj2", {
      id: "older",
      projectId: "sess-proj2",
      workspaceId: "sess-ws2",
      startedAt: "2024-01-01T00:00:00.000Z",
      status: "completed",
      provider: "claude",
      taskCount: 3,
      tasksCompleted: 3,
      tasksFailed: 0,
      notes: [],
    });
    await ws.saveSession("sess-ws2", "sess-proj2", {
      id: "newer",
      projectId: "sess-proj2",
      workspaceId: "sess-ws2",
      startedAt: "2024-06-01T00:00:00.000Z",
      status: "running",
      provider: "claude",
      taskCount: 5,
      tasksCompleted: 2,
      tasksFailed: 0,
      notes: [],
    });

    const sessions = await ws.listSessions("sess-ws2", "sess-proj2");
    expect(sessions[0]!.id).toBe("newer");
    expect(sessions[1]!.id).toBe("older");
  });
});

// ── Import/Init Same Workspace Different Projects ──

describe("WorkspaceManager — import/init same workspace", () => {
  test("two projects can exist in one workspace with different names", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace("/tmp/shared-repo");

    await ws.saveProject(workspace.id, {
      id: "project-alpha",
      name: "Alpha",
      repoRoot: "/tmp/shared-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: { mode: "init" },
    });

    await ws.saveProject(workspace.id, {
      id: "project-beta",
      name: "Beta",
      repoRoot: "/tmp/shared-repo",
      provider: "codex",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: { mode: "import" },
    });

    const projects = await ws.listProjects(workspace.id);
    expect(projects.length).toBe(2);

    // Each has isolated artifacts
    await ws.writeProjectFile(workspace.id, "project-alpha", "test.txt", "alpha");
    await ws.writeProjectFile(workspace.id, "project-beta", "test.txt", "beta");

    expect(
      await ws.readProjectFile(workspace.id, "project-alpha", "test.txt")
    ).toBe("alpha");
    expect(
      await ws.readProjectFile(workspace.id, "project-beta", "test.txt")
    ).toBe("beta");
  });
});

// ── Steering Notes ──

describe("WorkspaceManager — steering notes", () => {
  test("can write and read project steering", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace("/tmp/steer-repo");
    await ws.saveProject(workspace.id, {
      id: "steer-proj",
      name: "Steer Project",
      repoRoot: "/tmp/steer-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Initially empty
    const empty = await ws.readSteering(workspace.id, "steer-proj");
    expect(empty).toBeNull();

    // Write steering
    await ws.appendSteering(workspace.id, "steer-proj", "Focus on type safety");
    const content = await ws.readSteering(workspace.id, "steer-proj");
    expect(content).toContain("Focus on type safety");
    expect(content).toContain("# Project Steering Notes");

    // Append more
    await ws.appendSteering(workspace.id, "steer-proj", "Avoid any-casts");
    const updated = await ws.readSteering(workspace.id, "steer-proj");
    expect(updated).toContain("Focus on type safety");
    expect(updated).toContain("Avoid any-casts");
  });

  test("can add session notes", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace("/tmp/sessnote-repo");
    await ws.saveProject(workspace.id, {
      id: "sessnote-proj",
      name: "SessNote Project",
      repoRoot: "/tmp/sessnote-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ws.saveSession(workspace.id, "sessnote-proj", {
      id: "sess-note-001",
      projectId: "sessnote-proj",
      workspaceId: workspace.id,
      startedAt: new Date().toISOString(),
      status: "running",
      provider: "claude",
      taskCount: 3,
      tasksCompleted: 0,
      tasksFailed: 0,
      notes: [],
    });

    await ws.addSessionNote(workspace.id, "sessnote-proj", "sess-note-001", "Be careful with auth");
    const session = await ws.loadSession(workspace.id, "sessnote-proj", "sess-note-001");
    expect(session).not.toBeNull();
    expect(session!.notes.length).toBe(1);
    expect(session!.notes[0]).toContain("Be careful with auth");
  });

  test("session record includes all new fields", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace("/tmp/sessfields-repo");
    await ws.saveProject(workspace.id, {
      id: "sessfields-proj",
      name: "Fields Project",
      repoRoot: "/tmp/sessfields-repo",
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const session = {
      id: "sess-fields-001",
      projectId: "sessfields-proj",
      workspaceId: workspace.id,
      startedAt: new Date().toISOString(),
      status: "running" as const,
      provider: "claude",
      taskCount: 5,
      tasksCompleted: 2,
      tasksFailed: 1,
      currentTaskId: "TASK-003",
      lastEventAt: new Date().toISOString(),
      eventLogPath: "/tmp/events.jsonl",
      changelogPath: "/tmp/changelog.md",
      notes: ["note1"],
    };

    await ws.saveSession(workspace.id, "sessfields-proj", session);
    const loaded = await ws.loadSession(workspace.id, "sessfields-proj", "sess-fields-001");

    expect(loaded).not.toBeNull();
    expect(loaded!.workspaceId).toBe(workspace.id);
    expect(loaded!.provider).toBe("claude");
    expect(loaded!.currentTaskId).toBe("TASK-003");
    expect(loaded!.lastEventAt).toBeDefined();
    expect(loaded!.eventLogPath).toBe("/tmp/events.jsonl");
    expect(loaded!.changelogPath).toBe("/tmp/changelog.md");
    expect(loaded!.notes).toEqual(["note1"]);
  });
});
