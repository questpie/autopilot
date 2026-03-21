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
} from "./commands/project.js";
import type { PromptMode, TaskState } from "./core/types.js";

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

  // Check active project workspace
  const ws = new WorkspaceManager();
  const activePath = await ws.getActiveConfigPath();
  if (activePath) return activePath;

  return "./autopilot.config.ts";
}

async function main() {
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
    switch (sub) {
      case "init":
        return cmdProjectInit(subArgs);
      case "import":
        return cmdProjectImport(subArgs);
      case "list":
      case "ls":
        return cmdProjectList();
      case "use":
        return cmdProjectUse(subArgs);
      default:
        console.log(`
qap project <command>

Commands:
  init      Initialize a new project workspace (AI-assisted)
  import    Import existing project artifacts (AI-assisted)
  list      List all local projects
  use <id>  Set active project
`);
        return;
    }
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
      return cmdNote(args[1]!, args.slice(2).join(" "));
    case "validate":
      if (args[1] === "readiness") return cmdValidateReadiness();
      break;
    case "report":
      if (args[1] === "session") return cmdReportSession();
      if (args[1] === "project") return cmdReportProject();
      break;
    default:
      printHelp();
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
  qap project list              List all local projects
  qap project use <id>          Set active project

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
  qap validate readiness        Check all dependency readiness
  qap report session            Show session changelog
  qap report project            Show project summary

Options:
  --config <path>               Config file (auto-detected from active project)
  --dry-run                     Show what would run (zero side effects)
  --no-sync                     Disable Linear sync
  --max <n>                     Max tasks to run in loop
  --skip-validation             Skip validation steps
  --mode <mode>                 Prompt mode
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

function makeRunnerOpts() {
  return {
    dryRun: hasFlag("dry-run"),
    maxTasks: flag("max") ? parseInt(flag("max")!) : undefined,
    skipValidation: hasFlag("skip-validation"),
    noSync: hasFlag("no-sync"),
  };
}

async function cmdRun() {
  const configPath = await resolveConfigPath();
  const config = await loadConfig(configPath);
  const runner = new Runner(config, {
    ...makeRunnerOpts(),
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
  const runner = new Runner(config, makeRunnerOpts());
  await runner.runNext();
}

async function cmdRunTask(taskId: string) {
  if (!taskId) {
    log.error("Usage: qap run-task <task-id>");
    return;
  }

  const configPath = await resolveConfigPath();
  const config = await loadConfig(configPath);
  const runner = new Runner(config, {
    ...makeRunnerOpts(),
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
