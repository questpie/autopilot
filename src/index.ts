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
import {
  cmdAutopilotStart,
  cmdAutopilotStatus,
  cmdAutopilotStop,
  cmdAutopilotResume,
  printAutopilotHelp,
} from "./commands/autopilot.js";
import type { PromptMode, TaskState } from "./core/types.js";
import { checkForUpdate, getCurrentVersion } from "./update/checker.js";
import { loadSettings } from "./update/settings.js";
import { printUpdateBanner } from "./update/notify.js";
import { applyUpdate, applyUpdateInBackground } from "./update/updater.js";
import type { LogViewMode } from "./events/aggregator.js";
import { aggregateEvents, formatEntry } from "./events/aggregator.js";
import { SessionEventLog, sessionEventLogPath } from "./events/session-log.js";
import type { ProviderEvent } from "./events/types.js";
import type { SessionMeta } from "./workspace/types.js";

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

  // Autopilot subcommands
  if (command === "autopilot") {
    const sub = args[1];
    const subArgs = args.slice(2);

    if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
      printAutopilotHelp();
      return;
    }

    switch (sub) {
      case "start":
        return cmdAutopilotStart(subArgs);
      case "status":
        return cmdAutopilotStatus(subArgs);
      case "stop":
        return cmdAutopilotStop(subArgs);
      case "resume":
        return cmdAutopilotResume(subArgs);
      default:
        printAutopilotHelp();
        return;
    }
  }

  // Update commands
  if (command === "update") {
    return cmdUpdate();
  }

  // Logs command (reads session events)
  if (command === "logs") {
    return cmdLogs();
  }

  // Session subcommands
  if (command === "session") {
    return cmdSessionCli();
  }

  // Say / Interrupt
  if (command === "say") {
    return cmdSay();
  }
  if (command === "interrupt") {
    return cmdInterrupt();
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
  const P = "\x1b[38;2;183;0;255m"; // purple
  const B = "\x1b[1m"; // bold
  const D = "\x1b[2m"; // dim
  const R = "\x1b[0m"; // reset

  console.log(`
${P}■${R} ${B}QUESTPIE AUTOPILOT${R} — local-first workflow engine for coding agents

${B}Usage:${R} qap [command] [options]

  qap                           Open terminal UI (default)
  qap ui                        Open terminal UI

${B}Session & Monitoring:${R}
  qap session list              List sessions for active project
  qap session show <id>         Show session details
  qap session latest            Show most recent session
  qap session current           Show running session
  qap logs                      Show session logs ${D}(conversation view, latest session)${R}
  qap logs --follow             Tail live session events
  qap logs --session <id>       Logs for a specific session
  qap logs --view <mode>        View mode: conversation, activity, raw
  qap logs --all                Show all sessions ${D}(aggregate)${R}
  qap say <text>                Send message to running session
  qap interrupt [reason]        Interrupt running session

${B}Project:${R}
  qap project init              Initialize new project (AI-assisted)
  qap project import            Import existing project artifacts
  qap project list              List projects in current workspace
  qap project use <id>          Set active project

${B}Workspace:${R}
  qap workspace add <path>      Register a repo as a workspace
  qap workspace list            List all known workspaces
  qap workspace show            Show current workspace info

${B}Autopilot (Unattended):${R}
  qap autopilot start           Start bounded unattended autopilot
  qap autopilot status          Show live autopilot status
  qap autopilot stop            Stop running autopilot
  qap autopilot resume          Resume from current state
  qap autopilot --help          Full autopilot options

${B}Execution:${R}
  qap status                    Show project status
  qap next                      Show next ready task(s)
  qap list                      List all tasks with states
  qap show <id>                 Show task or epic details
  qap run                       Run autonomous loop ${D}(follows session by default)${R}
  qap run-next                  Run next ready task ${D}(follows session by default)${R}
  qap run-task <id>             Run a specific task ${D}(follows session by default)${R}
  qap start <task>              Mark task as in_progress
  qap mark <task> <state>       Manually set task state

${B}Notes & Steering:${R}
  qap note <task> <text>        Add a note to a task
  qap note show <task>          Show notes for a task
  qap steer project <text>      Add project steering note
  qap steer show                Show project steering notes

${B}Reports:${R}
  qap report session            Show session changelog
  qap report project            Show project summary
  qap report task <id>          Show validation report for a task
  qap validate readiness        Check dependency readiness

${B}Updates:${R}
  qap update                    Check for new version
  qap update --apply            Download and install latest

${B}Options:${R}
  --config <path>               Config file (auto-detected from workspace)
  --dry-run                     Show what would run (zero side effects)
  --no-sync                     Disable Linear sync
  --max <n>                     Max tasks to run in loop
  --skip-validation             Skip validation steps
  --detach                      Run without following session logs
  --view <mode>                 Follow view mode: conversation, activity, raw

${D}qap auto-detects the workspace from your current directory.${R}
${D}If a workspace has one project, it loads automatically.${R}
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

    if (state.lastTrackerSync) {
      const s = state.lastTrackerSync;
      console.log(`\nTracker Sync: ${s.outcome}`);
      console.log(`  Action: ${s.action}`);
      if (s.issueId) console.log(`  Issue: ${s.issueId}`);
      console.log(`  Reason: ${s.reason}`);
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

/**
 * Follow a specific session's event log in real-time.
 * Returns an object with abort() to stop following.
 * Resolves when the session finishes (polls session status).
 */
function startSessionFollow(
  session: SessionMeta,
  wsId: string,
  prjId: string,
  viewMode: LogViewMode = "conversation"
): { promise: Promise<void>; abort: () => void } {
  const eventsPath =
    session.sessionEventsPath ??
    sessionEventLogPath(wsId, prjId, session.id);
  const sessionLog = new SessionEventLog(eventsPath);
  const ws = new WorkspaceManager();

  const modeLabel = viewMode.toUpperCase();
  console.log(
    `\x1b[38;2;183;0;255m■\x1b[0m Starting session ${session.id.slice(0, 8)}${session.currentTaskId ? ` for ${session.currentTaskId}` : ""}...`
  );
  console.log(
    `  \x1b[2mView: ${modeLabel} | Ctrl+C to detach\x1b[0m`
  );
  console.log();

  let aborted = false;

  if (viewMode === "raw") {
    const ac = sessionLog.tail((event) => {
      const entries = aggregateEvents([event], "raw");
      for (const entry of entries) {
        console.log(formatEntry(entry));
      }
    });

    const promise = (async () => {
      // Poll session status until it's no longer running
      while (!aborted) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const sessions = await ws.listSessions(wsId, prjId);
          const current = sessions.find((s) => s.id === session.id);
          if (current && current.status !== "running") {
            // Give a moment for final events to flush
            await new Promise((r) => setTimeout(r, 500));
            break;
          }
        } catch {
          // Keep polling
        }
      }
      ac.abort();
    })();

    return {
      promise,
      abort: () => {
        aborted = true;
        ac.abort();
      },
    };
  }

  // Aggregated follow (conversation/activity)
  let buffer: ProviderEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (buffer.length === 0) return;
    const entries = aggregateEvents(buffer, viewMode);
    for (const entry of entries) {
      console.log(formatEntry(entry));
    }
    buffer = [];
  };

  const ac = sessionLog.tail((event) => {
    buffer.push(event);
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 150);
  });

  const promise = (async () => {
    while (!aborted) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const sessions = await ws.listSessions(wsId, prjId);
        const current = sessions.find((s) => s.id === session.id);
        if (current && current.status !== "running") {
          await new Promise((r) => setTimeout(r, 500));
          flush();
          break;
        }
      } catch {
        // Keep polling
      }
    }
    ac.abort();
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      flush();
      ac.abort();
    },
  };
}

/**
 * Print a short summary after a session finishes.
 */
async function printSessionEndSummary(
  sessionId: string,
  wsId: string,
  prjId: string
): Promise<void> {
  const ws = new WorkspaceManager();
  const sessions = await ws.listSessions(wsId, prjId);
  const session = sessions.find((s) => s.id === sessionId);

  console.log();
  if (session) {
    const icon = statusIcon(session.status);
    const color = statusColor(session.status);
    const dur = formatSessionDuration(session);
    console.log(
      `${color}${icon}\x1b[0m Session ${session.id.slice(0, 8)} ${color}${session.status}\x1b[0m (${dur})`
    );
    console.log(
      `  \x1b[32m${session.tasksCompleted} completed\x1b[0m  \x1b[31m${session.tasksFailed} failed\x1b[0m  ${session.taskCount} total`
    );
  }

  console.log();
  log.info(`Logs: qap logs --session ${sessionId.slice(0, 8)}`);
}

/**
 * Run a runner with follow/detach behavior.
 * - Default: follow session logs in real-time
 * - --detach: just run and print session ID
 * - --view <mode>: set follow view mode
 */
async function runWithFollow(
  runner: import("./core/runner.js").Runner,
  runFn: () => Promise<void>
): Promise<void> {
  const detach = hasFlag("detach") || hasFlag("d");
  const viewMode = (flag("view") ?? "conversation") as LogViewMode;

  if (detach) {
    // Start the run, print session info, return
    // We need to kick off the run and then print the session ID once available
    const runPromise = runFn();

    // Wait a moment for session to initialize
    await new Promise((r) => setTimeout(r, 300));
    const session = runner.getSession();
    if (session) {
      console.log(
        `\x1b[38;2;183;0;255m■\x1b[0m Session ${session.id.slice(0, 8)} started (detached)`
      );
      log.info(`Follow: qap logs --follow --session ${session.id.slice(0, 8)}`);
    }
    await runPromise;
    return;
  }

  // Follow mode (default)
  const opts = await makeRunnerOpts();
  const wsId = opts.workspaceId;
  const prjId = opts.projectId;

  // Start the run
  const runPromise = runFn();

  // Wait for session to be initialized
  let session: SessionMeta | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    session = runner.getSession();
    if (session) break;
  }

  if (!session || !wsId || !prjId) {
    // No session (dry-run or no workspace) — just await the run
    await runPromise;
    return;
  }

  // Start following
  const follow = startSessionFollow(session, wsId, prjId, viewMode);

  // Handle Ctrl+C: detach from follow but let the run continue in background
  const sigintHandler = () => {
    follow.abort();
    console.log();
    log.info(`Detached. Session ${session!.id.slice(0, 8)} continues in background.`);
    log.info(`Re-attach: qap logs --follow --session ${session!.id.slice(0, 8)}`);
    // Remove handler so next Ctrl+C actually kills
    process.removeListener("SIGINT", sigintHandler);
  };
  process.on("SIGINT", sigintHandler);

  // Wait for both run and follow to complete
  await runPromise;
  await follow.promise;
  process.removeListener("SIGINT", sigintHandler);

  // Print end summary
  await printSessionEndSummary(session.id, wsId, prjId);
}

async function cmdRun() {
  if (hasFlag("help")) {
    console.log(`
\x1b[1mqap run\x1b[0m — Run autonomous task loop

\x1b[1mUsage:\x1b[0m
  qap run                        Run and follow session logs (default)
  qap run --detach               Run without following logs
  qap run --view <mode>          Follow with view mode: conversation, activity, raw
  qap run --max <n>              Limit tasks to run

\x1b[1mExamples:\x1b[0m
  qap run                        Run all ready tasks, follow live output
  qap run --view activity        Follow with activity view
  qap run --detach               Start run, print session ID, return
  qap run --max 3 --detach       Run up to 3 tasks detached
`);
    return;
  }

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

  await runWithFollow(runner, () => runner.run());
}

async function cmdRunNext() {
  if (hasFlag("help")) {
    console.log(`
\x1b[1mqap run-next\x1b[0m — Run next ready task

\x1b[1mUsage:\x1b[0m
  qap run-next                   Run and follow session logs (default)
  qap run-next --detach          Run without following logs
  qap run-next --view <mode>     Follow with view mode: conversation, activity, raw

\x1b[1mExamples:\x1b[0m
  qap run-next                   Run next task, follow live output
  qap run-next --view activity   Follow with activity view
  qap run-next --detach          Start next task detached
`);
    return;
  }

  const configPath = await resolveConfigPath();
  const config = await loadConfig(configPath);
  const opts = await makeRunnerOpts();
  const runner = new Runner(config, opts);

  await runWithFollow(runner, () => runner.runNext());
}

async function cmdRunTask(taskId: string) {
  if (!taskId || hasFlag("help")) {
    console.log(`
\x1b[1mqap run-task\x1b[0m — Run a specific task

\x1b[1mUsage:\x1b[0m
  qap run-task <id>              Run and follow session logs (default)
  qap run-task <id> --detach     Run without following logs
  qap run-task <id> --view <m>   Follow with view mode: conversation, activity, raw

\x1b[1mExamples:\x1b[0m
  qap run-task QUE-256           Run task, follow live output
  qap run-task QUE-256 --follow  Same as above (follow is default)
  qap run-task QUE-256 --detach  Start task detached
  qap run-task QUE-256 --view activity
`);
    if (!taskId) return;
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

  await runWithFollow(runner, () => runner.run());
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

async function cmdLogs(): Promise<void> {
  if (hasFlag("help") || args[1] === "--help") {
    console.log(`
\x1b[1mqap logs\x1b[0m — View session event logs

\x1b[1mUsage:\x1b[0m
  qap logs                         Conversation view, current/latest session
  qap logs --follow                Tail live events
  qap logs --session <id>          Specific session (supports partial ID)
  qap logs --view <mode>           View mode: conversation, activity, raw
  qap logs --all                   Aggregate all sessions

\x1b[1mView modes:\x1b[0m
  conversation   Assistant messages + system notifications (default)
  activity       Tool calls, phase transitions, validations
  raw            Full event stream, no aggregation

\x1b[1mExamples:\x1b[0m
  qap logs --follow --view activity
  qap logs --session a1b2c3d4 --view raw
`);
    return;
  }

  const follow = hasFlag("follow") || hasFlag("f");
  const viewMode = (flag("view") ?? "conversation") as LogViewMode;
  const showAll = hasFlag("all");
  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();

  if (!workspace) {
    log.error("No workspace found for current directory.");
    log.info("Run: qap workspace add .");
    return;
  }

  const activeId = await ws.getActiveProjectId(workspace.id);
  if (!activeId) {
    log.error("No active project.");
    log.info("Run: qap project use <id>");
    return;
  }

  const sessions = await ws.listSessions(workspace.id, activeId);
  if (sessions.length === 0) {
    log.error("No sessions found.");
    log.info("Run: qap run or qap run-task <id> to create a session.");
    return;
  }

  // Resolve target session(s)
  const targetSessionId = flag("session");
  let targetSessions: typeof sessions;

  if (showAll) {
    targetSessions = sessions;
  } else if (targetSessionId) {
    const found = sessions.find(
      (s) => s.id === targetSessionId || s.id.startsWith(targetSessionId)
    );
    if (!found) {
      const similar = sessions
        .filter((s) => s.id.toLowerCase().includes(targetSessionId.toLowerCase()))
        .slice(0, 3);
      if (similar.length > 0) {
        log.error(`Session "${targetSessionId}" not found. Did you mean: ${similar.map((s) => s.id.slice(0, 8)).join(", ")}?`);
      } else {
        log.error(`Session "${targetSessionId}" not found.`);
        log.info(`Available: ${sessions.slice(0, 5).map((s) => s.id.slice(0, 8)).join(", ")}`);
      }
      return;
    }
    targetSessions = [found];
  } else {
    // Default: current running, or latest
    const running = sessions.find((s) => s.status === "running");
    targetSessions = [running ?? sessions[0]!];
  }

  // Resolve event log paths
  for (const session of targetSessions) {
    if (!session.sessionEventsPath) {
      const fallbackPath = sessionEventLogPath(workspace.id, activeId, session.id);
      if (existsSync(fallbackPath)) {
        session.sessionEventsPath = fallbackPath;
      }
    }
  }

  const validSessions = targetSessions.filter((s) => s.sessionEventsPath);
  if (validSessions.length === 0) {
    log.error("No session events found. Run with SDK backend to generate events.");
    return;
  }

  const target = validSessions[0]!;
  const sessionLog = new SessionEventLog(target.sessionEventsPath!);

  // Header
  const modeLabel = viewMode.toUpperCase();
  console.log(
    `\x1b[38;2;183;0;255m■\x1b[0m Session ${target.id.slice(0, 8)} — ${target.status} — ${modeLabel}`
  );
  console.log();

  if (!follow) {
    // One-shot: aggregate and print
    const events = await sessionLog.readAll();
    if (events.length === 0) {
      log.info("No events in session log.");
      return;
    }
    const entries = aggregateEvents(events, viewMode);
    for (const entry of entries) {
      console.log(formatEntry(entry));
    }
    console.log();
    log.info(`${entries.length} entries (${events.length} raw events)`);
    if (target.status === "running") {
      log.info(`Tip: qap logs --follow --session ${target.id.slice(0, 8)}`);
    }
    return;
  }

  // Follow mode: tail with aggregation
  log.info(`Following session ${target.id.slice(0, 8)}... (Ctrl+C to stop)`);

  if (viewMode === "raw") {
    // Raw mode: stream events 1:1
    const ac = sessionLog.tail((event) => {
      const entries = aggregateEvents([event], "raw");
      for (const entry of entries) {
        console.log(formatEntry(entry));
      }
    });

    process.on("SIGINT", () => {
      ac.abort();
      process.exit(0);
    });
  } else {
    // Aggregated follow: batch events and aggregate
    let buffer: import("./events/types.js").ProviderEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (buffer.length === 0) return;
      const entries = aggregateEvents(buffer, viewMode);
      for (const entry of entries) {
        console.log(formatEntry(entry));
      }
      buffer = [];
    };

    const ac = sessionLog.tail((event) => {
      buffer.push(event);
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 150);
    });

    process.on("SIGINT", () => {
      flush();
      ac.abort();
      process.exit(0);
    });
  }

  // Keep alive
  await new Promise(() => {});
}

// ── Session CLI ──────────────────────────────────────────────

async function cmdSessionCli(): Promise<void> {
  const sub = args[1];

  if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
    console.log(`
\x1b[1mqap session\x1b[0m — Session management

\x1b[1mUsage:\x1b[0m
  qap session list              List sessions for active project
  qap session show <id>         Show session details (supports partial ID)
  qap session latest            Show most recent session
  qap session current           Show currently running session

\x1b[1mExamples:\x1b[0m
  qap session list
  qap session show a1b2c3d4
  qap session latest
`);
    return;
  }

  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (!workspace) {
    log.error("No workspace found.");
    log.info("Run: qap workspace add .");
    return;
  }

  const activeId = await ws.getActiveProjectId(workspace.id);
  if (!activeId) {
    log.error("No active project.");
    log.info("Run: qap project use <id>");
    return;
  }

  const sessions = await ws.listSessions(workspace.id, activeId);

  switch (sub) {
    case "list":
    case "ls": {
      if (sessions.length === 0) {
        log.info("No sessions yet.");
        log.info("Run: qap run or qap run-task <id> to create one.");
        return;
      }
      console.log(
        `\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mSessions\x1b[0m (${sessions.length})\n`
      );
      console.log(
        `  ${"ID".padEnd(10)} ${"Status".padEnd(12)} ${"Action".padEnd(10)} ${"Started".padEnd(21)} ${"Duration".padEnd(10)} Tasks`
      );
      for (const s of sessions.slice(0, 20)) {
        const icon = statusIcon(s.status);
        const color = statusColor(s.status);
        const dur = formatSessionDuration(s);
        console.log(
          `  ${color}${icon}${"\x1b[0m"} ${s.id.slice(0, 8).padEnd(9)} ${color}${s.status.padEnd(12)}${"\x1b[0m"} ${(s.triggerAction ?? "—").padEnd(10)} ${s.startedAt.slice(0, 19).padEnd(21)} ${dur.padEnd(10)} ${s.tasksCompleted}/${s.taskCount}${s.tasksFailed > 0 ? ` (${s.tasksFailed} failed)` : ""}`
        );
      }
      console.log();
      log.info("Use: qap session show <id> for details");
      return;
    }

    case "show": {
      const id = args[2];
      if (!id) {
        log.error("Usage: qap session show <id>");
        return;
      }
      const session = sessions.find(
        (s) => s.id === id || s.id.startsWith(id)
      );
      if (!session) {
        const similar = sessions
          .filter((s) => s.id.toLowerCase().includes(id.toLowerCase()))
          .slice(0, 3);
        if (similar.length > 0) {
          log.error(`Session "${id}" not found. Did you mean: ${similar.map((s) => s.id.slice(0, 8)).join(", ")}?`);
        } else {
          log.error(`Session "${id}" not found.`);
        }
        return;
      }
      printSessionDetail(session);
      return;
    }

    case "latest": {
      if (sessions.length === 0) {
        log.info("No sessions yet.");
        return;
      }
      printSessionDetail(sessions[0]!);
      return;
    }

    case "current": {
      const running = sessions.find((s) => s.status === "running");
      if (!running) {
        log.info("No running session.");
        if (sessions.length > 0) {
          log.info(`Latest: ${sessions[0]!.id.slice(0, 8)} (${sessions[0]!.status})`);
          log.info("Use: qap session latest");
        }
        return;
      }
      printSessionDetail(running);
      return;
    }

    default: {
      // Try to treat as session ID
      const session = sessions.find(
        (s) => s.id === sub || s.id.startsWith(sub)
      );
      if (session) {
        printSessionDetail(session);
        return;
      }
      log.error(`Unknown subcommand: ${sub}`);
      log.info("Usage: qap session [list|show <id>|latest|current]");
    }
  }
}

function printSessionDetail(s: import("./workspace/types.js").SessionMeta): void {
  const icon = statusIcon(s.status);
  const color = statusColor(s.status);
  const dur = formatSessionDuration(s);

  console.log(
    `\n\x1b[38;2;183;0;255m■\x1b[0m Session ${s.id.slice(0, 8)}`
  );
  console.log(
    `  ${color}${icon} ${s.status.toUpperCase()}\x1b[0m (${dur})\n`
  );
  console.log(`  ${"ID".padEnd(16)} ${s.id}`);
  console.log(`  ${"Started".padEnd(16)} ${s.startedAt.slice(0, 19).replace("T", " ")}`);
  if (s.finishedAt) {
    console.log(`  ${"Finished".padEnd(16)} ${s.finishedAt.slice(0, 19).replace("T", " ")}`);
  }
  console.log(`  ${"Provider".padEnd(16)} ${s.provider}`);
  if (s.backend) console.log(`  ${"Backend".padEnd(16)} ${s.backend}`);
  if (s.triggerAction) console.log(`  ${"Triggered by".padEnd(16)} ${s.triggerAction}`);
  if (s.currentTaskId) console.log(`  ${"Current task".padEnd(16)} \x1b[36m${s.currentTaskId}\x1b[0m`);
  if (s.currentPhase) console.log(`  ${"Phase".padEnd(16)} ${s.currentPhase}`);
  if (s.activeTool) console.log(`  ${"Active tool".padEnd(16)} ${s.activeTool}`);

  console.log();
  console.log(`  \x1b[1mTasks\x1b[0m  \x1b[32m${s.tasksCompleted} completed\x1b[0m  \x1b[31m${s.tasksFailed} failed\x1b[0m  ${s.taskCount} total`);

  if (s.notes && s.notes.length > 0) {
    console.log(`\n  \x1b[1mNotes\x1b[0m`);
    for (const note of s.notes) {
      console.log(`    ${note}`);
    }
  }

  console.log();
  if (s.status === "running") {
    log.info(`Next: qap logs --follow --session ${s.id.slice(0, 8)}`);
  } else {
    log.info(`Next: qap logs --session ${s.id.slice(0, 8)}`);
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case "completed": return "\u2713";
    case "failed": return "\u2717";
    case "running": return "\u25B8";
    case "aborted": return "#";
    default: return "\u00B7";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "\x1b[32m";
    case "failed": return "\x1b[31m";
    case "running": return "\x1b[36m";
    case "aborted": return "\x1b[33m";
    default: return "\x1b[90m";
  }
}

function formatSessionDuration(s: import("./workspace/types.js").SessionMeta): string {
  if (!s.finishedAt) return s.status === "running" ? "running" : "\u2014";
  const ms = new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
  return ms < 60000 ? `${(ms / 1000).toFixed(0)}s` : `${(ms / 60000).toFixed(1)}m`;
}

// ── Say / Interrupt ─────────────────────────────────────────

async function cmdSay(): Promise<void> {
  const text = args.slice(1).join(" ");
  if (!text) {
    log.error("Usage: qap say <message>");
    log.info("Send a message to the running session.");
    return;
  }

  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (!workspace) { log.error("No workspace found."); return; }

  const activeId = await ws.getActiveProjectId(workspace.id);
  if (!activeId) { log.error("No active project."); return; }

  const sessions = await ws.listSessions(workspace.id, activeId);
  const running = sessions.find((s) => s.status === "running");

  if (running) {
    // Save as session note (live messaging not yet supported by backends)
    await ws.addSessionNote(workspace.id, activeId, running.id, `[user-message] ${text}`);
    log.success(`Message saved to session ${running.id.slice(0, 8)}.`);
    log.info("Note: Will be applied on next step (live input not yet supported).");
  } else {
    log.warn("No running session. Saving as project steering note.");
    await ws.appendSteering(workspace.id, activeId, `[user-message] ${text}`);
    log.success("Saved as steering note. Will be included in next session.");
  }
}

async function cmdInterrupt(): Promise<void> {
  const reason = args.slice(1).join(" ") || "User requested interrupt";

  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (!workspace) { log.error("No workspace found."); return; }

  const activeId = await ws.getActiveProjectId(workspace.id);
  if (!activeId) { log.error("No active project."); return; }

  const sessions = await ws.listSessions(workspace.id, activeId);
  const running = sessions.find((s) => s.status === "running");

  if (!running) {
    log.info("No running session to interrupt.");
    return;
  }

  // Save interrupt note and update session status
  await ws.addSessionNote(workspace.id, activeId, running.id, `[interrupt] ${reason}`);
  running.status = "aborted";
  running.finishedAt = new Date().toISOString();
  await ws.saveSession(workspace.id, activeId, running);
  log.success(`Session ${running.id.slice(0, 8)} interrupted.`);
  log.info(`Reason: ${reason}`);
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
