import { readFile, readdir, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename, relative } from "node:path";
import { WorkspaceManager } from "../workspace/manager.js";
import { getProjectDir } from "../workspace/types.js";
import type { ProjectMeta } from "../workspace/types.js";
import { loadConfig } from "../config/loader.js";
import { log } from "../utils/logger.js";

// ── AI-Assisted Project Init/Import ─────────────────────────

export interface InitOptions {
  repo: string;
  name?: string;
  provider?: "claude" | "codex";
  plan?: string;
  validatedPlan?: string;
}

export interface ImportOptions {
  repo: string;
  name?: string;
  provider?: "claude" | "codex";
  prompts?: string;
  linearIssue?: string;
}

/**
 * Slugify a project name into a valid directory name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Scan a directory for files of interest
 */
async function scanDir(
  dir: string,
  extensions = [".md", ".ts", ".json", ".txt", ".yaml", ".yml"]
): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && extensions.some((e) => entry.name.endsWith(e))) {
      files.push(`${dir}/${entry.name}`);
    }
  }
  return files;
}

/**
 * Read a file safely, return null if not found
 */
async function safeRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Build an AI prompt for project initialization
 */
function buildInitPrompt(opts: {
  repoRoot: string;
  projectId: string;
  projectName: string;
  outputDir: string;
  planContent?: string | null;
  validatedPlanContent?: string | null;
  repoFiles: string[];
}): string {
  const sections: string[] = [];

  sections.push(`# QUESTPIE Autopilot — Project Init

You are setting up a new QUESTPIE Autopilot project workspace.

## Target
- Project ID: ${opts.projectId}
- Project Name: ${opts.projectName}
- Repo Root: ${opts.repoRoot}
- Output Directory: ${opts.outputDir}

## Your Task
Create the following files in the output directory:

1. \`autopilot.config.ts\` — A valid TypeScript config file.
2. \`handoff.md\` — A summary of what was analyzed, tasks/epics created, key decisions, gaps/assumptions.

${configShapeInstructions(opts.projectId, opts.projectName, opts.projectName.includes("codex") ? "codex" : "claude")}

## Rules
- Only create/update files inside the output directory
- Do NOT modify the target codebase
- Create at least 1 epic and 1 task
- Use realistic task IDs (e.g., TASK-001)
- Set rootDir relative to the config file location
`);

  if (opts.planContent) {
    sections.push(`## Plan Artifact\n\n${opts.planContent}\n`);
  }

  if (opts.validatedPlanContent) {
    sections.push(
      `## Validated Plan Artifact\n\n${opts.validatedPlanContent}\n`
    );
  }

  if (opts.repoFiles.length > 0) {
    sections.push(
      `## Repo Structure\n\nKey files found in repo:\n${opts.repoFiles.map((f) => `- ${relative(opts.repoRoot, f)}`).join("\n")}\n`
    );
  }

  return sections.join("\n");
}

/**
 * Build an AI prompt for project import
 */
function buildImportPrompt(opts: {
  repoRoot: string;
  projectId: string;
  projectName: string;
  outputDir: string;
  promptFiles: string[];
  linearIssue?: string;
  repoFiles: string[];
}): string {
  const sections: string[] = [];

  sections.push(`# QUESTPIE Autopilot — Project Import

You are importing an existing project into QUESTPIE Autopilot.

## Target
- Project ID: ${opts.projectId}
- Project Name: ${opts.projectName}
- Repo Root: ${opts.repoRoot}
- Output Directory: ${opts.outputDir}

## Your Task
Create the following files in the output directory:

1. \`autopilot.config.ts\` — A valid TypeScript config that references the imported prompts.
2. \`handoff.md\` — Import summary.

${configShapeInstructions(opts.projectId, opts.projectName, "claude")}

## Rules
- Only create/update files inside the output directory
- Do NOT modify the target codebase
- Map prompt files to tasks in the config
- Use the prompt filenames to derive task IDs and titles
- Set rootDir to the repo root (use relative path from config location)
`);

  if (opts.promptFiles.length > 0) {
    sections.push(
      `## Prompt Files Found\n\n${opts.promptFiles.map((f) => `- ${basename(f)}`).join("\n")}\n`
    );
  }

  if (opts.linearIssue) {
    sections.push(
      `## Linear Context\n\nLinear issue reference: ${opts.linearIssue}\nUse Linear MCP to fetch issue details if available.\n`
    );
  }

  if (opts.repoFiles.length > 0) {
    sections.push(
      `## Repo Structure\n\nKey files found:\n${opts.repoFiles.map((f) => `- ${relative(opts.repoRoot, f)}`).join("\n")}\n`
    );
  }

  return sections.join("\n");
}

/**
 * Spawn Claude agent to generate project artifacts
 */
async function spawnInitAgent(
  prompt: string,
  outputDir: string
): Promise<{ success: boolean; output: string }> {
  log.info("Spawning Claude agent for project setup...");

  const args = [
    "-p",
    prompt,
    "--allowedTools",
    "Write,Read,Glob,Grep",
    "--output-format",
    "json",
  ];

  try {
    const proc = Bun.spawn(["claude", ...args], {
      cwd: outputDir,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      log.success("AI agent completed project setup");
      return { success: true, output: stdout };
    } else {
      log.warn(`AI agent exited with code ${exitCode}`);
      if (stderr) log.error(stderr.slice(0, 500));
      return { success: false, output: stderr || stdout };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to spawn claude agent: ${msg}`);
    return { success: false, output: msg };
  }
}

/**
 * Generate fallback config when AI agent is not available
 */
function generateFallbackConfig(
  projectId: string,
  projectName: string,
  repoRoot: string,
  provider: "claude" | "codex",
  promptFiles: string[],
  outputDir: string
): string {
  const relRoot = relative(outputDir, repoRoot) || ".";

  // Build tasks from prompt files if available
  const tasks = promptFiles.length > 0
    ? promptFiles.map((f, i) => {
        const name = basename(f, ".md").replace(/^\d+-?/, "");
        const id = `TASK-${String(i + 1).padStart(3, "0")}`;
        return `    {
      id: "${id}",
      title: "${name.replace(/-/g, " ")}",
      epicId: "EPIC-001",
      kind: "implementation" as const,
      track: "main" as const,
      promptFile: "./prompts/${basename(f)}",${i > 0 ? `\n      dependsOn: ["TASK-${String(i).padStart(3, "0")}"],` : ""}
    }`;
      })
    : [
        `    {
      id: "TASK-001",
      title: "Initial setup",
      epicId: "EPIC-001",
      kind: "implementation" as const,
      track: "main" as const,
    }`,
      ];

  return `import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: {
    id: "${projectId}",
    name: "${projectName}",
    rootDir: "${relRoot}",
  },
  execution: {
    mode: "autonomous",
    defaultProvider: "${provider}",
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
      title: "${projectName}",
      track: "main",
    },
  ],
  tasks: [
${tasks.join(",\n")}
  ],
};

export default config;
`;
}

/**
 * Generate fallback handoff
 */
function generateFallbackHandoff(
  projectId: string,
  projectName: string,
  mode: "init" | "import",
  details: string[]
): string {
  return `# ${projectName} — Handoff

## Project ID
${projectId}

## Mode
${mode === "init" ? "Fresh initialization" : "Import from existing artifacts"}

## Setup Date
${new Date().toISOString()}

## Summary
${details.map((d) => `- ${d}`).join("\n")}

## Next Steps
1. Review \`autopilot.config.ts\` and adjust task definitions
2. Add prompt files to the \`prompts/\` directory
3. Run \`qap project use ${projectId}\` to activate this project
4. Run \`qap\` to open the TUI and start working
`;
}

/**
 * Shared config shape instructions injected into both init and import AI prompts.
 */
function configShapeInstructions(
  projectId: string,
  projectName: string,
  provider: string
): string {
  return `## Config Shape — CRITICAL

The file \`autopilot.config.ts\` MUST use this exact structure:

\`\`\`typescript
import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: {
    id: "${projectId}",
    name: "${projectName}",
    rootDir: "<relative path from config file to repo root>",
  },
  execution: {
    mode: "autonomous",
    defaultProvider: "${provider}",
    defaultPermissionProfile: "elevated",
    stopOnFailure: true,
    validateAfterEachTask: true,
  },
  prompts: {
    templatesDir: "./prompts",
  },
  epics: [
    { id: "EPIC-001", title: "...", track: "main" },
  ],
  tasks: [
    {
      id: "TASK-001",
      title: "...",
      epicId: "EPIC-001",
      kind: "implementation",
      track: "main",
      promptFile: "./prompts/some-file.md",  // optional
    },
  ],
};

export default config;
\`\`\`

### FORBIDDEN — do NOT do any of these:
- Do NOT import from \`@anthropic-ai/claude-code\`
- Do NOT use \`defineConfig\` from any package
- Do NOT use \`module.exports\`
- Do NOT import from \`claude-code\`, \`codex\`, or any external SDK
- The ONLY allowed import is the type import: \`import type { ProjectConfig } from "@questpie/autopilot/core/types"\`
- The config MUST have a \`export default config\` at the end

### Required fields:
- \`project.id\`, \`project.name\`, \`project.rootDir\` — all required strings
- \`execution.mode\` — must be "autonomous" or "prompt-only"
- \`execution.defaultProvider\` — must be "claude" or "codex"
- \`execution.defaultPermissionProfile\` — must be "safe", "elevated", or "max"
- \`epics\` — array with at least one epic (id, title, track)
- \`tasks\` — array with at least one task (id, title, epicId, kind, track)
- Every task.epicId must reference an existing epic.id
- task.kind must be one of: "implementation", "validation", "cleanup", "migration", "poc"
- task.track must be one of: "main", "sidecar", "gate"
`;
}

/**
 * Validate a generated config by loading it through the real loader.
 * Returns true if valid, false if broken.
 */
async function validateGeneratedConfig(configPath: string): Promise<boolean> {
  try {
    await loadConfig(configPath);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Generated config failed validation: ${msg}`);
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────

export async function initProject(opts: InitOptions): Promise<{
  meta: ProjectMeta;
  workspaceId: string;
}> {
  const ws = new WorkspaceManager();
  await ws.ensureRoot();

  const repoRoot = resolve(opts.repo);
  const workspace = await ws.ensureWorkspace(repoRoot);
  const projectName = opts.name ?? basename(repoRoot);
  const projectId = slugify(projectName);
  const provider = opts.provider ?? "claude";
  const outputDir = getProjectDir(workspace.id, projectId);

  if (await ws.projectExists(workspace.id, projectId)) {
    throw new Error(
      `Project "${projectId}" already exists in workspace "${workspace.name}". Use a different name or delete it first.`
    );
  }

  log.info(`Initializing project "${projectName}" (${projectId}) in workspace "${workspace.name}"...`);

  // Scan repo for context
  const repoFiles = await scanDir(repoRoot);
  const planContent = opts.plan ? await safeRead(resolve(opts.plan)) : null;
  const validatedPlanContent = opts.validatedPlan
    ? await safeRead(resolve(opts.validatedPlan))
    : null;

  // Create project meta
  const meta: ProjectMeta = {
    id: projectId,
    name: projectName,
    repoRoot,
    provider,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      mode: "init",
      planFile: opts.plan,
      validatedPlanFile: opts.validatedPlan,
    },
  };

  // Save project meta first (creates directories)
  await ws.saveProject(workspace.id, meta);

  // Try AI-assisted init
  const prompt = buildInitPrompt({
    repoRoot,
    projectId,
    projectName,
    outputDir,
    planContent,
    validatedPlanContent,
    repoFiles: repoFiles.slice(0, 30),
  });

  const result = await spawnInitAgent(prompt, outputDir);

  // Check if AI produced the config; if not, generate fallback
  const configPath = `${outputDir}/autopilot.config.ts`;
  if (!existsSync(configPath)) {
    log.warn("AI agent did not produce config — generating fallback...");
    const fallbackConfig = generateFallbackConfig(
      projectId,
      projectName,
      repoRoot,
      provider,
      [],
      outputDir
    );
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", fallbackConfig);
  }

  // Validate generated config — replace with fallback if broken
  const configValid = await validateGeneratedConfig(configPath);
  if (!configValid) {
    log.warn("AI-generated config is invalid — replacing with fallback...");
    const fallbackConfig = generateFallbackConfig(
      projectId,
      projectName,
      repoRoot,
      provider,
      [],
      outputDir
    );
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", fallbackConfig);

    // Validate fallback too — if this fails, the project is truly broken
    const fallbackValid = await validateGeneratedConfig(configPath);
    if (!fallbackValid) {
      throw new Error(
        `Failed to generate a valid config for project "${projectId}". Both AI and fallback configs are invalid.`
      );
    }
  }

  const handoffExists = existsSync(`${outputDir}/handoff.md`);
  if (!handoffExists) {
    const details = [
      `Repo: ${repoRoot}`,
      `Provider: ${provider}`,
      planContent ? "Plan artifact provided" : "No plan artifact",
      result.success
        ? "AI agent completed successfully"
        : "AI agent unavailable — used fallback config",
      configValid
        ? "Config validated successfully"
        : "AI config was invalid — used fallback",
    ];
    const handoff = generateFallbackHandoff(
      projectId,
      projectName,
      "init",
      details
    );
    await ws.writeProjectFile(workspace.id, projectId, "handoff.md", handoff);
  }

  // Initialize empty state
  await ws.writeProjectFile(
    workspace.id,
    projectId,
    "state.json",
    JSON.stringify(
      {
        projectId,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        tasks: {},
        changelog: [],
        sessionId: crypto.randomUUID(),
      },
      null,
      2
    )
  );

  // Set as active project
  await ws.setActiveProject(workspace.id, projectId);

  log.success(`Project "${projectName}" initialized at ${outputDir}`);
  return { meta, workspaceId: workspace.id };
}

export async function importProject(
  opts: ImportOptions
): Promise<{ meta: ProjectMeta; workspaceId: string }> {
  const ws = new WorkspaceManager();
  await ws.ensureRoot();

  const repoRoot = resolve(opts.repo);
  const workspace = await ws.ensureWorkspace(repoRoot);
  const projectName = opts.name ?? basename(repoRoot);
  const projectId = slugify(projectName);
  const provider = opts.provider ?? "claude";
  const outputDir = getProjectDir(workspace.id, projectId);

  if (await ws.projectExists(workspace.id, projectId)) {
    throw new Error(
      `Project "${projectId}" already exists in workspace "${workspace.name}". Use a different name or delete it first.`
    );
  }

  log.info(`Importing project "${projectName}" (${projectId}) into workspace "${workspace.name}"...`);

  // Scan for prompt files
  const promptsDir = opts.prompts ? resolve(opts.prompts) : null;
  const promptFiles = promptsDir ? await scanDir(promptsDir) : [];

  // Scan repo for context
  const repoFiles = await scanDir(repoRoot);

  // Create project meta
  const meta: ProjectMeta = {
    id: projectId,
    name: projectName,
    repoRoot,
    provider,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      mode: "import",
      promptsDir: opts.prompts,
      linearIssue: opts.linearIssue,
    },
  };

  // Save project meta (creates directories)
  await ws.saveProject(workspace.id, meta);

  // Copy prompt files to project workspace
  if (promptFiles.length > 0) {
    const targetDir = `${outputDir}/prompts`;
    await mkdir(targetDir, { recursive: true });
    for (const file of promptFiles) {
      await copyFile(file, `${targetDir}/${basename(file)}`);
    }
    log.info(`Copied ${promptFiles.length} prompt file(s)`);
  }

  // Try AI-assisted import
  const prompt = buildImportPrompt({
    repoRoot,
    projectId,
    projectName,
    outputDir,
    promptFiles,
    linearIssue: opts.linearIssue,
    repoFiles: repoFiles.slice(0, 30),
  });

  const result = await spawnInitAgent(prompt, outputDir);

  // Fallback if AI didn't produce config
  const configPath = `${outputDir}/autopilot.config.ts`;
  if (!existsSync(configPath)) {
    log.warn("AI agent did not produce config — generating fallback...");
    const fallbackConfig = generateFallbackConfig(
      projectId,
      projectName,
      repoRoot,
      provider,
      promptFiles,
      outputDir
    );
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", fallbackConfig);
  }

  // Validate generated config — replace with fallback if broken
  const configValid = await validateGeneratedConfig(configPath);
  if (!configValid) {
    log.warn("AI-generated config is invalid — replacing with fallback...");
    const fallbackConfig = generateFallbackConfig(
      projectId,
      projectName,
      repoRoot,
      provider,
      promptFiles,
      outputDir
    );
    await ws.writeProjectFile(workspace.id, projectId, "autopilot.config.ts", fallbackConfig);

    // Validate fallback too
    const fallbackValid = await validateGeneratedConfig(configPath);
    if (!fallbackValid) {
      throw new Error(
        `Failed to generate a valid config for project "${projectId}". Both AI and fallback configs are invalid.`
      );
    }
  }

  const handoffExists = existsSync(`${outputDir}/handoff.md`);
  if (!handoffExists) {
    const details = [
      `Repo: ${repoRoot}`,
      `Provider: ${provider}`,
      `Prompt files: ${promptFiles.length}`,
      opts.linearIssue
        ? `Linear issue: ${opts.linearIssue}`
        : "No Linear context",
      result.success
        ? "AI agent completed successfully"
        : "AI agent unavailable — used fallback config",
      configValid
        ? "Config validated successfully"
        : "AI config was invalid — used fallback",
    ];
    const handoff = generateFallbackHandoff(
      projectId,
      projectName,
      "import",
      details
    );
    await ws.writeProjectFile(workspace.id, projectId, "handoff.md", handoff);
  }

  // Initialize empty state
  await ws.writeProjectFile(
    workspace.id,
    projectId,
    "state.json",
    JSON.stringify(
      {
        projectId,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        tasks: {},
        changelog: [],
        sessionId: crypto.randomUUID(),
      },
      null,
      2
    )
  );

  // Set as active project
  await ws.setActiveProject(workspace.id, projectId);

  log.success(`Project "${projectName}" imported at ${outputDir}`);
  return { meta, workspaceId: workspace.id };
}
