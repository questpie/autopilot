import { readFile } from "node:fs/promises";
import type {
  ProjectConfig,
  TaskConfig,
  EpicConfig,
  PromptMode,
  TaskRunState,
} from "../core/types.js";
import { checkReadiness } from "../core/readiness.js";

export interface SteeringContext {
  projectSteering?: string | null;
  taskNotes?: string[];
  sessionNotes?: string[];
}

/**
 * Render a complete prompt for an agent, combining all context sources.
 */
export async function renderPrompt(
  config: ProjectConfig,
  task: TaskConfig,
  mode: PromptMode,
  states: Record<string, TaskRunState>,
  steering?: SteeringContext
): Promise<string> {
  const parts: string[] = [];

  // 0. Steering notes (project → task → session precedence)
  if (steering) {
    const steeringParts: string[] = [];
    if (steering.projectSteering) {
      steeringParts.push(`## Project Steering\n\n${steering.projectSteering}`);
    }
    if (steering.taskNotes && steering.taskNotes.length > 0) {
      steeringParts.push(
        `## Task Notes\n\n${steering.taskNotes.map((n) => `- ${n}`).join("\n")}`
      );
    }
    if (steering.sessionNotes && steering.sessionNotes.length > 0) {
      steeringParts.push(
        `## Session Notes\n\n${steering.sessionNotes.map((n) => `- ${n}`).join("\n")}`
      );
    }
    if (steeringParts.length > 0) {
      parts.push(`# Steering Notes\n\n${steeringParts.join("\n\n")}`);
    }
  }

  // 1. Shared context
  const sharedCtx = await loadFileOrEmpty(config.prompts.sharedContext);
  if (sharedCtx) {
    parts.push(`# Shared Context\n\n${sharedCtx}`);
  }

  // 2. Epic context
  const epic = config.epics.find((e) => e.id === task.epicId);
  if (epic) {
    parts.push(renderEpicContext(epic));
    if (epic.promptFile) {
      const epicPrompt = await loadFileOrEmpty(epic.promptFile);
      if (epicPrompt) parts.push(`# Epic Prompt\n\n${epicPrompt}`);
    }
  }

  // 3. Task metadata
  parts.push(renderTaskContext(task, config.tasks, states));

  // 4. Task prompt file
  if (task.promptFile) {
    const taskPrompt = await loadFileOrEmpty(task.promptFile);
    if (taskPrompt) parts.push(`# Task-Specific Prompt\n\n${taskPrompt}`);
  }

  // 5. Source references
  for (const ref of task.sourceRefs ?? []) {
    const content = await loadFileOrEmpty(ref);
    if (content) {
      parts.push(
        `# Source Reference: ${ref}\n\n${content.slice(0, 5000)}${content.length > 5000 ? "\n\n[... truncated ...]" : ""}`
      );
    }
  }

  // 6. Mode-specific instructions
  parts.push(renderModeInstructions(mode, task));

  // 7. Output format
  parts.push(renderOutputFormat(mode));

  return parts.join("\n\n---\n\n");
}

function renderEpicContext(epic: EpicConfig): string {
  return [
    `# Epic: ${epic.id}`,
    `**Title:** ${epic.title}`,
    `**Track:** ${epic.track}`,
  ].join("\n");
}

function renderTaskContext(
  task: TaskConfig,
  allTasks: TaskConfig[],
  states: Record<string, TaskRunState>
): string {
  const readiness = checkReadiness(task, allTasks, states);
  const deps = (task.dependsOn ?? [])
    .map((d) => `  - ${d}: ${states[d]?.state ?? "todo"}`)
    .join("\n");

  const lines = [
    `# Task: ${task.id}`,
    `**Title:** ${task.title}`,
    `**Kind:** ${task.kind}`,
    `**Track:** ${task.track}`,
  ];

  if (task.branchName) lines.push(`**Branch:** ${task.branchName}`);
  if (deps) lines.push(`**Dependencies:**\n${deps}`);

  if (task.acceptanceCriteria?.length) {
    lines.push(
      `**Acceptance Criteria:**\n${task.acceptanceCriteria.map((c) => `  - [ ] ${c}`).join("\n")}`
    );
  }

  return lines.join("\n");
}

function renderModeInstructions(mode: PromptMode, task: TaskConfig): string {
  switch (mode) {
    case "implement":
      return [
        "# Instructions",
        "",
        "Implement the task described above.",
        "- Follow the acceptance criteria strictly.",
        "- Do not implement anything outside this task's scope.",
        "- Do not skip blockers or modify unrelated code.",
        task.track === "gate"
          ? "- This is a GATE/PoC task. Prefer a minimal test harness over a large refactor."
          : "",
        "- If you encounter a public API change, explicitly name it.",
      ]
        .filter(Boolean)
        .join("\n");

    case "validate-primary":
      return [
        "# Instructions: Primary Validation",
        "",
        "Validate this task's implementation for correctness.",
        "Check:",
        "- All acceptance criteria are met",
        "- No obvious regressions in directly affected code",
        "- Types are correct",
        "- Tests pass if applicable",
        "- No scope creep",
      ].join("\n");

    case "validate-secondary":
      return [
        "# Instructions: Secondary Validation",
        "",
        "Perform a secondary review of this task.",
        "Check:",
        "- Regression impact on sibling tasks",
        "- Contract compliance with dependent tasks",
        "- No scope creep beyond acceptance criteria",
        "- Code quality and maintainability",
        task.kind === "poc"
          ? "- PoC findings are documented"
          : "",
      ]
        .filter(Boolean)
        .join("\n");

    case "validate-epic":
      return [
        "# Instructions: Epic Validation",
        "",
        "Validate the entire epic's integration.",
        "Check:",
        "- All tasks in this epic work together correctly",
        "- No hidden regressions between sibling tasks",
        "- Epic-level acceptance criteria are met",
        "- Integration points are clean",
      ].join("\n");

    case "validate-global":
      return [
        "# Instructions: Global Validation",
        "",
        "Validate the entire project's state.",
        "Check:",
        "- Cross-epic integration",
        "- Critical path consistency",
        "- Public API changes documented",
        "- All tests pass",
        "- No broken imports or missing exports",
      ].join("\n");
  }
}

function renderOutputFormat(mode: PromptMode): string {
  if (mode === "implement") {
    return [
      "# Required Output Format",
      "",
      "At the end of your work, output:",
      "```",
      "Done: <what was implemented>",
      "Tests: <test results or N/A>",
      "Risks: <any risks or concerns>",
      "Files changed: <list of key files>",
      "```",
    ].join("\n");
  }

  return [
    "# Required Output Format",
    "",
    "At the end of your validation, output:",
    "```",
    "Result: PASS | FAIL",
    "Issues: <list of issues found, or none>",
    "Recommendation: <proceed | fix-and-retry | block>",
    "```",
  ].join("\n");
}

async function loadFileOrEmpty(
  path: string | undefined
): Promise<string | null> {
  if (!path) return null;
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}
