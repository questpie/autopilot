import type {
  ProjectConfig,
  TaskConfig,
  TaskRunState,
  AgentProvider,
  PermissionProfile,
  PromptMode,
} from "./types.js";
import { transition } from "./state.js";
import { findNextTask, findReadyTasks, whatUnblocks } from "./readiness.js";
import { renderPrompt, type SteeringContext } from "../prompts/renderer.js";
import { ProviderRunner } from "../runners/provider.js";
import { ClaudeRunner, DEFAULT_CLAUDE_CONFIG } from "../runners/claude.js";
import { CodexRunner, DEFAULT_CODEX_CONFIG } from "../runners/codex.js";
import { Store } from "../storage/store.js";
import { ChangelogReporter } from "../reporters/changelog.js";
import { LinearReporter } from "../reporters/linear.js";
import { LiveStatusWriter } from "../reporters/live-status.js";
import { EventLog } from "../reporters/events.js";
import { log } from "../utils/logger.js";
import { WorkspaceManager } from "../workspace/manager.js";
import type { SessionMeta } from "../workspace/types.js";

export interface RunnerOptions {
  dryRun?: boolean;
  taskFilter?: string;
  maxTasks?: number;
  skipValidation?: boolean;
  noSync?: boolean;
  workspaceId?: string;
  projectId?: string;
}

export class Runner {
  private runners: Record<AgentProvider, ProviderRunner>;
  private store: Store;
  private changelog: ChangelogReporter;
  private linear: LinearReporter;
  private liveStatus: LiveStatusWriter;
  private events: EventLog;
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private stopRequested = false;
  private syncEnabled: boolean;
  private session: SessionMeta | null = null;
  private wsManager: WorkspaceManager;

  constructor(
    private config: ProjectConfig,
    private opts: RunnerOptions = {}
  ) {
    this.store = new Store(config.project.rootDir, config.project.id);

    const logFile =
      config.reporting?.sessionLogFile ??
      `${config.project.rootDir}/.autopilot-changelog.md`;
    this.changelog = new ChangelogReporter(logFile);

    // Initialize provider runners
    const claudeConfig = config.agents?.claude ?? DEFAULT_CLAUDE_CONFIG;
    const codexConfig = config.agents?.codex ?? DEFAULT_CODEX_CONFIG;

    this.runners = {
      claude: new ClaudeRunner(claudeConfig),
      codex: new CodexRunner(codexConfig),
    };

    // Sync is disabled by: --no-sync, --dry-run, or tracker.enabled=false
    this.syncEnabled =
      !opts.noSync &&
      !opts.dryRun &&
      (config.tracker?.enabled ?? true) &&
      config.tracker?.provider === "linear";

    // Live status + structured event log
    const protoDir = new URL("../../", import.meta.url).pathname.replace(
      /\/$/,
      ""
    );
    this.liveStatus = new LiveStatusWriter(protoDir);
    this.events = new EventLog(`${protoDir}/events.jsonl`);

    // Linear reporter delegates to the default agent runner
    const defaultRunner =
      this.runners[config.execution.defaultProvider];
    this.linear = new LinearReporter(config.tracker, {
      runner: defaultRunner,
      cwd: config.project.rootDir,
      permissionProfile: config.execution.defaultPermissionProfile,
      enabled: this.syncEnabled,
    });

    this.wsManager = new WorkspaceManager();
  }

  private async initSession(): Promise<void> {
    const wsId = this.opts.workspaceId;
    const prjId = this.opts.projectId;
    if (!wsId || !prjId) return;

    const protoDir = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
    this.session = {
      id: this.store.getSessionId(),
      projectId: prjId,
      workspaceId: wsId,
      startedAt: new Date().toISOString(),
      status: "running",
      provider: this.config.execution.defaultProvider,
      taskCount: this.config.tasks.length,
      tasksCompleted: 0,
      tasksFailed: 0,
      notes: [],
      eventLogPath: `${protoDir}/events.jsonl`,
      changelogPath: this.config.reporting?.sessionLogFile ??
        `${this.config.project.rootDir}/.autopilot-changelog.md`,
    };
    await this.wsManager.saveSession(wsId, prjId, this.session);
  }

  private async updateSession(
    patch: Partial<SessionMeta>
  ): Promise<void> {
    if (!this.session || !this.opts.workspaceId || !this.opts.projectId) return;
    Object.assign(this.session, patch);
    this.session.lastEventAt = new Date().toISOString();
    await this.wsManager.saveSession(
      this.opts.workspaceId,
      this.opts.projectId,
      this.session
    );
  }

  private async buildSteering(taskId: string): Promise<SteeringContext> {
    const ctx: SteeringContext = {};
    const wsId = this.opts.workspaceId;
    const prjId = this.opts.projectId;

    if (wsId && prjId) {
      ctx.projectSteering = await this.wsManager.readSteering(wsId, prjId);
    }

    const taskState = this.store.getTask(taskId);
    if (taskState && taskState.notes.length > 0) {
      ctx.taskNotes = taskState.notes;
    }

    if (this.session && this.session.notes.length > 0) {
      ctx.sessionNotes = this.session.notes;
    }

    return ctx;
  }

  requestStop(): void {
    this.stopRequested = true;
    log.warn("Stop requested. Will finish current task and stop.");
  }

  async run(): Promise<void> {
    await this.store.load();

    for (const task of this.config.tasks) {
      this.store.initTask(task.id);
    }

    this.refreshReadiness();
    await this.store.save();

    if (!this.opts.dryRun) {
      await this.initSession();
      await this.liveStatus.write(this.config, this.store, "run-start");
      await this.events.emit({
        ts: new Date().toISOString(),
        event: "run-start",
        detail: `${this.config.tasks.length} tasks, mode=${this.config.execution.mode}`,
      });
    }

    log.divider();
    log.info(`Autopilot started: ${this.config.project.name}`);
    log.info(
      `Mode: ${this.config.execution.mode} | Provider: ${this.config.execution.defaultProvider} | Permission: ${this.config.execution.defaultPermissionProfile}`
    );
    log.info(
      `Tasks: ${this.config.tasks.length} | Dry run: ${this.opts.dryRun ?? false} | Sync: ${this.syncEnabled}`
    );
    log.divider();

    if (this.config.execution.mode === "prompt-only") {
      log.info(
        "Running in prompt-only mode. Use 'autopilot prompt <task>' to get prompts."
      );
      return;
    }

    // Init changelog only for non-dry-run
    if (!this.opts.dryRun) {
      await this.changelog.init(this.store.getSessionId());
    }

    if (this.opts.taskFilter) {
      await this.runSingleTask(this.opts.taskFilter);
    } else {
      await this.runLoop();
    }

    if (!this.opts.dryRun) {
      await this.finalize();
    } else {
      log.divider();
      log.info("[DRY RUN] No state changes persisted.");
    }
  }

  /** Run just the next ready task */
  async runNext(): Promise<void> {
    await this.store.load();
    for (const task of this.config.tasks) {
      this.store.initTask(task.id);
    }
    this.refreshReadiness();

    const next = findNextTask(
      this.config.tasks,
      this.store.getAllTasks()
    );
    if (!next) {
      log.warn("No ready tasks to run.");
      this.printBlockedSummary();
      return;
    }

    if (!this.opts.dryRun) {
      await this.changelog.init(this.store.getSessionId());
    }

    await this.executeTask(next);

    if (!this.opts.dryRun) {
      await this.finalize();
    }
  }

  private async runLoop(): Promise<void> {
    const maxTasks = this.opts.maxTasks ?? Infinity;

    while (this.tasksCompleted < maxTasks && !this.stopRequested) {
      this.refreshReadiness();
      const next = findNextTask(
        this.config.tasks,
        this.store.getAllTasks()
      );

      if (!next) {
        const allStates = this.store.getAllTasks();
        const remaining = this.config.tasks.filter(
          (t) =>
            !["done", "committed"].includes(
              allStates[t.id]?.state ?? "todo"
            )
        );
        if (remaining.length === 0) {
          log.success("All tasks completed!");
        } else {
          log.warn(
            `No ready tasks. ${remaining.length} tasks remaining.`
          );
          this.printBlockedSummary();
        }
        break;
      }

      await this.executeTask(next);
      this.tasksCompleted++;

      if (
        this.config.execution.stopOnFailure &&
        this.store.getTask(next.id)?.state === "failed"
      ) {
        log.warn("stopOnFailure is set. Stopping after failure.");
        break;
      }
    }

    if (this.stopRequested) {
      log.info("Stopped by user request.");
    }
  }

  private async runSingleTask(taskId: string): Promise<void> {
    const task = this.config.tasks.find((t) => t.id === taskId);
    if (!task) {
      log.error(`Task ${taskId} not found.`);
      return;
    }

    this.refreshReadiness();
    const state = this.store.getTask(taskId);
    if (state && !["todo", "ready"].includes(state.state)) {
      log.warn(
        `Task ${taskId} is in state "${state.state}", not ready.`
      );
      return;
    }

    await this.executeTask(task);
  }

  private async executeTask(task: TaskConfig): Promise<void> {
    const provider =
      task.provider ?? this.config.execution.defaultProvider;
    const profile =
      task.permissionProfile ??
      this.config.execution.defaultPermissionProfile;
    const timeout =
      task.timeoutMs ??
      this.config.agents?.[provider]?.timeoutMs ??
      600_000;
    const maxRetries = task.retryPolicy?.maxAttempts ?? 1;

    const runner = this.runners[provider];

    log.divider();
    log.task(
      task.id,
      "starting",
      `${task.title} [${provider}/${profile}]`
    );

    // ── Dry run ─────────────────────────────────────────────
    if (this.opts.dryRun) {
      const steering = await this.buildSteering(task.id);
      const prompt = await renderPrompt(
        this.config,
        task,
        "implement",
        this.store.getAllTasks(),
        steering
      );
      log.info(
        `[DRY RUN] Would send ${prompt.length} chars to ${provider} [${profile}]`
      );
      log.info(
        `[DRY RUN] Timeout: ${timeout}ms | Retries: ${maxRetries}`
      );
      console.log("\n" + prompt.slice(0, 800) + "\n...\n");
      return;
    }

    // ── Snapshot ready tasks BEFORE this task runs ───────────
    const readyBefore = new Set(
      findReadyTasks(this.config.tasks, this.store.getAllTasks()).map(
        (t) => t.id
      )
    );

    // ── Live execution ──────────────────────────────────────
    let taskState = this.store.getTask(task.id)!;
    if (taskState.state === "todo") {
      taskState = transition(taskState, "ready");
    }
    taskState = transition(taskState, "in_progress");
    this.store.setTask(task.id, taskState);
    await this.store.save();

    await this.changelog.logTaskStart(task);
    await this.linear.syncTaskStart(task);
    await this.liveStatus.write(
      this.config,
      this.store,
      "task-start",
      { currentTask: task, provider, profile }
    );
    await this.events.emit({
      ts: new Date().toISOString(),
      event: "task-start",
      taskId: task.id,
      epicId: task.epicId,
      provider,
      profile,
    });
    await this.updateSession({ currentTaskId: task.id });

    // Branch isolation
    if (task.branchName) {
      await this.createBranch(task.branchName);
    }

    // ── Implementation (with retry) ──────────────────────────
    let implSuccess = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        log.task(
          task.id,
          "retrying",
          `Attempt ${attempt}/${maxRetries}`
        );
        taskState = { ...taskState, state: "in_progress" };
      }

      log.task(task.id, "implementing", `Sending to ${provider}...`);
      await this.liveStatus.write(
        this.config,
        this.store,
        "implementation-start",
        { currentTask: task, provider, profile }
      );

      const steering = await this.buildSteering(task.id);
      const implPrompt = await renderPrompt(
        this.config,
        task,
        "implement",
        this.store.getAllTasks(),
        steering
      );

      const implResult = await runner.run(implPrompt, {
        cwd: this.config.project.rootDir,
        timeout,
        permissionProfile: profile,
      });

      taskState.runs.push(implResult.record);

      if (implResult.success) {
        implSuccess = true;
        taskState = transition(taskState, "implemented");
        this.store.setTask(task.id, taskState);
        await this.store.save();
        await this.changelog.logTaskResult(
          task,
          taskState,
          implResult
        );
        await this.liveStatus.write(
          this.config,
          this.store,
          "implementation-done",
          { currentTask: task, provider, profile }
        );
        await this.events.emit({
          ts: new Date().toISOString(),
          event: "implementation-done",
          taskId: task.id,
          provider,
          profile,
          duration: implResult.duration,
          exitCode: implResult.exitCode,
        });
        log.task(task.id, "implemented", "Implementation done.");
        break;
      }

      log.task(
        task.id,
        "failed",
        `Attempt ${attempt} failed: ${implResult.error}`
      );
      await this.changelog.logTaskResult(
        task,
        taskState,
        implResult
      );

      if (attempt === maxRetries) {
        taskState = transition(taskState, "failed");
        taskState.error = implResult.error;
        this.store.setTask(task.id, taskState);
        await this.store.save();
        await this.liveStatus.write(
          this.config,
          this.store,
          "task-failed",
          { currentTask: task, provider, profile }
        );
        await this.events.emit({
          ts: new Date().toISOString(),
          event: "task-failed",
          taskId: task.id,
          provider,
          error: implResult.error,
          duration: implResult.duration,
        });
        await this.linear.syncTaskDone(
          task,
          taskState,
          implResult
        );
        this.tasksFailed++;
        await this.updateSession({
          tasksFailed: this.tasksFailed,
          currentTaskId: undefined,
        });
        return;
      }
    }

    if (!implSuccess) return;

    // ── Validations ──────────────────────────────────────────
    if (!this.opts.skipValidation) {
      const v1 = await this.runValidation(
        task,
        runner,
        "validate-primary",
        timeout,
        profile
      );
      if (!v1) return;

      const v2 = await this.runValidation(
        task,
        runner,
        "validate-secondary",
        timeout,
        profile
      );
      if (!v2) return;
    } else {
      taskState = this.store.getTask(task.id)!;
      taskState = transition(taskState, "validated_primary");
      taskState = transition(taskState, "validated_secondary");
      this.store.setTask(task.id, taskState);
      await this.store.save();
    }

    // ── Validate command (with explicit policy) ──────────────
    if (
      this.config.execution.validateAfterEachTask &&
      this.config.execution.validateCommand
    ) {
      const passed = await this.runValidateCommand(task);
      const policy =
        this.config.execution.validateCommandPolicy ?? "warn";

      if (!passed && policy === "block") {
        taskState = this.store.getTask(task.id)!;
        taskState = transition(taskState, "failed");
        taskState.error = "validate-command failed (policy=block)";
        this.store.setTask(task.id, taskState);
        await this.store.save();
        await this.liveStatus.write(
          this.config,
          this.store,
          "task-failed",
          { currentTask: task, provider, profile }
        );
        await this.events.emit({
          ts: new Date().toISOString(),
          event: "task-failed",
          taskId: task.id,
          error: "validate-command failed (policy=block)",
        });
        log.task(
          task.id,
          "failed",
          "Validate command failed and policy=block."
        );
        return;
      }
    }

    // ── Diff summary ─────────────────────────────────────────
    const diffSummary = await this.captureDiffSummary();
    if (diffSummary) {
      await this.changelog.logDiffSummary(task.id, diffSummary);
      log.info(`Diff summary:\n${diffSummary}`);
    }

    // ── Finalize task ────────────────────────────────────────
    taskState = this.store.getTask(task.id)!;
    taskState = transition(taskState, "committed");
    taskState = transition(taskState, "done");
    this.store.setTask(task.id, taskState);
    await this.store.save();

    // ── Compute unlocked (compare ready before vs after) ─────
    this.refreshReadiness();
    const readyAfter = findReadyTasks(
      this.config.tasks,
      this.store.getAllTasks()
    ).map((t) => t.id);
    const newlyUnlocked = readyAfter.filter(
      (id) => !readyBefore.has(id)
    );

    await this.liveStatus.write(
      this.config,
      this.store,
      "task-done",
      { currentTask: task, provider, profile }
    );
    await this.events.emit({
      ts: new Date().toISOString(),
      event: "task-done",
      taskId: task.id,
      provider,
      unlocked: newlyUnlocked,
      diffSummary: diffSummary ?? undefined,
    });
    await this.linear.syncTaskDone(task, taskState, {
      success: true,
      output: "",
      exitCode: 0,
      duration: 0,
      record: taskState.runs[taskState.runs.length - 1]!,
    });

    if (newlyUnlocked.length > 0) {
      log.task(
        task.id,
        "done",
        `Unlocked: ${newlyUnlocked.join(", ")}`
      );
      await this.changelog.logUnlocked(task.id, newlyUnlocked);
    } else {
      log.task(task.id, "done", "No new tasks unlocked.");
    }

    this.store.addChangelog({
      taskId: task.id,
      action: "done",
      detail: `Completed. Unlocked: ${newlyUnlocked.length > 0 ? newlyUnlocked.join(", ") : "none"}.`,
      agentProvider: provider,
    });
    await this.store.save();

    this.tasksCompleted++;
    await this.updateSession({
      tasksCompleted: this.tasksCompleted,
      currentTaskId: undefined,
    });
  }

  private async runValidation(
    task: TaskConfig,
    runner: ProviderRunner,
    mode: PromptMode,
    timeout: number,
    profile: PermissionProfile
  ): Promise<boolean> {
    const label =
      mode === "validate-primary" ? "Primary" : "Secondary";
    const targetState =
      mode === "validate-primary"
        ? ("validated_primary" as const)
        : ("validated_secondary" as const);

    log.task(task.id, "validating", `${label} validation...`);

    const valSteering = await this.buildSteering(task.id);
    const prompt = await renderPrompt(
      this.config,
      task,
      mode,
      this.store.getAllTasks(),
      valSteering
    );

    const result = await runner.run(prompt, {
      cwd: this.config.project.rootDir,
      timeout,
      permissionProfile: profile,
    });

    let taskState = this.store.getTask(task.id)!;
    taskState.runs.push(result.record);

    const passed =
      result.success && !result.output.includes("Result: FAIL");

    await this.changelog.logValidation(
      task.id,
      mode,
      passed,
      result.output
    );
    await this.events.emit({
      ts: new Date().toISOString(),
      event: passed ? "validation-pass" : "validation-fail",
      taskId: task.id,
      detail: mode,
      duration: result.duration,
    });

    if (!passed) {
      taskState = transition(taskState, "failed");
      taskState.error = `${label} validation failed`;
      this.store.setTask(task.id, taskState);
      await this.store.save();
      log.task(task.id, "failed", `${label} validation failed.`);
      this.tasksFailed++;
      await this.updateSession({
        tasksFailed: this.tasksFailed,
        currentTaskId: undefined,
      });
      return false;
    }

    taskState = transition(taskState, targetState);
    this.store.setTask(task.id, taskState);
    await this.store.save();
    log.task(task.id, targetState, `${label} validation passed.`);
    return true;
  }

  /** Returns true if passed, false if failed */
  private async runValidateCommand(
    task: TaskConfig
  ): Promise<boolean> {
    const cmd = this.config.execution.validateCommand!;
    const policy =
      this.config.execution.validateCommandPolicy ?? "warn";
    log.task(
      task.id,
      "validating",
      `Running: ${cmd} (policy=${policy})`
    );
    try {
      const proc = Bun.spawn(cmd.split(" "), {
        cwd: this.config.project.rootDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      await this.events.emit({
        ts: new Date().toISOString(),
        event:
          exitCode === 0
            ? "validate-command-pass"
            : "validate-command-fail",
        taskId: task.id,
        exitCode,
        detail: `policy=${policy}`,
      });

      if (exitCode !== 0) {
        log.task(
          task.id,
          "warn",
          `Validate command failed (exit ${exitCode}, policy=${policy})`
        );
        await this.changelog.logValidation(
          task.id,
          `validate-command (policy=${policy})`,
          false,
          stdout.slice(0, 500)
        );
        return false;
      }

      log.task(task.id, "ok", "Validate command passed.");
      return true;
    } catch (err) {
      log.warn(`Validate command error: ${err}`);
      return false;
    }
  }

  /**
   * Capture git diff --stat, filter out noise like tsconfig.tsbuildinfo.
   */
  private async captureDiffSummary(): Promise<string | null> {
    try {
      const proc = Bun.spawn(
        ["git", "diff", "--stat", "HEAD"],
        {
          cwd: this.config.project.rootDir,
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      if (!stdout.trim()) return null;

      // Filter out build artifacts
      const lines = stdout
        .split("\n")
        .filter(
          (l) =>
            !l.includes("tsconfig.tsbuildinfo") &&
            !l.includes("node_modules")
        );

      return lines.join("\n").trim() || null;
    } catch {
      return null;
    }
  }

  private refreshReadiness(): void {
    const ready = findReadyTasks(
      this.config.tasks,
      this.store.getAllTasks()
    );
    for (const task of ready) {
      const state = this.store.getTask(task.id);
      if (state && state.state === "todo") {
        this.store.setTask(task.id, transition(state, "ready"));
      }
    }
  }

  private printBlockedSummary(): void {
    const allStates = this.store.getAllTasks();
    for (const task of this.config.tasks) {
      const state = allStates[task.id]?.state ?? "todo";
      if (state === "blocked" || state === "failed") {
        log.task(
          task.id,
          state,
          `${task.title} — ${allStates[task.id]?.error ?? "no details"}`
        );
      }
    }
  }

  private async createBranch(branchName: string): Promise<void> {
    try {
      const proc = Bun.spawn(
        ["git", "checkout", "-B", branchName],
        {
          cwd: this.config.project.rootDir,
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      await proc.exited;
      log.info(`Created/switched to branch: ${branchName}`);
    } catch (err) {
      log.warn(`Failed to create branch ${branchName}: ${err}`);
    }
  }

  private async finalize(): Promise<void> {
    const allStates = this.store.getAllTasks();
    const total = this.config.tasks.length;
    const done = this.config.tasks.filter((t) =>
      ["done", "committed"].includes(
        allStates[t.id]?.state ?? "todo"
      )
    ).length;
    const failed = this.config.tasks.filter(
      (t) => allStates[t.id]?.state === "failed"
    ).length;
    const blocked = this.config.tasks.filter(
      (t) => allStates[t.id]?.state === "blocked"
    ).length;

    log.divider();
    log.info(
      `Session: ${done}/${total} done, ${failed} failed, ${blocked} blocked`
    );

    await this.changelog.logSummary(total, done, failed, blocked);
    await this.linear.syncSummary({ total, done, failed, blocked });
    await this.liveStatus.write(this.config, this.store, "run-stop");
    await this.events.emit({
      ts: new Date().toISOString(),
      event: "run-stop",
      detail: `${done}/${total} done, ${failed} failed, ${blocked} blocked`,
    });
    await this.store.save();

    // Close session record
    const sessionStatus = failed > 0 ? "failed" : "completed";
    await this.updateSession({
      finishedAt: new Date().toISOString(),
      status: sessionStatus as SessionMeta["status"],
      tasksCompleted: done,
      tasksFailed: failed,
      currentTaskId: undefined,
    });
  }

  getStore(): Store {
    return this.store;
  }

  getConfig(): ProjectConfig {
    return this.config;
  }
}
