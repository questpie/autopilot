import { resolve, dirname } from "node:path";
import type { ProjectConfig } from "../core/types.js";
import { log } from "../utils/logger.js";

export async function loadConfig(configPath: string): Promise<ProjectConfig> {
  const absPath = resolve(configPath);
  log.info(`Loading config from ${absPath}`);

  try {
    const mod = await import(absPath);
    const config: ProjectConfig = mod.default ?? mod;

    validate(config);

    // Resolve relative paths
    const base = dirname(absPath);
    config.project.rootDir = resolve(base, config.project.rootDir);

    if (config.prompts.sharedContext) {
      config.prompts.sharedContext = resolve(
        base,
        config.prompts.sharedContext
      );
    }
    if (config.prompts.templatesDir) {
      config.prompts.templatesDir = resolve(
        base,
        config.prompts.templatesDir
      );
    }
    if (config.reporting?.sessionLogFile) {
      config.reporting.sessionLogFile = resolve(
        base,
        config.reporting.sessionLogFile
      );
    }
    if (config.reporting?.projectChangelogFile) {
      config.reporting.projectChangelogFile = resolve(
        base,
        config.reporting.projectChangelogFile
      );
    }

    for (const task of config.tasks) {
      if (task.promptFile) {
        task.promptFile = resolve(base, task.promptFile);
      }
      if (task.sourceRefs) {
        task.sourceRefs = task.sourceRefs.map((r) => resolve(base, r));
      }
    }

    for (const epic of config.epics) {
      if (epic.promptFile) {
        epic.promptFile = resolve(base, epic.promptFile);
      }
    }

    return config;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load config from ${absPath}: ${msg}`);
  }
}

function validate(config: ProjectConfig): void {
  if (!config.project?.id) throw new Error("Missing project.id");
  if (!config.project?.name) throw new Error("Missing project.name");
  if (!config.project?.rootDir) throw new Error("Missing project.rootDir");
  if (!config.execution?.defaultProvider)
    throw new Error("Missing execution.defaultProvider");
  if (!config.execution?.mode) throw new Error("Missing execution.mode");
  if (!config.tasks?.length) throw new Error("No tasks defined");

  // Duplicate check
  const taskIds = new Set<string>();
  for (const task of config.tasks) {
    if (taskIds.has(task.id))
      throw new Error(`Duplicate task ID: ${task.id}`);
    taskIds.add(task.id);
  }

  // Dependency reference check
  for (const task of config.tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (!taskIds.has(dep)) {
        throw new Error(
          `Task ${task.id} depends on ${dep} which doesn't exist`
        );
      }
    }
  }

  // Cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): void {
    if (inStack.has(id))
      throw new Error(`Dependency cycle involving ${id}`);
    if (visited.has(id)) return;
    inStack.add(id);
    const task = config.tasks.find((t) => t.id === id);
    for (const dep of task?.dependsOn ?? []) {
      dfs(dep);
    }
    inStack.delete(id);
    visited.add(id);
  }

  for (const task of config.tasks) {
    dfs(task.id);
  }

  // Epic reference check
  const epicIds = new Set(config.epics.map((e) => e.id));
  for (const task of config.tasks) {
    if (!epicIds.has(task.epicId)) {
      throw new Error(
        `Task ${task.id} references epic ${task.epicId} which doesn't exist`
      );
    }
  }

  log.success(
    `Config OK: ${config.tasks.length} tasks, ${config.epics.length} epics, mode=${config.execution.mode}`
  );
}
