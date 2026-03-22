import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/loader.js";
import { AutopilotEngine } from "../core/autopilot.js";
import type { AutopilotConfig, AutopilotSummary } from "../core/types.js";
import { log } from "../utils/logger.js";
import { WorkspaceManager } from "../workspace/manager.js";
import { getProjectAutopilotStatusPath } from "../workspace/types.js";

// ── Flag Helpers ────────────────────────────────────────────

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function intFlag(args: string[], name: string): number | undefined {
  const v = flag(args, name);
  if (v == null) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

// ── Resolve Config Path ─────────────────────────────────────

async function resolveConfigPath(args: string[]): Promise<string> {
  const explicit = flag(args, "config");
  if (explicit) return explicit;

  if (existsSync("./autopilot.config.ts")) return "./autopilot.config.ts";

  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (workspace) {
    const activePath = await ws.getActiveConfigPath(workspace.id);
    if (activePath) return activePath;
  }

  return "./autopilot.config.ts";
}

// ── autopilot start ─────────────────────────────────────────

export async function cmdAutopilotStart(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    printStartHelp();
    return;
  }

  const configPath = await resolveConfigPath(args);
  if (!existsSync(configPath)) {
    log.error("No config found. Run `qap project init` or pass --config <path>.");
    return;
  }

  const config = await loadConfig(configPath);

  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (!workspace) {
    log.error("No workspace detected. Run `qap workspace add .` first.");
    return;
  }

  const projectId = await ws.getActiveProjectId(workspace.id);
  if (!projectId) {
    log.error("No active project. Run `qap project use <id>` first.");
    return;
  }

  const autopilotConfig: AutopilotConfig = {
    bounds: {
      maxTasks: intFlag(args, "max-tasks"),
      maxDurationMinutes: intFlag(args, "max-duration-minutes"),
      maxParallelTasks: intFlag(args, "max-parallel-tasks") ?? config.execution.maxParallelTasks ?? 1,
    },
    stopPolicy: {
      stopOnFailure: hasFlag(args, "stop-on-failure"),
      stopOnValidationFail: hasFlag(args, "stop-on-validation-fail"),
      stopOnRemediationExhausted: hasFlag(args, "stop-on-remediation-exhausted"),
      stopOnUnverifiedSync: hasFlag(args, "stop-on-unverified-sync"),
      stopOnCommitFail: !hasFlag(args, "no-stop-on-commit-fail"),
    },
    noSync: hasFlag(args, "no-sync"),
    detach: hasFlag(args, "detach"),
  };

  const engine = new AutopilotEngine(
    config,
    autopilotConfig,
    workspace.id,
    projectId
  );

  // Handle Ctrl+C gracefully
  const sigintHandler = () => {
    engine.requestStop();
    process.removeListener("SIGINT", sigintHandler);
  };
  process.on("SIGINT", sigintHandler);

  const summary = await engine.run();
  process.removeListener("SIGINT", sigintHandler);

  printSummary(summary);
}

// ── autopilot status ────────────────────────────────────────

export async function cmdAutopilotStatus(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    console.log(`
\x1b[1mqap autopilot status\x1b[0m — Show autopilot status

Reads the live AUTOPILOT_STATUS.md from the qap project directory.
`);
    return;
  }

  const configPath = await resolveConfigPath(args);
  if (!existsSync(configPath)) {
    log.error("No config found.");
    return;
  }

  const config = await loadConfig(configPath);
  const statusPath = getProjectAutopilotStatusPath(
    config.project.rootDir,
    config.project.id
  );

  if (!existsSync(statusPath)) {
    log.info("No autopilot status found. Run `qap autopilot start` first.");
    return;
  }

  try {
    const content = await readFile(statusPath, "utf-8");
    console.log(content);
  } catch {
    log.error("Failed to read autopilot status.");
  }
}

// ── autopilot stop ──────────────────────────────────────────

export async function cmdAutopilotStop(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    console.log(`
\x1b[1mqap autopilot stop\x1b[0m — Stop a running autopilot session

Marks any running autopilot sessions as aborted.
`);
    return;
  }

  const ws = new WorkspaceManager();
  const workspace = await ws.resolveWorkspaceFromCwd();
  if (!workspace) {
    log.error("No workspace detected.");
    return;
  }

  const projectId = await ws.getActiveProjectId(workspace.id);
  if (!projectId) {
    log.error("No active project.");
    return;
  }

  const sessions = await ws.listSessions(workspace.id, projectId);
  const running = sessions.filter(
    (s) => s.status === "running" && s.triggerAction === "autopilot"
  );

  if (running.length === 0) {
    log.info("No running autopilot sessions found.");
    return;
  }

  for (const session of running) {
    session.status = "aborted";
    session.finishedAt = new Date().toISOString();
    session.notes.push(`[${new Date().toISOString()}] Aborted by user via qap autopilot stop`);
    await ws.saveSession(workspace.id, projectId, session);
    log.info(`Aborted session: ${session.id.slice(0, 8)}`);
  }

  log.success(`Aborted ${running.length} autopilot session(s).`);
}

// ── autopilot resume ────────────────────────────────────────

export async function cmdAutopilotResume(args: string[]): Promise<void> {
  // Resume is essentially a new start that respects existing state
  log.info("Resume is equivalent to starting a new autopilot run.");
  log.info("The scheduler will pick up where it left off based on task states.");
  return cmdAutopilotStart(args);
}

// ── Help ────────────────────────────────────────────────────

export function printAutopilotHelp(): void {
  const B = "\x1b[1m";
  const D = "\x1b[2m";
  const R = "\x1b[0m";

  console.log(`
${B}qap autopilot${R} — Bounded unattended DAG-based autopilot

${B}Commands:${R}
  qap autopilot start            Start unattended autopilot
  qap autopilot status           Show live autopilot status
  qap autopilot stop             Stop running autopilot
  qap autopilot resume           Resume from current state

${B}Start Options:${R}
  --max-tasks <n>                Max tasks to complete
  --max-duration-minutes <n>     Max runtime in minutes
  --max-parallel-tasks <n>       Max concurrent tasks ${D}(default: 1)${R}
  --stop-on-failure              Stop on first task failure
  --stop-on-validation-fail      Stop on validation failure
  --stop-on-remediation-exhausted  Stop when remediation is exhausted
  --stop-on-unverified-sync      Stop on unverified tracker sync
  --stop-on-commit-fail          Stop on commit phase failure ${D}(default: on)${R}
  --no-sync                      Disable tracker sync
  --detach                       Run without following output
  --config <path>                Config file path

${B}Examples:${R}
  qap autopilot start --max-tasks 3 --max-parallel-tasks 2
  qap autopilot start --stop-on-failure --max-duration-minutes 60
  qap autopilot status
  qap autopilot stop
`);
}

function printStartHelp(): void {
  printAutopilotHelp();
}

// ── Summary Printer ─────────────────────────────────────────

function printSummary(summary: AutopilotSummary): void {
  const P = "\x1b[38;2;183;0;255m";
  const G = "\x1b[32m";
  const R = "\x1b[31m";
  const Y = "\x1b[33m";
  const D = "\x1b[2m";
  const B = "\x1b[1m";
  const X = "\x1b[0m";

  const dur = (summary.durationMs / 1000).toFixed(1);
  const cleanIcon = summary.endedCleanly ? `${G}✓${X}` : `${R}✗${X}`;

  console.log();
  console.log(`${P}■${X} ${B}Autopilot Summary${X}`);
  console.log();
  console.log(`  ${cleanIcon} Stop reason: ${summary.stopReason}`);
  console.log(`  Duration: ${dur}s`);
  console.log(`  ${G}${summary.tasksCompleted} completed${X}  ${R}${summary.tasksFailed} failed${X}  ${summary.totalSessionsSpawned} sessions`);

  if (summary.currentBlockers.length > 0) {
    console.log();
    console.log(`  ${Y}Blockers:${X}`);
    for (const b of summary.currentBlockers.slice(0, 5)) {
      console.log(`    - ${b}`);
    }
  }

  if (summary.nextReadyTasks.length > 0) {
    console.log();
    console.log(`  ${D}Next ready: ${summary.nextReadyTasks.join(", ")}${X}`);
  }

  if (summary.commitSummary.length > 0) {
    console.log();
    console.log(`  Commits:`);
    for (const c of summary.commitSummary) {
      const icon = c.committed ? `${G}✓${X}` : `${R}✗${X}`;
      console.log(`    ${icon} ${c.taskId}${c.reason ? ` — ${c.reason}` : ""}`);
    }
  }

  console.log();
  console.log(`  ${D}Full report: ~/.qap/workspaces/<ws>/projects/<prj>/summary.md${X}`);
  console.log(`  ${D}Live status: ~/.qap/workspaces/<ws>/projects/<prj>/AUTOPILOT_STATUS.md${X}`);
  console.log();
}
