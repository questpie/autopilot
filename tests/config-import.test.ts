import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { WorkspaceManager } from "../src/workspace/manager.js";
import { getProjectDir } from "../src/workspace/types.js";
import { loadConfig } from "../src/config/loader.js";
import { Store } from "../src/storage/store.js";
import {
  loadBacklog,
  compileBacklogToConfig,
  detectBacklog,
  type BacklogManifest,
} from "../src/config/backlog.js";
import { rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { ProjectMeta } from "../src/workspace/types.js";

// Use a temp directory for tests
const TEST_HOME = "/tmp/qap-config-test-" + Date.now();
const TEST_REPO = `${TEST_HOME}/fake-repo`;
const origHome = process.env.HOME;

beforeEach(async () => {
  process.env.HOME = TEST_HOME;
  await mkdir(TEST_HOME, { recursive: true });
  await mkdir(TEST_REPO, { recursive: true });
});

afterEach(async () => {
  process.env.HOME = origHome;
  if (existsSync(TEST_HOME)) {
    await rm(TEST_HOME, { recursive: true });
  }
});

// ── Helpers ──

async function setupProjectWithConfig(
  projectId: string,
  configContent: string
): Promise<{ ws: WorkspaceManager; workspaceId: string; configPath: string }> {
  const ws = new WorkspaceManager();
  const workspace = await ws.ensureWorkspace(TEST_REPO);

  const meta: ProjectMeta = {
    id: projectId,
    name: projectId,
    repoRoot: TEST_REPO,
    provider: "claude",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: { mode: "import" },
  };
  await ws.saveProject(workspace.id, meta);
  await ws.writeProjectFile(
    workspace.id,
    projectId,
    "autopilot.config.ts",
    configContent
  );

  const configPath = `${getProjectDir(workspace.id, projectId)}/autopilot.config.ts`;
  return { ws, workspaceId: workspace.id, configPath };
}

function makeValidConfig(projectId: string, repoRoot: string, outputDir: string): string {
  const relRoot = relative(outputDir, repoRoot) || ".";
  return `import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: {
    id: "${projectId}",
    name: "${projectId}",
    rootDir: "${relRoot}",
  },
  execution: {
    mode: "autonomous",
    defaultProvider: "claude",
    defaultPermissionProfile: "elevated",
    stopOnFailure: true,
    validateAfterEachTask: true,
  },
  prompts: {
    templatesDir: "./prompts",
  },
  epics: [
    {
      id: "EPIC-001",
      title: "${projectId}",
      track: "main",
    },
  ],
  tasks: [
    {
      id: "TASK-001",
      title: "Initial setup",
      epicId: "EPIC-001",
      kind: "implementation" as const,
      track: "main" as const,
    },
  ],
};

export default config;
`;
}

// ── Config Shape Tests ──

describe("Config import — qap-native format", () => {
  test("valid qap-native config loads successfully", async () => {
    const projectId = "valid-project";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const configContent = makeValidConfig(projectId, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", configContent);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    expect(config.project.id).toBe(projectId);
    expect(config.project.name).toBe(projectId);
    expect(config.execution.defaultProvider).toBe("claude");
    expect(config.execution.mode).toBe("autonomous");
    expect(config.tasks.length).toBeGreaterThanOrEqual(1);
    expect(config.epics.length).toBeGreaterThanOrEqual(1);
  });

  test("config must not import from @anthropic-ai/claude-code", async () => {
    const projectId = "bad-import-project";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const validConfig = makeValidConfig(projectId, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", validConfig);

    // Read the generated config and verify no banned imports
    const configPath = `${outputDir}/autopilot.config.ts`;
    const content = await readFile(configPath, "utf-8");

    expect(content).not.toContain("@anthropic-ai/claude-code");
    expect(content).not.toContain("defineConfig");
  });

  test("config with prompt file references loads correctly", async () => {
    const projectId = "prompt-ref-project";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const relRoot = relative(outputDir, TEST_REPO) || ".";

    // Create prompt files
    const promptsDir = `${outputDir}/prompts`;
    await mkdir(promptsDir, { recursive: true });
    await writeFile(`${promptsDir}/001-setup.md`, "# Setup task prompt");
    await writeFile(`${promptsDir}/002-auth.md`, "# Auth task prompt");

    const configContent = `import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: {
    id: "${projectId}",
    name: "${projectId}",
    rootDir: "${relRoot}",
  },
  execution: {
    mode: "autonomous",
    defaultProvider: "claude",
    defaultPermissionProfile: "elevated",
  },
  prompts: {
    templatesDir: "./prompts",
  },
  epics: [
    { id: "EPIC-001", title: "Core", track: "main" },
  ],
  tasks: [
    {
      id: "TASK-001",
      title: "setup",
      epicId: "EPIC-001",
      kind: "implementation" as const,
      track: "main" as const,
      promptFile: "./prompts/001-setup.md",
    },
    {
      id: "TASK-002",
      title: "auth",
      epicId: "EPIC-001",
      kind: "implementation" as const,
      track: "main" as const,
      promptFile: "./prompts/002-auth.md",
      dependsOn: ["TASK-001"],
    },
  ],
};

export default config;
`;

    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", configContent);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    expect(config.tasks.length).toBe(2);
    expect(config.tasks[0]!.promptFile).toContain("001-setup.md");
    expect(config.tasks[1]!.dependsOn).toEqual(["TASK-001"]);
  });
});

// ── Status / State Load Tests ──

describe("Config import — status/state load", () => {
  test("loaded config works with Store for status-like queries", async () => {
    const projectId = "status-test";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const configContent = makeValidConfig(projectId, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", configContent);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    // Create a store and init tasks (same as cmdStatus does)
    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const task of config.tasks) {
      store.initTask(task.id);
    }

    const allStates = store.getAllTasks();
    // Every task should have a state entry
    for (const task of config.tasks) {
      expect(allStates[task.id]).toBeDefined();
      expect(allStates[task.id]!.state).toBe("todo");
    }
  });

  test("loaded config works with findReadyTasks", async () => {
    const projectId = "ready-test";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const configContent = makeValidConfig(projectId, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", configContent);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const task of config.tasks) {
      store.initTask(task.id);
    }

    // Import readiness functions
    const { findReadyTasks } = await import("../src/core/readiness.js");
    const ready = findReadyTasks(config.tasks, store.getAllTasks());

    // The single task with no dependencies should be ready
    expect(ready.length).toBeGreaterThanOrEqual(1);
    expect(ready[0]!.id).toBe("TASK-001");
  });
});

// ── Invalid Config Detection ──

describe("Config import — invalid config detection", () => {
  test("claude-code style config fails loadConfig validation", async () => {
    const projectId = "claude-code-bad";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    // Simulate what Claude Code AI might generate — wrong shape entirely
    const badConfig = `import { defineConfig } from "@anthropic-ai/claude-code";

export default defineConfig({
  systemPrompt: "You are a helpful assistant",
  tools: ["Read", "Write"],
});
`;

    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", badConfig);

    const configPath = `${outputDir}/autopilot.config.ts`;
    // This should throw because it's not a valid ProjectConfig
    await expect(loadConfig(configPath)).rejects.toThrow();
  });

  test("config missing required fields fails validation", async () => {
    const projectId = "missing-fields";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    // Missing execution, epics, tasks
    const badConfig = `
const config = {
  project: { id: "${projectId}", name: "${projectId}", rootDir: "." },
};
export default config;
`;

    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", badConfig);

    const configPath = `${outputDir}/autopilot.config.ts`;
    await expect(loadConfig(configPath)).rejects.toThrow();
  });
});

// ── Backlog Manifest Import ──

const MINI_BACKLOG: BacklogManifest = {
  version: 1,
  project: {
    id: "test-backlog",
    name: "Test Backlog Project",
    tracker: { provider: "linear", projectId: "TEST" },
  },
  sharedContext: "shared.md",
  epics: [
    { id: "EPIC-A", title: "Phase A", track: "main" },
    { id: "EPIC-B", title: "Sidecar B", track: "sidecar" },
  ],
  tasks: [
    { id: "QUE-100", title: "Gate task", epicId: "EPIC-A", kind: "poc", track: "gate" },
    { id: "QUE-101", title: "Main impl", epicId: "EPIC-A", kind: "implementation", track: "main", dependsOn: ["QUE-100"] },
    { id: "QUE-102", title: "Follow-up", epicId: "EPIC-A", kind: "implementation", track: "main", dependsOn: ["QUE-101"] },
    { id: "QUE-200", title: "Sidecar cleanup", epicId: "EPIC-B", kind: "cleanup", track: "sidecar" },
  ],
};

describe("Backlog manifest — load and validate", () => {
  test("loadBacklog parses valid manifest", async () => {
    const path = `${TEST_HOME}/backlog.json`;
    await mkdir(TEST_HOME, { recursive: true });
    await writeFile(path, JSON.stringify(MINI_BACKLOG));

    const manifest = await loadBacklog(path);
    expect(manifest).not.toBeNull();
    expect(manifest!.tasks.length).toBe(4);
    expect(manifest!.epics.length).toBe(2);
  });

  test("loadBacklog returns null for missing file", async () => {
    const manifest = await loadBacklog(`${TEST_HOME}/nope.json`);
    expect(manifest).toBeNull();
  });

  test("loadBacklog rejects invalid manifest (unknown epic ref)", async () => {
    const bad = {
      ...MINI_BACKLOG,
      tasks: [{ id: "T-1", title: "x", epicId: "NOPE", kind: "implementation", track: "main" }],
    };
    const path = `${TEST_HOME}/bad-backlog.json`;
    await writeFile(path, JSON.stringify(bad));
    const manifest = await loadBacklog(path);
    expect(manifest).toBeNull();
  });

  test("detectBacklog finds backlog.json in prompts dir", async () => {
    const dir = `${TEST_HOME}/prompts`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/backlog.json`, JSON.stringify(MINI_BACKLOG));

    const manifest = await detectBacklog(dir);
    expect(manifest).not.toBeNull();
    expect(manifest!.project.id).toBe("test-backlog");
  });
});

describe("Backlog manifest — compile to config", () => {
  test("compileBacklogToConfig produces loadable qap-native config", async () => {
    const projectId = "backlog-compile";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const compiled = compileBacklogToConfig(MINI_BACKLOG, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", compiled);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    // Real issue IDs preserved
    expect(config.tasks.map((t) => t.id)).toEqual(["QUE-100", "QUE-101", "QUE-102", "QUE-200"]);
    expect(config.epics.map((e) => e.id)).toEqual(["EPIC-A", "EPIC-B"]);
    // No generic TASK-xxx
    expect(config.tasks.every((t) => !t.id.startsWith("TASK-"))).toBe(true);
  });

  test("compiled config preserves dependencies", async () => {
    const projectId = "backlog-deps";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const compiled = compileBacklogToConfig(MINI_BACKLOG, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", compiled);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    const que101 = config.tasks.find((t) => t.id === "QUE-101");
    expect(que101!.dependsOn).toEqual(["QUE-100"]);

    const que102 = config.tasks.find((t) => t.id === "QUE-102");
    expect(que102!.dependsOn).toEqual(["QUE-101"]);

    const que200 = config.tasks.find((t) => t.id === "QUE-200");
    expect(que200!.dependsOn).toBeUndefined();
  });

  test("compiled config respects dependency graph in findReadyTasks", async () => {
    const projectId = "backlog-ready";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const compiled = compileBacklogToConfig(MINI_BACKLOG, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", compiled);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const task of config.tasks) store.initTask(task.id);

    const { findReadyTasks } = await import("../src/core/readiness.js");
    const ready = findReadyTasks(config.tasks, store.getAllTasks());

    // Only tasks with no unmet deps should be ready
    const readyIds = ready.map((t) => t.id);
    expect(readyIds).toContain("QUE-100"); // gate, no deps
    expect(readyIds).toContain("QUE-200"); // sidecar, no deps
    expect(readyIds).not.toContain("QUE-101"); // blocked by QUE-100
    expect(readyIds).not.toContain("QUE-102"); // blocked by QUE-101
  });

  test("compiled config show/next works with real issue IDs", async () => {
    const projectId = "backlog-show";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const compiled = compileBacklogToConfig(MINI_BACKLOG, TEST_REPO, outputDir);
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", compiled);

    const configPath = `${outputDir}/autopilot.config.ts`;
    const config = await loadConfig(configPath);

    // show: can find by real issue ID
    const que100 = config.tasks.find((t) => t.id === "QUE-100");
    expect(que100).toBeDefined();
    expect(que100!.title).toBe("Gate task");
    expect(que100!.kind).toBe("poc");
    expect(que100!.track).toBe("gate");

    // next: returns gate task first (highest priority)
    const store = new Store(config.project.rootDir, config.project.id);
    await store.load();
    for (const task of config.tasks) store.initTask(task.id);

    const { findNextTask } = await import("../src/core/readiness.js");
    const next = findNextTask(config.tasks, store.getAllTasks());
    expect(next).not.toBeNull();
    expect(next!.id).toBe("QUE-100"); // gate > main > sidecar
  });

  test("compiled config has no generic TASK-001 IDs", async () => {
    const projectId = "backlog-no-generic";
    const ws = new WorkspaceManager();
    const workspace = await ws.ensureWorkspace(TEST_REPO);
    await ws.saveProject(workspace.id, {
      id: projectId,
      name: projectId,
      repoRoot: TEST_REPO,
      provider: "claude",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const outputDir = getProjectDir(workspace.id, projectId);
    const compiled = compileBacklogToConfig(MINI_BACKLOG, TEST_REPO, outputDir);

    // Check raw content — no TASK-xxx anywhere
    expect(compiled).not.toContain("TASK-001");
    expect(compiled).not.toContain("TASK-");
    expect(compiled).toContain("QUE-100");
    expect(compiled).toContain("QUE-101");
    // No banned imports
    expect(compiled).not.toContain("@anthropic-ai/claude-code");
    expect(compiled).not.toContain("defineConfig");
  });
});
