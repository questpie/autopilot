/**
 * Backlog Manifest — compiled artifact for issue-level project import.
 *
 * A backlog.json file can be placed alongside prompt files to provide
 * real issue IDs, dependencies, and epic groupings. When present,
 * the import compiler uses it instead of generating generic TASK-xxx IDs.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { log } from "../utils/logger.js";

// ── Manifest Types ──────────────────────────────────────────

export interface BacklogManifest {
  version: 1;
  project: {
    id: string;
    name: string;
    tracker?: {
      provider: "linear";
      projectId?: string;
      teamId?: string;
    };
  };
  sharedContext?: string;
  epics: BacklogEpic[];
  tasks: BacklogTask[];
}

export interface BacklogEpic {
  id: string;
  title: string;
  track: "main" | "sidecar" | "gate";
  promptFile?: string;
}

export interface BacklogTask {
  id: string;
  title: string;
  epicId: string;
  kind?: "implementation" | "validation" | "cleanup" | "migration" | "poc";
  track?: "main" | "sidecar" | "gate";
  dependsOn?: string[];
  promptFile?: string;
  issueUrl?: string;
  acceptanceCriteria?: string[];
}

// ── Loader ──────────────────────────────────────────────────

export async function loadBacklog(
  path: string
): Promise<BacklogManifest | null> {
  if (!existsSync(path)) return null;

  try {
    const raw = await readFile(path, "utf-8");
    const manifest: BacklogManifest = JSON.parse(raw);
    validateManifest(manifest);
    return manifest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Failed to load backlog manifest: ${msg}`);
    return null;
  }
}

function validateManifest(m: BacklogManifest): void {
  if (m.version !== 1) throw new Error(`Unsupported backlog version: ${m.version}`);
  if (!m.epics?.length) throw new Error("Backlog has no epics");
  if (!m.tasks?.length) throw new Error("Backlog has no tasks");

  const epicIds = new Set(m.epics.map((e) => e.id));
  const taskIds = new Set<string>();

  for (const task of m.tasks) {
    if (!task.id) throw new Error("Task missing id");
    if (!task.epicId) throw new Error(`Task ${task.id} missing epicId`);
    if (!epicIds.has(task.epicId)) {
      throw new Error(`Task ${task.id} references unknown epic ${task.epicId}`);
    }
    if (taskIds.has(task.id)) throw new Error(`Duplicate task ID: ${task.id}`);
    taskIds.add(task.id);
  }

  // Validate dependency references
  for (const task of m.tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (!taskIds.has(dep)) {
        throw new Error(`Task ${task.id} depends on unknown task ${dep}`);
      }
    }
  }
}

// ── Compiler ────────────────────────────────────────────────

/**
 * Compile a BacklogManifest into a qap-native autopilot.config.ts string.
 */
export function compileBacklogToConfig(
  manifest: BacklogManifest,
  repoRoot: string,
  outputDir: string,
  provider: "claude" | "codex" = "claude"
): string {
  const relRoot = relative(outputDir, repoRoot) || ".";

  const epicsStr = manifest.epics
    .map((e) => {
      const parts = [
        `    id: ${JSON.stringify(e.id)}`,
        `    title: ${JSON.stringify(e.title)}`,
        `    track: ${JSON.stringify(e.track)}`,
      ];
      if (e.promptFile) {
        parts.push(`    promptFile: ${JSON.stringify("./prompts/" + e.promptFile)}`);
      }
      return `  {\n${parts.join(",\n")},\n  }`;
    })
    .join(",\n");

  const tasksStr = manifest.tasks
    .map((t) => {
      const parts = [
        `    id: ${JSON.stringify(t.id)}`,
        `    title: ${JSON.stringify(t.title)}`,
        `    epicId: ${JSON.stringify(t.epicId)}`,
        `    kind: ${JSON.stringify(t.kind ?? "implementation")} as const`,
        `    track: ${JSON.stringify(t.track ?? "main")} as const`,
      ];
      if (t.dependsOn?.length) {
        parts.push(`    dependsOn: ${JSON.stringify(t.dependsOn)}`);
      }
      if (t.promptFile) {
        parts.push(`    promptFile: ${JSON.stringify("./prompts/" + t.promptFile)}`);
      }
      if (t.issueUrl) {
        parts.push(`    issueUrl: ${JSON.stringify(t.issueUrl)}`);
      }
      if (t.acceptanceCriteria?.length) {
        parts.push(`    acceptanceCriteria: ${JSON.stringify(t.acceptanceCriteria)}`);
      }
      return `  {\n${parts.join(",\n")},\n  }`;
    })
    .join(",\n");

  const sharedContextLine = manifest.sharedContext
    ? `\n    sharedContext: "./prompts/${manifest.sharedContext}",`
    : "";

  const trackerBlock = manifest.project.tracker
    ? `\n  tracker: ${JSON.stringify(manifest.project.tracker)},`
    : "";

  return `import type { ProjectConfig } from "@questpie/autopilot/core/types";

const config: ProjectConfig = {
  project: {
    id: ${JSON.stringify(manifest.project.id)},
    name: ${JSON.stringify(manifest.project.name)},
    rootDir: ${JSON.stringify(relRoot)},
  },
  execution: {
    mode: "autonomous",
    defaultProvider: ${JSON.stringify(provider)},
    defaultPermissionProfile: "elevated",
    stopOnFailure: true,
    validateAfterEachTask: true,
  },${trackerBlock}
  prompts: {${sharedContextLine}
    templatesDir: "./prompts",
  },
  epics: [
${epicsStr}
  ],
  tasks: [
${tasksStr}
  ],
};

export default config;
`;
}

/**
 * Try to detect a backlog.json in a prompts directory.
 */
export async function detectBacklog(
  promptsDir: string
): Promise<BacklogManifest | null> {
  const candidates = ["backlog.json", "project.manifest.json"];
  for (const name of candidates) {
    const path = resolve(promptsDir, name);
    const manifest = await loadBacklog(path);
    if (manifest) {
      log.info(`Found backlog manifest: ${name}`);
      return manifest;
    }
  }
  return null;
}
