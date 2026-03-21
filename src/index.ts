#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { loadConfig } from "./config/loader.js";
import { Runner } from "./core/runner.js";
import { transition } from "./core/state.js";
import {
  findNextTask,
  findReadyTasks,
  checkReadiness,
  whatUnblocks,
  deriveEpicState,
} from "./core/readiness.js";
import { renderPrompt } from "./prompts/renderer.js";
import { Store } from "./storage/store.js";
import { log } from "./utils/logger.js";
import { WorkspaceManager } from "./workspace/manager.js";
import {
  cmdProjectInit,
  cmdProjectImport,
  cmdProjectList,
  cmdProjectUse,
  printProjectHelp,
} from "./commands/project.js";
import {
  cmdWorkspaceAdd,
  cmdWorkspaceList,
  cmdWorkspaceShow,
  printWorkspaceHelp,
} from "./commands/workspace.js";
import type { PromptMode, TaskState } from "./core/types.js";
import { checkForUpdate, getCurrentVersion } from "./update/checker.js";
import { loadSettings } from "./update/settings.js";
import { printUpdateBanner } from "./update/notify.js";
import { applyUpdate, applyUpdateInBackground } from "./update/updater.js";

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

async function resolveConfigPath(): Promise<string> {
  // Explicit --config flag takes priority
  const explicit = flag("config");
  if (explicit) return explicit;

  // Check local autopilot.config.ts
  if (existsSync("./autopilot.config.ts")) return "./autopilot.config.ts";

  // Check active project in CWD workspace
  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (workspace) {
    const activePath = await ws.getActiveConfigPath(workspace.id);
    if (activePath) return activePath;
  }

  return "./autopilot.config.ts";
}

async function main() {
  // Non-blocking update check on startup (for non-update commands)
  if (command !== "update") {
    startupUpdateCheck();
  }

  // `qap` with no args or `qap ui` → launch TUI
  if (!command || command === "ui") {
    if (hasFlag("help")) {
      printHelp();
      return;
    }
    const { launchTui } = await import("./tui/index.js");
    return launchTui();
  }

  // Help
  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  // Project management subcommands
  if (command === "project") {
    const sub = args[1];
    const subArgs = args.slice(2);

    // No subcommand or help flag on project itself
    if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
      printProjectHelp();
      return;
    }

    switch (sub) {
      case "init":
        return cmdProjectInit(subArgs);
      case "import":
        return cmdProjectImport(subArgs);
      case "list":
      case "ls":
        return cmdProjectList(subArgs);
      case "use":
        return cmdProjectUse(subArgs);
      default:
        printProjectHelp();
        return;
    }
  }

  // Workspace management subcommands
  if (command === "workspace") {
    const sub = args[1];
    const subArgs = args.slice(2);

    if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
      printWorkspaceHelp();
      return;
    }

    switch (sub) {
      case "add":
        return cmdWorkspaceAdd(subArgs);
      case "list":
      case "ls":
        return cmdWorkspaceList();
      case "show":
        return cmdWorkspaceShow();
      default:
        printWorkspaceHelp();
        return;
    }
  }

  // Update commands
  if (command === "update") {
    return cmdUpdate();
  }

  // Engine commands (require config)
  switch (command) {
    case "status":
      return cmdStatus();
    case "next":
      return cmdNext();
    case "list":
      return cmdList();
    case "show":
      return cmdShow(args[1]!);
    case "prompt":
      return cmdPrompt(
        args[1]!,
        (flag("mode") as PromptMode) ?? "implement"
      );
    case "run":
      return cmdRun();
    case "run-next":
      return cmdRunNext();
    case "run-task":
      return cmdRunTask(args[1]!);
    case "start":
      return cmdStart(args[1]!);
    case "mark":
      return cmdMark(args[1]!, args[2] as TaskState);
    case "note":
      if (args[1] === "show") return cmdNoteShow(args[2]!);
      return cmdNote(args[1]!, args.slice(2).join(" "));
    case "steer":
      return cmdSteer(args.slice(1));
    case "validate":
      if (args[1] === "readiness") return cmdValidateReadiness();
      break;
    case "report":
      if (args[1] === "session") return cmdReportSession();
      if (args[1] === "project") return cmdReportProject();
      if (args[1] === "task") return cmdReportTask(args[2]);
      break;
    default:
      printHelp();
  }
}

// ── Update ──────────────────────────────────────────────────

/**
 * Fire-and-forget update check on startup.
 * Never blocks, never throws. Prints banner if update available.
 */
function startupUpdateCheck(): void {
  loadSettings()
    .then((settings) => {
      if (!settings.update.checkOnStart) return;
      return checkForUpdate().then((result) => {
        printUpdateBanner(result);
        // Auto-update if opted in
        if (
          settings.update.autoUpdate &&
          result.updateAvailable &&
          !result.updateApplied
        ) {
          applyUpdateInBackground();
        }
      });
    })
    .catch(() => {
      // Silently ignore — never block startup
    });
}

async function cmdUpdate(): Promise<void> {
  const forceCheck = hasFlag("check");
  const forceApply = hasFlag("apply");

  if (forceApply) {
    log.info("Applying update...");
    const result = await applyUpdate();
    if (result.success) {
      log.success(
        `Updated to ${result.version ?? "latest"}. Restart qap to use the new version.`
      );
    } else {
      log.error(`Update failed: ${result.error}`);
    }
    return;
  }

  // Default: check (--check is explicit but also default behavior)
  const result = await checkForUpdate(true);
  if (result.updateAvailable && result.latestVersion) {
    log.info(
      `Update available: ${result.currentVersion} → ${result.latestVersion}`
    );
    log.info(`Run: bun add -g @questpie/autopilot@latest`);
    log.info(`Or:  qap update --apply`);
  } else {
    log.success(`You're on the latest version (${result.currentVersion})`);
  }
}

function printHelp() {
  console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mQUESTPIE AUTOPILOT\x1b[0m — local-first workflow engine for coding agents

Usage: qap [command] [options]

  qap                           Open terminal UI (default)
  qap ui                        Open terminal UI

Project Management:
  qap project init              Initialize new project (AI-assisted)
  qap project import            Import existing project artifacts
  qap project list              List projects in current workspace
  qap project use <id>          Set active project

Workspace Management:
  qap workspace add <path>      Register a repo as a workspace
  qap workspace list            List all known workspaces
  qap workspace show            Show current workspace info

Updates:
  qap update                    Check for new version
  qap update --check            Force version check (ignore throttle)
  qap update --apply            Download and install latest version

Execution:
  qap status                    Show project status
  qap next                      Show next ready task(s)
  qap list                      List all tasks with states
  qap show <id>                 Show task or epic details
  qap prompt <id> --mode <m>    Render prompt for a task
  qap run [--max <n>]           Run autonomous loop
  qap run-next                  Run just the next ready task
  qap run-task <id>             Run a specific task
  qap start <task>              Mark task as in_progress
  qap mark <task> <state>       Manually set task state
  qap note <task> <text>        Add a note to a task
  qap note show <task>          Show notes for a task
  qap steer project <text>      Add project steering note
  qap steer show                Show project steering notes
  qap validate readiness        Check all dependency readiness
  qap report session            Show session changelog
  qap report project            Show project summary
  qap report task <id>          Show detailed validation report for a task

Options:
  --config <path>               Config file (auto-detected from workspace)
  --dry-run                     Show what would run (zero side effects)
  --no-sync                     Disable Linear sync
  --max <n>                     Max tasks to run in loop
  --skip-validation             Skip validation steps
  --mode <mode>                 Prompt mode

Behavior:
  \`qap\` auto-detects the workspace from your current directory.
  If a workspace has one project, it loads automatically.
  If multiple projects exist, the TUI shows a project picker.
`);
}

// ── Helper: load config + store ──────────────────────────────
async function loadState() {
  const configPath = await resolveConfigPath();

  if (!existsSync(configPath)) {
    throw new Error(
      `No config found. Run \`qap project init\` or pass --config <path>.`
    );
  }

  const config = await loadConfig(configPath);
  const store = new Store(config.project.rootDir, config.project.id);
  await store.load();
  for (const task of config.tasks) {
    store.initTask(task.id);
  }
  return { config, store };
}

// ── Commands ─────────────────────────────────────────────────

async function cmdStatus() {
  const { config, store } = await loadState();
  const allStates = store.getAllTasks();
  const counts: Record<string, number> = {};

  for (const task of config.tasks) {
    const state = allStates[task.id]?.state ?? "todo";
    counts[state] = (counts[state] ?? 0) + 1;
  }

  log.info(
    `Project: ${config.project.name}`
  );
  log.info(
    `Mode: ${config.execution.mode} | Provider: ${config.execution.defaultProvider}`
  );
  log.divider();

  for (const [state, count] of Object.entries(counts)) {
    console.log(`  ${state.padEnd(20)} ${count}`);
  }

  log.divider();

  for (const epic of config.epics) {
    const epicState = deriveEpicState(epic, config.tasks, allStates);
    console.log(
      `  Epic ${epic.id.padEnd(14)} [${epic.track.padEnd(7)}] ${epicState.padEnd(20)} ${epic.title}`
    );
  }

  log.divider();

  const ready = findReadyTasks(config.tasks, allStates);
  if (ready.length > 0) {
    log.info(
      `Ready tasks: ${ready.map((t) => t.id).join(", ")}`
    );
  } else {
    log.warn("No ready tasks.");
  }
}

async function cmdNext() {
  const { config, store } = await loadState();
  const ready = findReadyTasks(config.tasks, store.getAllTasks());

  if (ready.length === 0) {
    log.warn("No ready tasks.");
    return;
  }

  log.info(`${ready.length} ready task(s):`);
  for (const task of ready) {
    const unlocks = whatUnblocks(
      task.id,
      config.tasks,
      store.getAllTasks()
    );
    console.log(
      `  ${task.id.padEnd(12)} [${task.track}/${task.kind}] ${task.title}` +
        (unlocks.length > 0
          ? ` → unlocks: ${unlocks.map((t) => t.id).join(", ")}`
          : "")
    );
  }
}

async function cmdList() {
  const { config, store } = await loadState();
  const allStates = store.getAllTasks();

  for (const epic of config.epics) {
    const epicState = deriveEpicState(epic, config.tasks, allStates);
    console.log(
      `\n  Epic: ${epic.id} — ${epic.title} [${epicState}]`
    );

    const epicTasks = config.tasks.filter(
      (t) => t.epicId === epic.id
    );
    for (const task of epicTasks) {
      const state = allStates[task.id]?.state ?? "todo";
      const marker =
        state === "done"
          ? "x"
          : state === "failed"
            ? "!"
            : state === "blocked"
              ? "#"
              : state === "in_progress"
                ? ">"
                : " ";
      console.log(
        `    [${marker}] ${task.id.padEnd(12)} ${state.padEnd(20)} ${task.title}`
      );
    }
  }
}

async function cmdShow(id: string) {
  const { config, store } = await loadState();

  const task = config.tasks.find((t) => t.id === id);
  if (task) {
    const state = store.getTask(id)!;
    const readiness = checkReadiness(
      task,
      config.tasks,
      store.getAllTasks()
    );
    const unlocks = whatUnblocks(
      id,
      config.tasks,
      store.getAllTasks()
    );

    console.log(`Task: ${task.id}`);
    console.log(`Title: ${task.title}`);
    console.log(`State: ${state.state}`);
    console.log(`Epic: ${task.epicId}`);
    console.log(`Track: ${task.track} | Kind: ${task.kind}`);
    console.log(
      `Provider: ${task.provider ?? config.execution.defaultProvider}`
    );
    console.log(
      `Permission: ${task.permissionProfile ?? config.execution.defaultPermissionProfile}`
    );

    if (task.dependsOn?.length) {
      console.log(`Dependencies:`);
      for (const dep of task.dependsOn) {
        const depState = store.getTask(dep)?.state ?? "todo";
        const met = readiness.unmetDeps.includes(dep)
          ? "UNMET"
          : "MET";
        console.log(`  ${dep}: ${depState} [${met}]`);
      }
    }

    if (unlocks.length > 0) {
      console.log(
        `Unlocks: ${unlocks.map((t) => t.id).join(", ")}`
      );
    }

    if (task.acceptanceCriteria?.length) {
      console.log(`Acceptance Criteria:`);
      for (const c of task.acceptanceCriteria) {
        console.log(`  - ${c}`);
      }
    }

    if (state.notes.length > 0) {
      console.log(`Notes:`);
      for (const n of state.notes) {
        console.log(`  - ${n}`);
      }
    }

    if (state.runs.length > 0) {
      console.log(`Runs: ${state.runs.length}`);
      for (const run of state.runs) {
        console.log(
          `  ${run.startedAt} ${run.provider}[${run.permissionProfile}] exit=${run.exitCode} ${(run.duration / 1000).toFixed(1)}s`
        );
      }
    }

    if (state.error) {
      console.log(`Error: ${state.error}`);
    }

    if (state.lastValidation) {
      const v = state.lastValidation;
      console.log(`\nLast Validation: ${v.passed ? "PASS" : "FAIL"} (${v.mode})`);
      console.log(`  Summary: ${v.summary}`);
      if (v.findings.length > 0) {
        console.log(`  Findings:`);
        for (const f of v.findings) {
          console.log(`    - ${f}`);
        }
      }
      if (v.recommendation) {
        console.log(`  Recommendation: ${v.recommendation}`);
      }
    }

    if (state.remediationAttempts > 0) {
      console.log(`Remediation Attempts: ${state.remediationAttempts}`);
      for (const r of state.remediationHistory ?? []) {
        console.log(
          `  #${r.attempt} ${r.result} (${r.timestamp.slice(0, 19)})`
        );
      }
    }

    return;
  }

  const epic = config.epics.find((e) => e.id === id);
  if (epic) {
    const epicState = deriveEpicState(
      epic,
      config.tasks,
      store.getAllTasks()
    );
    console.log(`Epic: ${epic.id}`);
    console.log(`Title: ${epic.title}`);
    console.log(`State: ${epicState}`);
    console.log(`Track: ${epic.track}`);

    const epicTasks = config.tasks.filter(
      (t) => t.epicId === epic.id
    );
    console.log(`Tasks: ${epicTasks.length}`);
    for (const t of epicTasks) {
      const s = store.getTask(t.id)?.state ?? "todo";
      console.log(
        `  ${t.id.padEnd(12)} ${s.padEnd(18)} ${t.title}`
      );
    }
    return;
  }

  log.error(`ID "${id}" not found as task or epic.`);
}

async function cmdPrompt(id: string, mode: PromptMode) {
  const { config, store } = await loadState();

  const task = config.tasks.find((t) => t.id === id);
  if (!task) {
    log.error(`Task ${id} not found.`);
    return;
  }

  const prompt = await renderPrompt(
    config,
    task,
    mode,
    store.getAllTasks()
  );

  console.log(prompt);
}

async function makeRunnerOpts() {
  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  const activeId = workspace
    ? await ws.getActiveProjectId(workspace.id)
    : undefined;

  return {
    dryRun: hasFlag("dry-run"),
    maxTasks: flag("max") ? parseInt(flag("max")!) : undefined,
    skipValidation: hasFlag("skip-validation"),
    noSync: hasFlag("no-sync"),
    workspaceId: workspace?.id,
    projectId: activeId,
  };
}

async function cmdRun() {
  const configPath = await resolveConfigPath();
  const config = await loadConfig(configPath);
  const opts = await makeRunnerOpts();
  const runner = new Runner(config, {
    ...opts,
    taskFilter: flag("task"),
  });

  process.on("SIGINT", () => {
    runner.requestStop();
  });

  await runner.run();
}

async function cmdRunNext() {
  const configPath = await resolveConfigPath();
  const config = await loadConfig(configPath);
  const opts = await makeRunnerOpts();
  const runner = new Runner(config, opts);
  await runner.runNext();
}

async function cmdRunTask(taskId: string) {
  if (!taskId) {
    log.error("Usage: qap run-task <task-id>");
    return;
  }

  const configPath = await resolveConfigPath();
  const config = await loadConfig(configPath);
  const opts = await makeRunnerOpts();
  const runner = new Runner(config, {
    ...opts,
    taskFilter: taskId,
  });

  process.on("SIGINT", () => {
    runner.requestStop();
  });

  await runner.run();
}

async function cmdStart(taskId: string) {
  const { config, store } = await loadState();

  const taskState = store.getTask(taskId);
  if (!taskState) {
    log.error(`Task ${taskId} not found.`);
    return;
  }

  try {
    let updated = taskState;
    if (updated.state === "todo") {
      updated = transition(updated, "ready");
    }
    updated = transition(updated, "in_progress");
    store.setTask(taskId, updated);
    await store.save();
    log.success(`${taskId} → in_progress`);
  } catch (err) {
    log.error(`${err}`);
  }
}

async function cmdMark(taskId: string, state: TaskState) {
  const { store } = await loadState();

  const taskState = store.getTask(taskId);
  if (!taskState) {
    log.error(`Task ${taskId} not found.`);
    return;
  }

  try {
    const updated = transition(taskState, state);
    store.setTask(taskId, updated);
    await store.save();
    log.success(`${taskId} → ${state}`);
  } catch (err) {
    log.error(`${err}`);
  }
}

async function cmdNote(taskId: string, text: string) {
  const { store } = await loadState();

  const taskState = store.getTask(taskId);
  if (!taskState) {
    log.error(`Task ${taskId} not found.`);
    return;
  }

  taskState.notes.push(`[${new Date().toISOString()}] ${text}`);
  store.setTask(taskId, taskState);
  await store.save();
  log.success(`Note added to ${taskId}`);
}

async function cmdValidateReadiness() {
  const { config, store } = await loadState();
  const allStates = store.getAllTasks();
  let issues = 0;

  for (const task of config.tasks) {
    const state = allStates[task.id]?.state ?? "todo";
    if (state !== "todo") continue;

    const readiness = checkReadiness(task, config.tasks, allStates);
    if (!readiness.ready) {
      console.log(
        `  ${task.id.padEnd(12)} blocked by: ${readiness.unmetDeps.join(", ")}`
      );
      issues++;
    }
  }

  if (issues === 0) {
    log.success("All todo tasks have met dependencies.");
  } else {
    log.info(`${issues} tasks with unmet dependencies.`);
  }
}

async function cmdReportSession() {
  const { store } = await loadState();
  const changelog = store.getChangelog();

  if (changelog.length === 0) {
    log.info("No changelog entries.");
    return;
  }

  console.log(`\nSession: ${store.getSessionId()}\n`);
  for (const entry of changelog) {
    console.log(
      `  [${entry.timestamp.slice(0, 19)}] ${entry.action.padEnd(10)} ${entry.taskId ?? ""} ${entry.detail}`
    );
  }
}

async function cmdNoteShow(taskId: string) {
  if (!taskId) {
    log.error("Usage: qap note show <task-id>");
    return;
  }
  const { store } = await loadState();
  const taskState = store.getTask(taskId);
  if (!taskState) {
    log.error(`Task ${taskId} not found.`);
    return;
  }
  if (taskState.notes.length === 0) {
    log.info(`No notes for ${taskId}.`);
    return;
  }
  console.log(`\nNotes for ${taskId}:\n`);
  for (const n of taskState.notes) {
    console.log(`  ${n}`);
  }
}

async function cmdSteer(subArgs: string[]) {
  const sub = subArgs[0];

  if (sub === "show") {
    const ws = new WorkspaceManager();
    const workspace = await ws.resolveWorkspaceFromCwd();
    if (!workspace) {
      log.error("No workspace found.");
      return;
    }
    const activeId = await ws.getActiveProjectId(workspace.id);
    if (!activeId) {
      log.error("No active project.");
      return;
    }
    const content = await ws.readSteering(workspace.id, activeId);
    if (!content) {
      log.info("No project steering notes yet.");
      return;
    }
    console.log(content);
    return;
  }

  if (sub === "project") {
    const text = subArgs.slice(1).join(" ");
    if (!text) {
      log.error("Usage: qap steer project <text>");
      return;
    }
    const ws = new WorkspaceManager();
    const workspace = await ws.resolveWorkspaceFromCwd();
    if (!workspace) {
      log.error("No workspace found.");
      return;
    }
    const activeId = await ws.getActiveProjectId(workspace.id);
    if (!activeId) {
      log.error("No active project.");
      return;
    }
    await ws.appendSteering(workspace.id, activeId, text);
    log.success("Steering note added.");
    return;
  }

  log.error("Usage: qap steer [project <text> | show]");
}

async function cmdReportTask(taskId: string) {
  if (!taskId) {
    log.error("Usage: qap report task <task-id>");
    return;
  }
  const { config, store } = await loadState();
  const task = config.tasks.find((t) => t.id === taskId);
  if (!task) {
    log.error(`Task ${taskId} not found.`);
    return;
  }
  const state = store.getTask(taskId)!;

  console.log(`\nValidation Report: ${taskId}`);
  console.log(`Title: ${task.title}`);
  console.log(`State: ${state.state}`);

  if (!state.validationHistory || state.validationHistory.length === 0) {
    console.log("\nNo validation history.");
    return;
  }

  console.log(`\nValidation History (${state.validationHistory.length} entries):`);
  for (const v of state.validationHistory) {
    console.log(`\n  [${v.timestamp.slice(0, 19)}] ${v.passed ? "PASS" : "FAIL"} (${v.mode})`);
    console.log(`  Summary: ${v.summary}`);
    if (v.findings.length > 0) {
      console.log(`  Findings:`);
      for (const f of v.findings) {
        console.log(`    - ${f}`);
      }
    }
    if (v.recommendation) {
      console.log(`  Recommendation: ${v.recommendation}`);
    }
  }

  if (state.remediationHistory && state.remediationHistory.length > 0) {
    console.log(`\nRemediation History (${state.remediationHistory.length} attempts):`);
    for (const r of state.remediationHistory) {
      console.log(`  #${r.attempt} ${r.result} (${r.timestamp.slice(0, 19)}) — ${r.findings.summary}`);
    }
  }
}

async function cmdReportProject() {
  const { config, store } = await loadState();
  const allStates = store.getAllTasks();
  const total = config.tasks.length;
  const done = config.tasks.filter((t) =>
    ["done", "committed"].includes(
      allStates[t.id]?.state ?? "todo"
    )
  ).length;
  const failed = config.tasks.filter(
    (t) => allStates[t.id]?.state === "failed"
  ).length;
  const blocked = config.tasks.filter(
    (t) => allStates[t.id]?.state === "blocked"
  ).length;
  const inProgress = config.tasks.filter(
    (t) => allStates[t.id]?.state === "in_progress"
  ).length;

  console.log(`\nProject: ${config.project.name}`);
  console.log(
    `Total: ${total} | Done: ${done} | In Progress: ${inProgress} | Failed: ${failed} | Blocked: ${blocked}`
  );
  console.log(`Progress: ${((done / total) * 100).toFixed(1)}%\n`);

  for (const epic of config.epics) {
    const epicState = deriveEpicState(
      epic,
      config.tasks,
      allStates
    );
    const epicTasks = config.tasks.filter(
      (t) => t.epicId === epic.id
    );
    const epicDone = epicTasks.filter((t) =>
      ["done", "committed"].includes(
        allStates[t.id]?.state ?? "todo"
      )
    ).length;
    console.log(
      `  ${epic.id.padEnd(14)} ${epicState.padEnd(22)} ${epicDone}/${epicTasks.length} ${epic.title}`
    );
  }
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
