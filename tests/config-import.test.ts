import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { WorkspaceManager } from "../src/workspace/manager.js";
import { getProjectDir } from "../src/workspace/types.js";
import { loadConfig } from "../src/config/loader.js";
import { Store } from "../src/storage/store.js";
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
