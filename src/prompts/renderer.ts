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

export interface RemediationContext {
  validationFindings: string[];
  validationSummary: string;
  validationRecommendation: string;
  diffSummary?: string;
}

export interface CommitContext {
  diffSummary: string;
  commitMessageFormat?: string;
  commitPolicy?: string;
}

/**
 * Render a complete prompt for an agent, combining all context sources.
 */
export async function renderPrompt(
  config: ProjectConfig,
  task: TaskConfig,
  mode: PromptMode,
  states: Record<string, TaskRunState>,
  steering?: SteeringContext,
  remediation?: RemediationContext,
  commitCtx?: CommitContext
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

  // 6a. Commit context (only for commit mode)
  if (mode === "commit" && commitCtx) {
    const commitParts: string[] = [
      "# Commit Context",
      "",
      "**Current Diff:**",
      "```",
      commitCtx.diffSummary,
      "```",
    ];
    if (commitCtx.commitPolicy) {
      commitParts.push("", `**Commit Policy:** ${commitCtx.commitPolicy}`);
    }
    if (commitCtx.commitMessageFormat) {
      commitParts.push("", `**Commit Message Format:** ${commitCtx.commitMessageFormat}`);
    }
    parts.push(commitParts.join("\n"));
  }

  // 6. Remediation context (only for remediate mode)
  if (mode === "remediate" && remediation) {
    const remParts: string[] = [
      "# Remediation Context",
      "",
      `**Validation Summary:** ${remediation.validationSummary}`,
      "",
      "**Validation Findings:**",
      ...remediation.validationFindings.map((f) => `- ${f}`),
      "",
      `**Recommendation:** ${remediation.validationRecommendation}`,
    ];
    if (remediation.diffSummary) {
      remParts.push("", "**Current Diff:**", "```", remediation.diffSummary, "```");
    }
    parts.push(remParts.join("\n"));
  }

  // 7. Mode-specific instructions
  parts.push(renderModeInstructions(mode, task));

  // 8. Output format
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

    case "remediate":
      return [
        "# Instructions: Remediation",
        "",
        "Fix ONLY the issues identified in the validation findings above.",
        "- Do NOT add new features or refactor unrelated code.",
        "- Do NOT expand scope beyond fixing the specific validation failures.",
        "- Focus on the validation findings and recommendation.",
        "- After fixing, verify the fix addresses each finding.",
        "- Keep changes minimal and targeted.",
      ].join("\n");

    case "commit":
      return [
        "# Instructions: Commit",
        "",
        "Create a git commit for the changes made in this task.",
        "- Review the diff above to understand what changed.",
        "- Stage ONLY the files relevant to this task's scope.",
        "- Do NOT stage unrelated files, build artifacts, or secrets (.env, credentials).",
        "- Write a clear, concise commit message that describes what was done and why.",
        "- Follow the commit message format if specified above.",
        "- Do NOT push to any remote.",
        "- Do NOT amend existing commits.",
        "- Do NOT create additional branches.",
        "- If the diff looks wrong or contains scope creep, output an error instead of committing.",
      ].join("\n");
  }
}

function renderOutputFormat(mode: PromptMode): string {
  if (mode === "implement" || mode === "remediate") {
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

  if (mode === "commit") {
    return [
      "# Required Output Format",
      "",
      "At the end, output exactly one of:",
      "```",
      "Committed: <commit-hash> <one-line commit message>",
      "```",
      "or if commit should not proceed:",
      "```",
      "Error: <reason why commit was skipped>",
      "```",
    ].join("\n");
  }

  return [
    "# Required Output Format",
    "",
    "At the end of your validation, output:",
    "```",
    "Result: PASS | FAIL",
    "Summary: <one-line summary of validation result>",
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
