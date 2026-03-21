import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { WorkspaceManager } from "../src/workspace/manager.js";
import { getProjectDir, workspaceIdFromPath } from "../src/workspace/types.js";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * Integration test: verifies the full flow from project init through
 * workspace creation, config generation, project selection, and
 * engine loading — the complete slice described in the MVP.
 */

const TEST_HOME = "/tmp/qap-flow-test-" + Date.now();
const TEST_REPO = `${TEST_HOME}/fake-repo`;
const origHome = process.env.HOME;

beforeEach(async () => {
  process.env.HOME = TEST_HOME;
  await mkdir(TEST_HOME, { recursive: true });
  // Create a fake repo with some files
  await mkdir(TEST_REPO, { recursive: true });
  await writeFile(`${TEST_REPO}/package.json`, JSON.stringify({ name: "test-repo" }));
  await writeFile(`${TEST_REPO}/README.md`, "# Test Repo");
});

afterEach(async () => {
  process.env.HOME = origHome;
  if (existsSync(TEST_HOME)) {
    await rm(TEST_HOME, { recursive: true });
  }
});

describe("Full MVP Flow", () => {
  test("flow: init project → workspace created → project selectable → engine loadable", async () => {
    const ws = new WorkspaceManager();

    // Step 1: Ensure workspace from repo path
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    const wsId = workspace.id;

    // Step 2: No projects initially
    const before = await ws.listProjects(wsId);
    expect(before).toEqual([]);
    expect(await ws.getActiveProjectId(wsId)).toBeUndefined();

    // Step 3: Create project workspace manually (simulates AI fallback)
    const projectId = "test-project";
    const projectDir = getProjectDir(wsId, projectId);

    await ws.saveProject(wsId, {
      id: projectId,
      name: "Test Project",
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: { mode: "init" },
    });

    // Step 4: Verify workspace structure created
    expect(existsSync(`${projectDir}/project.json`)).toBe(true);
    expect(existsSync(`${projectDir}/prompts`)).toBe(true);
    expect(existsSync(`${projectDir}/planning`)).toBe(true);
    expect(existsSync(`${projectDir}/source`)).toBe(true);
    expect(existsSync(`${projectDir}/sessions`)).toBe(true);

    // Step 5: Write config file
    const configContent = `
import type { ProjectConfig } from "../../../src/core/types.js";

const config: ProjectConfig = {
  project: {
    id: "${projectId}",
    name: "Test Project",
    rootDir: "${TEST_REPO}",
  },
  execution: {
    mode: "autonomous",
    defaultProvider: "claude",
    defaultPermissionProfile: "elevated",
  },
  prompts: {},
  epics: [
    { id: "EPIC-001", title: "Test Epic", track: "main" },
  ],
  tasks: [
    {
      id: "TASK-001",
      title: "First task",
      epicId: "EPIC-001",
      kind: "implementation",
      track: "main",
    },
    {
      id: "TASK-002",
      title: "Second task",
      epicId: "EPIC-001",
      kind: "implementation",
      track: "main",
      dependsOn: ["TASK-001"],
    },
  ],
};
export default config;
`;
    await ws.writeProjectFile(wsId, projectId, "autopilot.config.ts", configContent);
    expect(existsSync(`${projectDir}/autopilot.config.ts`)).toBe(true);

    // Step 6: Write handoff
    await ws.writeProjectFile(
      wsId,
      projectId,
      "handoff.md",
      "# Handoff\n\nProject initialized for testing."
    );
    expect(existsSync(`${projectDir}/handoff.md`)).toBe(true);

    // Step 7: Set as active project
    await ws.setActiveProject(wsId, projectId);
    expect(await ws.getActiveProjectId(wsId)).toBe(projectId);

    // Step 8: List projects shows it
    const projects = await ws.listProjects(wsId);
    expect(projects.length).toBe(1);
    expect(projects[0]!.id).toBe(projectId);
    expect(projects[0]!.name).toBe("Test Project");

    // Step 9: Load config via engine loader
    const configPath = `${projectDir}/autopilot.config.ts`;
    const { loadConfig } = await import("../src/config/loader.js");
    const config = await loadConfig(configPath);

    expect(config.project.id).toBe(projectId);
    expect(config.project.name).toBe("Test Project");
    expect(config.tasks.length).toBe(2);
    expect(config.epics.length).toBe(1);

    // Step 10: Readiness engine works with loaded config
    const { findReadyTasks, whatUnblocks } = await import(
      "../src/core/readiness.js"
    );
    const { Store } = await import("../src/storage/store.js");

    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const task of config.tasks) {
      store.initTask(task.id);
    }

    const allStates = store.getAllTasks();
    const ready = findReadyTasks(config.tasks, allStates);

    // Only TASK-001 should be ready (TASK-002 depends on it)
    expect(ready.length).toBe(1);
    expect(ready[0]!.id).toBe("TASK-001");

    // Step 11: whatUnblocks shows TASK-002 unblocked by TASK-001
    const unlocks = whatUnblocks("TASK-001", config.tasks, allStates);
    expect(unlocks.length).toBe(1);
    expect(unlocks[0]!.id).toBe("TASK-002");

    // Step 12: State machine works
    const { transition } = await import("../src/core/state.js");
    let taskState = store.getTask("TASK-001")!;
    taskState = transition(taskState, "ready");
    expect(taskState.state).toBe("ready");
    taskState = transition(taskState, "in_progress");
    expect(taskState.state).toBe("in_progress");
    expect(taskState.startedAt).toBeDefined();

    // Step 13: Verify active config path resolution
    const activePath = await ws.getActiveConfigPath(wsId);
    expect(activePath).toBe(configPath);

    // Step 14: CWD resolution works
    const resolved = await ws.resolveWorkspaceFromCwd(TEST_REPO);
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(wsId);
  });

  test("flow: project use switches active project", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    const wsId = workspace.id;

    // Create two projects
    await ws.saveProject(wsId, {
      id: "proj-alpha",
      name: "Alpha",
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await ws.saveProject(wsId, {
      id: "proj-beta",
      name: "Beta",
      repoRoot: TEST_REPO,
      provider: "codex",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Use alpha
    await ws.setActiveProject(wsId, "proj-alpha");
    expect(await ws.getActiveProjectId(wsId)).toBe("proj-alpha");

    // Switch to beta
    await ws.setActiveProject(wsId, "proj-beta");
    expect(await ws.getActiveProjectId(wsId)).toBe("proj-beta");

    // Load beta
    const meta = await ws.loadProject(wsId, "proj-beta");
    expect(meta!.provider).toBe("codex");
  });

  test("flow: project delete cleans up active pointer", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    const wsId = workspace.id;

    await ws.saveProject(wsId, {
      id: "temp",
      name: "Temp",
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ws.setActiveProject(wsId, "temp");
    expect(await ws.getActiveProjectId(wsId)).toBe("temp");

    await ws.deleteProject(wsId, "temp");
    expect(await ws.getActiveProjectId(wsId)).toBeUndefined();
    expect(await ws.projectExists(wsId, "temp")).toBe(false);
  });

  test("flow: workspace file I/O for project artifacts", async () => {
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    const wsId = workspace.id;

    await ws.saveProject(wsId, {
      id: "artifacts",
      name: "Artifacts Test",
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Write multiple project files
    await ws.writeProjectFile(wsId, "artifacts", "state.json", '{"tasks":{}}');
    await ws.writeProjectFile(wsId, "artifacts", "session-log.md", "# Session\n");
    await ws.writeProjectFile(wsId, "artifacts", "events.jsonl", "");
    await ws.writeProjectFile(
      wsId,
      "artifacts",
      "prompts/task-001.md",
      "# Task 001\nImplement feature X"
    );

    // Read them back
    const state = await ws.readProjectFile(wsId, "artifacts", "state.json");
    expect(state).toBe('{"tasks":{}}');

    const prompt = await ws.readProjectFile(wsId, "artifacts", "prompts/task-001.md");
    expect(prompt).toContain("Implement feature X");

    // Missing file returns null
    const missing = await ws.readProjectFile(wsId, "artifacts", "nope.txt");
    expect(missing).toBeNull();
  });
});
