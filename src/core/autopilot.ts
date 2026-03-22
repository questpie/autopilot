import type {
  ProjectConfig,
  TaskConfig,
  TaskRunState,
  AgentProvider,
  AgentResult,
  PermissionProfile,
  PromptMode,
  AutopilotConfig,
  AutopilotStopReason,
  AutopilotSummary,
  TrackerSyncResult,
} from "./types.js";
import { transition } from "./state.js";
import { findReadyTasks } from "./readiness.js";
import { DagScheduler, DEFAULT_SCHEDULER_POLICY, type SchedulerPolicy } from "./scheduler.js";
import { parseValidationFindings } from "./runner.js";
import {
  renderPrompt,
  type SteeringContext,
  type RemediationContext,
  type CommitContext,
} from "../prompts/renderer.js";
import { ProviderRunner } from "../runners/provider.js";
import { ClaudeRunner, DEFAULT_CLAUDE_CONFIG } from "../runners/claude.js";
import { CodexRunner, DEFAULT_CODEX_CONFIG } from "../runners/codex.js";
import { ClaudeSdkRunner } from "../runners/claude-sdk.js";
import { Store } from "../storage/store.js";
import { ChangelogReporter } from "../reporters/changelog.js";
import { LinearReporter } from "../reporters/linear.js";
import { LiveStatusWriter } from "../reporters/live-status.js";
import { EventLog } from "../reporters/events.js";
import { SessionEventLog, sessionEventLogPath } from "../events/session-log.js";
import type { ProviderEventSink } from "../events/types.js";
import { log } from "../utils/logger.js";
import { WorkspaceManager } from "../workspace/manager.js";
import {
  getProjectAutopilotStatusPath,
  getProjectChangelogPath,
  getProjectEventLogPath,
  getProjectLiveStatusPath,
  getProjectSummaryPath,
  type SessionMeta,
} from "../workspace/types.js";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// ── Task Execution Result ───────────────────────────────────

interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  stopReason?: AutopilotStopReason;
  committed: boolean;
  commitReason?: string;
  syncOutcome?: string;
  remediationAttempts: number;
  remediationResult?: string;
  sessionId: string;
  durationMs: number;
}

// ── Autopilot Engine ────────────────────────────────────────

export class AutopilotEngine {
  private runners: Record<AgentProvider, ProviderRunner>;
  private claudeSdkRunner: ClaudeSdkRunner | null = null;
  private store: Store;
  private changelog: ChangelogReporter;
  private linear: LinearReporter;
  private liveStatus: LiveStatusWriter;
  private events: EventLog;
  private wsManager: WorkspaceManager;
  private scheduler: DagScheduler;
  private useClaudeSdk: boolean;
  private syncEnabled: boolean;

  // ── Autopilot State ──
  private masterSession: SessionMeta | null = null;
  private stopRequested = false;
  private stopReason: AutopilotStopReason | null = null;
  private startedAt: number = 0;
  private tasksCompleted: string[] = [];
  private tasksFailed: string[] = [];
  private sessionsSpawned: string[] = [];
  private syncOutcomes: { taskId: string; outcome: string }[] = [];
  private remediationSummary: { taskId: string; attempts: number; result: string }[] = [];
  private commitSummary: { taskId: string; committed: boolean; reason?: string }[] = [];

  constructor(
    private config: ProjectConfig,
    private autopilotConfig: AutopilotConfig,
    private workspaceId: string,
    private projectId: string
  ) {
    this.store = new Store(config.project.rootDir, config.project.id);

    const logFile =
      config.reporting?.sessionLogFile ??
      getProjectChangelogPath(config.project.rootDir, config.project.id);
    this.changelog = new ChangelogReporter(logFile);

    const claudeConfig = { ...DEFAULT_CLAUDE_CONFIG, ...(config.agents?.claude ?? {}) };
    const codexConfig = { ...DEFAULT_CODEX_CONFIG, ...(config.agents?.codex ?? {}) };

    this.runners = {
      claude: new ClaudeRunner(claudeConfig),
      codex: new CodexRunner(codexConfig),
    };

    this.useClaudeSdk = claudeConfig.backend === "sdk";
    if (this.useClaudeSdk) {
      this.claudeSdkRunner = new ClaudeSdkRunner(claudeConfig);
    }

    this.syncEnabled =
      !autopilotConfig.noSync &&
      (config.tracker?.enabled ?? true) &&
      config.tracker?.provider === "linear";

    const defaultRunner = this.runners[config.execution.defaultProvider];
    this.linear = new LinearReporter(config.tracker, {
      runner: defaultRunner,
      cwd: config.project.rootDir,
      permissionProfile: config.execution.defaultPermissionProfile,
      enabled: this.syncEnabled,
    });

    this.liveStatus = new LiveStatusWriter(
      getProjectLiveStatusPath(config.project.rootDir, config.project.id)
    );
    this.events = new EventLog(
      getProjectEventLogPath(config.project.rootDir, config.project.id)
    );
    this.wsManager = new WorkspaceManager();
    this.scheduler = new DagScheduler();
  }

  requestStop(): void {
    this.stopRequested = true;
    this.stopReason = "user-requested";
    log.warn("Stop requested. Finishing current tasks and stopping.");
  }

  // ── Main Entry Point ──────────────────────────────────────

  async run(): Promise<AutopilotSummary> {
    this.startedAt = Date.now();

    // 1. Load state + init tasks
    await this.store.load();
    for (const task of this.config.tasks) {
      this.store.initTask(task.id);
    }
    this.refreshReadiness();
    await this.store.save();

    // 2. Crash recovery: detect stale running sessions
    await this.recoverStaleSessions();

    // 3. Init master session
    await this.initMasterSession();
    await this.changelog.init(this.masterSession!.id);

    // 4. Write initial status
    await this.writeAutopilotStatus("autopilot-start");
    await this.events.emit({
      ts: new Date().toISOString(),
      event: "autopilot-start",
      detail: `mode=unattended, maxTasks=${this.autopilotConfig.bounds.maxTasks ?? "∞"}, maxParallel=${this.autopilotConfig.bounds.maxParallelTasks}`,
    });

    log.divider();
    log.info(`Autopilot started: ${this.config.project.name}`);
    log.info(
      `Mode: unattended | Provider: ${this.config.execution.defaultProvider} | Backend: ${this.useClaudeSdk ? "sdk" : "cli"}`
    );
    log.info(
      `Bounds: maxTasks=${this.autopilotConfig.bounds.maxTasks ?? "∞"}, maxParallel=${this.autopilotConfig.bounds.maxParallelTasks}, maxDuration=${this.autopilotConfig.bounds.maxDurationMinutes ?? "∞"}min`
    );
    log.info(
      `Stop policy: onFailure=${this.autopilotConfig.stopPolicy.stopOnFailure}, onValidationFail=${this.autopilotConfig.stopPolicy.stopOnValidationFail}, onCommitFail=${this.autopilotConfig.stopPolicy.stopOnCommitFail}`
    );
    log.divider();

    // 5. Run DAG scheduler loop
    await this.runSchedulerLoop();

    // 6. Write summary
    const summary = this.buildSummary();
    await this.writeSummaryReport(summary);
    await this.finalizeMasterSession(summary);

    return summary;
  }

  // ── Crash Recovery ────────────────────────────────────────

  private async recoverStaleSessions(): Promise<void> {
    const sessions = await this.wsManager.listSessions(
      this.workspaceId,
      this.projectId
    );
    const stale = sessions.filter((s) => s.status === "running");

    if (stale.length === 0) return;

    log.warn(`Found ${stale.length} stale running session(s). Marking as aborted.`);
    for (const session of stale) {
      session.status = "aborted";
      session.finishedAt = new Date().toISOString();
      session.notes.push(`[${new Date().toISOString()}] Aborted: stale session detected on autopilot start`);
      await this.wsManager.saveSession(this.workspaceId, this.projectId, session);
      log.info(`  Aborted stale session: ${session.id.slice(0, 8)}`);

      await this.changelog.logMessage(
        `RECOVERY: aborted stale session ${session.id.slice(0, 8)}`
      );
    }
  }

  // ── Scheduler Loop ────────────────────────────────────────

  private async runSchedulerLoop(): Promise<void> {
    const policy: SchedulerPolicy = {
      ...DEFAULT_SCHEDULER_POLICY,
      maxParallelTasks: this.autopilotConfig.bounds.maxParallelTasks,
    };

    const runningPromises = new Map<
      string,
      Promise<TaskExecutionResult>
    >();

    while (this.shouldContinue()) {
      this.refreshReadiness();

      // Get next batch from scheduler
      const batch = this.scheduler.getNextBatch(
        this.config.tasks,
        this.store.getAllTasks(),
        policy
      );

      // Start new tasks
      for (const task of batch) {
        if (!this.shouldContinue()) break;

        this.scheduler.markRunning(task.id);
        log.info(
          `[scheduler] Starting task ${task.id} [${task.track}] (running: ${this.scheduler.getRunningCount()}/${policy.maxParallelTasks})`
        );

        const promise = this.executeTaskWithSession(task);
        runningPromises.set(task.id, promise);
      }

      // If nothing running and nothing to start, we're done
      if (runningPromises.size === 0) {
        const allStates = this.store.getAllTasks();
        const remaining = this.config.tasks.filter(
          (t) => !["done", "committed"].includes(allStates[t.id]?.state ?? "todo")
        );
        if (remaining.length === 0) {
          this.stopReason = "all-tasks-done";
          log.success("All tasks completed!");
        } else {
          this.stopReason = "no-ready-tasks";
          log.warn(`No ready tasks. ${remaining.length} tasks remaining.`);
        }
        break;
      }

      // Wait for any task to complete
      const completed = await Promise.race(
        [...runningPromises.entries()].map(([id, p]) =>
          p.then((result) => ({ id, result }))
        )
      );

      runningPromises.delete(completed.id);
      this.scheduler.markDone(completed.id);

      // Process result
      this.processTaskResult(completed.result);

      // Update autopilot status
      await this.writeAutopilotStatus("task-completed");
      await this.updateMasterSession();
    }

    // Wait for remaining running tasks to finish
    if (runningPromises.size > 0) {
      log.info(`Waiting for ${runningPromises.size} running task(s) to finish...`);
      const remaining = await Promise.allSettled(
        [...runningPromises.entries()].map(([id, p]) =>
          p.then((result) => ({ id, result }))
        )
      );

      for (const settled of remaining) {
        if (settled.status === "fulfilled") {
          this.scheduler.markDone(settled.value.id);
          this.processTaskResult(settled.value.result);
        }
      }
    }

    if (this.stopRequested && !this.stopReason) {
      this.stopReason = "user-requested";
    }
  }

  // ── Task Execution (with dedicated session) ───────────────

  private async executeTaskWithSession(
    task: TaskConfig
  ): Promise<TaskExecutionResult> {
    const sessionId = crypto.randomUUID();
    const start = Date.now();

    // Create per-task session
    const eventsPath = sessionEventLogPath(
      this.workspaceId,
      this.projectId,
      sessionId
    );
    const sessionLog = new SessionEventLog(eventsPath);
    const sink = sessionLog.createSink();

    const session: SessionMeta = {
      id: sessionId,
      projectId: this.projectId,
      workspaceId: this.workspaceId,
      startedAt: new Date().toISOString(),
      status: "running",
      provider: this.config.execution.defaultProvider,
      taskCount: 1,
      tasksCompleted: 0,
      tasksFailed: 0,
      currentTaskId: task.id,
      notes: [],
      triggerAction: "autopilot",
      sessionEventsPath: eventsPath,
      backend: this.useClaudeSdk ? "sdk" : "cli",
      autopilotSessionId: this.masterSession?.id,
    };
    await this.wsManager.saveSession(this.workspaceId, this.projectId, session);
    this.sessionsSpawned.push(sessionId);

    // Track child session in master
    if (this.masterSession) {
      this.masterSession.childSessionIds = this.masterSession.childSessionIds ?? [];
      this.masterSession.childSessionIds.push(sessionId);
      await this.updateMasterSession();
    }

    try {
      const result = await this.executeTaskPhases(task, sink, sessionId);

      // Close task session
      const status = result.success ? "completed" : "failed";
      session.status = status;
      session.finishedAt = new Date().toISOString();
      session.tasksCompleted = result.success ? 1 : 0;
      session.tasksFailed = result.success ? 0 : 1;
      session.currentTaskId = undefined;
      await this.wsManager.saveSession(this.workspaceId, this.projectId, session);

      return {
        ...result,
        sessionId,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[autopilot] Task ${task.id} crashed: ${msg}`);

      session.status = "failed";
      session.finishedAt = new Date().toISOString();
      session.tasksFailed = 1;
      await this.wsManager.saveSession(this.workspaceId, this.projectId, session);

      return {
        taskId: task.id,
        success: false,
        stopReason: "error",
        committed: false,
        remediationAttempts: 0,
        sessionId,
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Phase Pipeline ────────────────────────────────────────

  private async executeTaskPhases(
    task: TaskConfig,
    sink: ProviderEventSink,
    sessionId: string
  ): Promise<Omit<TaskExecutionResult, "sessionId" | "durationMs">> {
    const provider = task.provider ?? this.config.execution.defaultProvider;
    const profile = task.permissionProfile ?? this.config.execution.defaultPermissionProfile;
    const timeout = task.timeoutMs ?? this.config.agents?.[provider]?.timeoutMs ?? 600_000;
    const maxRetries = task.retryPolicy?.maxAttempts ?? 1;
    const runner = this.runners[provider];

    // ── Transition to in_progress ──
    let taskState = this.store.getTask(task.id)!;
    if (taskState.state === "todo") taskState = transition(taskState, "ready");
    taskState = transition(taskState, "in_progress");
    taskState.startedAt = new Date().toISOString();
    this.store.setTask(task.id, taskState);
    await this.store.save();

    await this.changelog.logTaskStart(task);
    const startSync = await this.linear.syncTaskStart(task);
    this.syncOutcomes.push({ taskId: task.id, outcome: startSync.outcome });

    log.divider();
    log.task(task.id, "starting", `${task.title} [${provider}/${profile}]`);

    // Branch isolation
    if (task.branchName) {
      await this.createBranch(task.branchName);
    }

    // ── Phase 1: Implement (with retry) ──
    let implSuccess = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        log.task(task.id, "retrying", `Attempt ${attempt}/${maxRetries}`);
        taskState = { ...taskState, state: "in_progress" };
      }

      log.task(task.id, "implementing", `Phase: implement (attempt ${attempt})`);

      const steering = await this.buildSteering(task.id);
      const implPrompt = await renderPrompt(
        this.config, task, "implement", this.store.getAllTasks(), steering
      );

      const implResult = await this.runProvider(
        provider, runner, implPrompt,
        { cwd: this.config.project.rootDir, timeout, permissionProfile: profile },
        sink, task.id, "implement"
      );

      taskState = this.store.getTask(task.id)!;
      taskState.runs.push(implResult.record);

      if (implResult.success) {
        implSuccess = true;
        taskState = transition(taskState, "implemented");
        this.store.setTask(task.id, taskState);
        await this.store.save();
        await this.changelog.logTaskResult(task, taskState, implResult);
        log.task(task.id, "implemented", "Phase: implement done.");
        break;
      }

      log.task(task.id, "failed", `Attempt ${attempt} failed: ${implResult.error}`);
      await this.changelog.logTaskResult(task, taskState, implResult);

      if (attempt === maxRetries) {
        taskState = transition(taskState, "failed");
        taskState.error = implResult.error;
        this.store.setTask(task.id, taskState);
        await this.store.save();
        return {
          taskId: task.id,
          success: false,
          stopReason: "task-failed",
          committed: false,
          remediationAttempts: 0,
        };
      }
    }

    if (!implSuccess) {
      return {
        taskId: task.id,
        success: false,
        stopReason: "task-failed",
        committed: false,
        remediationAttempts: 0,
      };
    }

    // ── Phase 2: Validate Primary ──
    const remediationEnabled = this.config.execution.remediationOnValidationFail ?? true;
    const maxRemediationAttempts = this.config.execution.maxRemediationAttempts ?? 1;

    const v1 = await this.runValidationPhase(
      task, runner, "validate-primary", timeout, profile, sink
    );
    if (!v1) {
      if (remediationEnabled) {
        // ── Phase 3: Remediate ──
        const remediated = await this.runRemediationPhase(
          task, runner, "validate-primary", timeout, profile, sink, maxRemediationAttempts
        );
        if (!remediated) {
          const attempts = this.store.getTask(task.id)?.remediationAttempts ?? 0;
          this.remediationSummary.push({ taskId: task.id, attempts, result: "exhausted" });
          return {
            taskId: task.id,
            success: false,
            stopReason: "remediation-exhausted",
            committed: false,
            remediationAttempts: attempts,
          };
        }
        this.remediationSummary.push({
          taskId: task.id,
          attempts: this.store.getTask(task.id)?.remediationAttempts ?? 0,
          result: "success",
        });
      } else {
        return {
          taskId: task.id,
          success: false,
          stopReason: "validation-failed",
          committed: false,
          remediationAttempts: 0,
        };
      }
    }

    // ── Phase 2b: Validate Secondary ──
    const v2 = await this.runValidationPhase(
      task, runner, "validate-secondary", timeout, profile, sink
    );
    if (!v2) {
      return {
        taskId: task.id,
        success: false,
        stopReason: "validation-failed",
        committed: false,
        remediationAttempts: this.store.getTask(task.id)?.remediationAttempts ?? 0,
      };
    }

    // ── Phase 4: Commit (AI-prompted) ──
    const commitResult = await this.runCommitPhase(task, runner, timeout, profile, sink);
    this.commitSummary.push({
      taskId: task.id,
      committed: commitResult.committed,
      reason: commitResult.reason,
    });

    if (!commitResult.committed) {
      log.task(task.id, "warn", `Commit phase failed: ${commitResult.reason}`);

      if (this.autopilotConfig.stopPolicy.stopOnCommitFail) {
        taskState = this.store.getTask(task.id)!;
        taskState = transition(taskState, "failed");
        taskState.error = `Commit phase failed: ${commitResult.reason}`;
        this.store.setTask(task.id, taskState);
        await this.store.save();
        return {
          taskId: task.id,
          success: false,
          stopReason: "commit-failed",
          committed: false,
          remediationAttempts: this.store.getTask(task.id)?.remediationAttempts ?? 0,
        };
      }
      // If not stopping on commit fail, mark committed anyway (agent may have committed)
    }

    // ── Transition: committed → done ──
    taskState = this.store.getTask(task.id)!;
    if (taskState.state === "validated_secondary") {
      taskState = transition(taskState, "committed");
    }
    taskState = transition(taskState, "done");
    this.store.setTask(task.id, taskState);
    await this.store.save();

    // ── Phase 5: Sync ──
    const doneSync = await this.linear.syncTaskDone(task, taskState, {
      success: true,
      output: "",
      exitCode: 0,
      duration: 0,
      record: taskState.runs[taskState.runs.length - 1]!,
    });
    this.syncOutcomes.push({ taskId: task.id, outcome: doneSync.outcome });
    taskState.lastTrackerSync = doneSync;
    this.store.setTask(task.id, taskState);
    await this.store.save();

    if (
      doneSync.outcome === "unverified" &&
      this.autopilotConfig.stopPolicy.stopOnUnverifiedSync
    ) {
      return {
        taskId: task.id,
        success: true,
        stopReason: "sync-unverified",
        committed: commitResult.committed,
        syncOutcome: doneSync.outcome,
        remediationAttempts: this.store.getTask(task.id)?.remediationAttempts ?? 0,
      };
    }

    if (doneSync.outcome === "failed") {
      return {
        taskId: task.id,
        success: true,
        stopReason: "sync-failed",
        committed: commitResult.committed,
        syncOutcome: doneSync.outcome,
        remediationAttempts: this.store.getTask(task.id)?.remediationAttempts ?? 0,
      };
    }

    log.task(task.id, "done", "All phases completed.");
    return {
      taskId: task.id,
      success: true,
      committed: commitResult.committed,
      syncOutcome: doneSync.outcome,
      remediationAttempts: this.store.getTask(task.id)?.remediationAttempts ?? 0,
    };
  }

  // ── Commit Phase ──────────────────────────────────────────

  private async runCommitPhase(
    task: TaskConfig,
    runner: ProviderRunner,
    timeout: number,
    profile: PermissionProfile,
    sink: ProviderEventSink
  ): Promise<{ committed: boolean; reason?: string; commitHash?: string }> {
    log.task(task.id, "committing", "Phase: commit");

    const diffSummary = await this.captureDiffSummary();
    if (!diffSummary) {
      log.task(task.id, "info", "No changes to commit (clean working tree).");
      return { committed: true, reason: "no changes to commit (clean)" };
    }

    const steering = await this.buildSteering(task.id);
    const commitCtx: CommitContext = {
      diffSummary,
      commitMessageFormat: "feat|fix|refactor|chore(<scope>): <description>",
      commitPolicy: [
        "Stage only files related to this task's scope.",
        "Do not stage .env files, credentials, or build artifacts.",
        "Write a clear commit message following the format above.",
        "Do not push to remote.",
      ].join(" "),
    };

    const provider = task.provider ?? this.config.execution.defaultProvider;
    const prompt = await renderPrompt(
      this.config, task, "commit", this.store.getAllTasks(),
      steering, undefined, commitCtx
    );

    const result = await this.runProvider(
      provider, runner, prompt,
      { cwd: this.config.project.rootDir, timeout: Math.min(timeout, 120_000), permissionProfile: profile },
      sink, task.id, "commit"
    );

    const taskState = this.store.getTask(task.id)!;
    taskState.runs.push(result.record);
    this.store.setTask(task.id, taskState);
    await this.store.save();

    // ── Post-commit verification ──
    if (!result.success) {
      return { committed: false, reason: `agent error: ${result.error}` };
    }

    const output = result.output.toLowerCase();
    if (output.includes("error:")) {
      const errorLine = result.output.split("\n")
        .find((l) => l.trim().toLowerCase().startsWith("error:"));
      return { committed: false, reason: errorLine?.trim() ?? "agent reported error" };
    }

    // Check if a new commit was actually created
    const verification = await this.verifyCommit();
    if (!verification.hasNewCommit) {
      return { committed: false, reason: "no new commit detected after commit phase" };
    }

    // Extract commit hash from agent output
    const commitMatch = result.output.match(/Committed:\s*([a-f0-9]+)/i);
    const commitHash = commitMatch?.[1] ?? verification.latestHash;

    if (commitHash) {
      taskState.commitHash = commitHash;
      this.store.setTask(task.id, taskState);
      await this.store.save();
    }

    await this.changelog.logMessage(
      `COMMIT ${task.id} — ${commitHash?.slice(0, 8) ?? "unknown"}`
    );

    log.task(task.id, "committed", `Commit: ${commitHash?.slice(0, 8) ?? "done"}`);
    return { committed: true, commitHash };
  }

  private async verifyCommit(): Promise<{
    hasNewCommit: boolean;
    latestHash?: string;
    isClean: boolean;
  }> {
    try {
      // Check if working tree is clean (or mostly clean)
      const statusProc = Bun.spawn(["git", "status", "--porcelain"], {
        cwd: this.config.project.rootDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const statusOut = await new Response(statusProc.stdout).text();
      await statusProc.exited;
      const isClean = statusOut.trim().length === 0;

      // Get latest commit hash
      const logProc = Bun.spawn(["git", "log", "-1", "--format=%H"], {
        cwd: this.config.project.rootDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const hashOut = await new Response(logProc.stdout).text();
      await logProc.exited;
      const latestHash = hashOut.trim();

      return { hasNewCommit: latestHash.length > 0, latestHash, isClean };
    } catch {
      return { hasNewCommit: false, isClean: false };
    }
  }

  // ── Validation Phase ──────────────────────────────────────

  private async runValidationPhase(
    task: TaskConfig,
    runner: ProviderRunner,
    mode: PromptMode,
    timeout: number,
    profile: PermissionProfile,
    sink: ProviderEventSink
  ): Promise<boolean> {
    const label = mode === "validate-primary" ? "Primary" : "Secondary";
    const targetState = mode === "validate-primary"
      ? ("validated_primary" as const)
      : ("validated_secondary" as const);

    log.task(task.id, "validating", `Phase: ${label.toLowerCase()} validation`);

    const steering = await this.buildSteering(task.id);
    const prompt = await renderPrompt(
      this.config, task, mode, this.store.getAllTasks(), steering
    );

    const provider = task.provider ?? this.config.execution.defaultProvider;
    const result = await this.runProvider(
      provider, runner, prompt,
      { cwd: this.config.project.rootDir, timeout, permissionProfile: profile },
      sink, task.id, mode
    );

    let taskState = this.store.getTask(task.id)!;
    taskState.runs.push(result.record);

    const passed = result.success && !result.output.includes("Result: FAIL");
    const findings = parseValidationFindings(result.output, mode, passed);
    taskState.lastValidation = findings;
    taskState.validationHistory = taskState.validationHistory ?? [];
    taskState.validationHistory.push(findings);

    await this.changelog.logValidation(
      task.id, mode, passed, result.output,
      findings.summary, findings.recommendation
    );

    if (!passed) {
      taskState = transition(taskState, "failed");
      taskState.error = `${label} validation failed: ${findings.summary}`;
      this.store.setTask(task.id, taskState);
      await this.store.save();
      log.task(task.id, "failed", `${label} validation failed: ${findings.summary}`);
      return false;
    }

    taskState = transition(taskState, targetState);
    this.store.setTask(task.id, taskState);
    await this.store.save();
    log.task(task.id, targetState, `${label} validation passed.`);
    return true;
  }

  // ── Remediation Phase ─────────────────────────────────────

  private async runRemediationPhase(
    task: TaskConfig,
    runner: ProviderRunner,
    validationMode: PromptMode,
    timeout: number,
    profile: PermissionProfile,
    sink: ProviderEventSink,
    maxAttempts: number
  ): Promise<boolean> {
    let taskState = this.store.getTask(task.id)!;
    const lastFindings = taskState.lastValidation;
    if (!lastFindings || lastFindings.passed) return true;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log.task(task.id, "remediating", `Phase: remediation (attempt ${attempt}/${maxAttempts})`);

      taskState = this.store.getTask(task.id)!;
      taskState.state = "in_progress";
      taskState.error = undefined;
      taskState.remediationAttempts = (taskState.remediationAttempts ?? 0) + 1;
      this.store.setTask(task.id, taskState);
      await this.store.save();

      const steering = await this.buildSteering(task.id);
      const diffSummary = await this.captureDiffSummary();
      const remediationCtx: RemediationContext = {
        validationFindings: lastFindings.findings,
        validationSummary: lastFindings.summary,
        validationRecommendation: lastFindings.recommendation,
        diffSummary: diffSummary ?? undefined,
      };

      const provider = task.provider ?? this.config.execution.defaultProvider;
      const remPrompt = await renderPrompt(
        this.config, task, "remediate", this.store.getAllTasks(), steering, remediationCtx
      );

      const remResult = await this.runProvider(
        provider, runner, remPrompt,
        { cwd: this.config.project.rootDir, timeout, permissionProfile: profile },
        sink, task.id, "remediate"
      );

      taskState = this.store.getTask(task.id)!;
      taskState.runs.push(remResult.record);

      if (!remResult.success) {
        taskState.remediationHistory = taskState.remediationHistory ?? [];
        taskState.remediationHistory.push({
          attempt,
          findings: lastFindings,
          result: "failure",
          timestamp: new Date().toISOString(),
        });
        taskState = transition(taskState, "failed");
        taskState.error = `Remediation attempt ${attempt} failed: ${remResult.error}`;
        this.store.setTask(task.id, taskState);
        await this.store.save();
        return false;
      }

      taskState = transition(taskState, "implemented");
      this.store.setTask(task.id, taskState);
      await this.store.save();

      const revalidated = await this.runValidationPhase(
        task, runner, validationMode, timeout, profile, sink
      );

      taskState = this.store.getTask(task.id)!;
      taskState.remediationHistory = taskState.remediationHistory ?? [];
      taskState.remediationHistory.push({
        attempt,
        findings: taskState.lastValidation ?? lastFindings,
        result: revalidated ? "success" : "failure",
        timestamp: new Date().toISOString(),
      });
      this.store.setTask(task.id, taskState);
      await this.store.save();

      if (revalidated) {
        log.task(task.id, "remediated", `Remediation succeeded on attempt ${attempt}.`);
        return true;
      }
    }

    log.task(task.id, "failed", `All ${maxAttempts} remediation attempts exhausted.`);
    return false;
  }

  // ── Provider Routing ──────────────────────────────────────

  private async runProvider(
    provider: AgentProvider,
    cliRunner: ProviderRunner,
    prompt: string,
    opts: { cwd: string; timeout: number; permissionProfile: PermissionProfile },
    sink: ProviderEventSink,
    taskId: string,
    phase: string
  ): Promise<AgentResult> {
    if (provider === "claude" && this.claudeSdkRunner) {
      return this.claudeSdkRunner.runStreaming(prompt, {
        ...opts,
        sink,
        taskId,
        phase,
      });
    }
    return cliRunner.run(prompt, opts);
  }

  // ── Stop Condition Checks ─────────────────────────────────

  private shouldContinue(): boolean {
    if (this.stopRequested || this.stopReason) return false;

    // Max tasks
    const maxTasks = this.autopilotConfig.bounds.maxTasks;
    if (maxTasks && this.tasksCompleted.length >= maxTasks) {
      this.stopReason = "max-tasks-reached";
      return false;
    }

    // Max duration
    const maxDuration = this.autopilotConfig.bounds.maxDurationMinutes;
    if (maxDuration) {
      const elapsed = (Date.now() - this.startedAt) / 60_000;
      if (elapsed >= maxDuration) {
        this.stopReason = "max-duration-reached";
        return false;
      }
    }

    return true;
  }

  private processTaskResult(result: TaskExecutionResult): void {
    if (result.success) {
      this.tasksCompleted.push(result.taskId);
    } else {
      this.tasksFailed.push(result.taskId);
    }

    // Check stop conditions from result
    if (result.stopReason) {
      const sp = this.autopilotConfig.stopPolicy;
      switch (result.stopReason) {
        case "task-failed":
          if (sp.stopOnFailure) this.stopReason = "task-failed";
          break;
        case "validation-failed":
          if (sp.stopOnValidationFail) this.stopReason = "validation-failed";
          break;
        case "remediation-exhausted":
          if (sp.stopOnRemediationExhausted) this.stopReason = "remediation-exhausted";
          break;
        case "commit-failed":
          if (sp.stopOnCommitFail) this.stopReason = "commit-failed";
          break;
        case "sync-failed":
          this.stopReason = "sync-failed";
          break;
        case "sync-unverified":
          if (sp.stopOnUnverifiedSync) this.stopReason = "sync-unverified";
          break;
        case "error":
          this.stopReason = "error";
          break;
      }
    }
  }

  // ── Session Management ────────────────────────────────────

  private async initMasterSession(): Promise<void> {
    const sessionId = crypto.randomUUID();
    this.masterSession = {
      id: sessionId,
      projectId: this.projectId,
      workspaceId: this.workspaceId,
      startedAt: new Date().toISOString(),
      status: "running",
      provider: this.config.execution.defaultProvider,
      taskCount: this.config.tasks.length,
      tasksCompleted: 0,
      tasksFailed: 0,
      notes: [`Autopilot mode: unattended, maxParallel=${this.autopilotConfig.bounds.maxParallelTasks}`],
      triggerAction: "autopilot",
      backend: this.useClaudeSdk ? "sdk" : "cli",
      childSessionIds: [],
    };
    await this.wsManager.saveSession(
      this.workspaceId,
      this.projectId,
      this.masterSession
    );
  }

  private async updateMasterSession(): Promise<void> {
    if (!this.masterSession) return;
    this.masterSession.tasksCompleted = this.tasksCompleted.length;
    this.masterSession.tasksFailed = this.tasksFailed.length;
    this.masterSession.lastEventAt = new Date().toISOString();
    await this.wsManager.saveSession(
      this.workspaceId,
      this.projectId,
      this.masterSession
    );
  }

  private async finalizeMasterSession(summary: AutopilotSummary): Promise<void> {
    if (!this.masterSession) return;
    this.masterSession.status = summary.endedCleanly ? "completed" : "failed";
    this.masterSession.finishedAt = new Date().toISOString();
    this.masterSession.tasksCompleted = summary.tasksCompleted;
    this.masterSession.tasksFailed = summary.tasksFailed;
    this.masterSession.notes.push(`Stop reason: ${summary.stopReason}`);
    await this.wsManager.saveSession(
      this.workspaceId,
      this.projectId,
      this.masterSession
    );
  }

  // ── Helpers ───────────────────────────────────────────────

  private async buildSteering(taskId: string): Promise<SteeringContext> {
    const ctx: SteeringContext = {};
    ctx.projectSteering = await this.wsManager.readSteering(
      this.workspaceId, this.projectId
    );

    const taskState = this.store.getTask(taskId);
    if (taskState && taskState.notes.length > 0) {
      ctx.taskNotes = taskState.notes;
    }

    return ctx;
  }

  private refreshReadiness(): void {
    const ready = findReadyTasks(this.config.tasks, this.store.getAllTasks());
    for (const task of ready) {
      const state = this.store.getTask(task.id);
      if (state && state.state === "todo") {
        this.store.setTask(task.id, transition(state, "ready"));
      }
    }
  }

  private async captureDiffSummary(): Promise<string | null> {
    try {
      const proc = Bun.spawn(["git", "diff", "--stat", "HEAD"], {
        cwd: this.config.project.rootDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      if (!stdout.trim()) return null;
      return stdout
        .split("\n")
        .filter(
          (l) =>
            !l.includes("tsconfig.tsbuildinfo") &&
            !l.includes("node_modules")
        )
        .join("\n")
        .trim() || null;
    } catch {
      return null;
    }
  }

  private async createBranch(branchName: string): Promise<void> {
    try {
      const proc = Bun.spawn(["git", "checkout", "-B", branchName], {
        cwd: this.config.project.rootDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
    } catch {
      log.warn(`Failed to create branch ${branchName}`);
    }
  }

  // ── Reporting ─────────────────────────────────────────────

  private buildSummary(): AutopilotSummary {
    const allStates = this.store.getAllTasks();
    const blockers = this.config.tasks
      .filter((t) => ["blocked", "failed"].includes(allStates[t.id]?.state ?? "todo"))
      .map((t) => `${t.id}: ${allStates[t.id]?.error ?? t.title}`);

    const nextReady = findReadyTasks(this.config.tasks, allStates)
      .map((t) => t.id);

    return {
      stopReason: this.stopReason ?? "all-tasks-done",
      totalSessionsSpawned: this.sessionsSpawned.length,
      tasksCompleted: this.tasksCompleted.length,
      tasksFailed: this.tasksFailed.length,
      lastSuccessfulTasks: this.tasksCompleted.slice(-5),
      currentBlockers: blockers,
      nextReadyTasks: nextReady,
      syncOutcomes: this.syncOutcomes as AutopilotSummary["syncOutcomes"],
      remediationSummary: this.remediationSummary,
      commitSummary: this.commitSummary,
      endedCleanly: this.stopReason === "all-tasks-done" || this.stopReason === "max-tasks-reached",
      durationMs: Date.now() - this.startedAt,
      startedAt: new Date(this.startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  private async writeSummaryReport(summary: AutopilotSummary): Promise<void> {
    const dur = (summary.durationMs / 1000).toFixed(1);
    const lines: string[] = [
      `# Autopilot Summary Report`,
      ``,
      `**Stop reason:** ${summary.stopReason}`,
      `**Duration:** ${dur}s`,
      `**Started:** ${summary.startedAt}`,
      `**Finished:** ${summary.finishedAt}`,
      `**Ended cleanly:** ${summary.endedCleanly}`,
      ``,
      `## Execution`,
      `- Sessions spawned: ${summary.totalSessionsSpawned}`,
      `- Tasks completed: ${summary.tasksCompleted}`,
      `- Tasks failed: ${summary.tasksFailed}`,
      ``,
    ];

    if (summary.lastSuccessfulTasks.length > 0) {
      lines.push(
        `## Last Successful Tasks`,
        ...summary.lastSuccessfulTasks.map((t) => `- ${t}`),
        ``
      );
    }

    if (summary.currentBlockers.length > 0) {
      lines.push(
        `## Current Blockers`,
        ...summary.currentBlockers.map((b) => `- ${b}`),
        ``
      );
    }

    if (summary.nextReadyTasks.length > 0) {
      lines.push(
        `## Next Ready Tasks`,
        ...summary.nextReadyTasks.map((t) => `- ${t}`),
        ``
      );
    }

    if (summary.commitSummary.length > 0) {
      lines.push(
        `## Commit Phase Summary`,
        ...summary.commitSummary.map(
          (c) => `- ${c.taskId}: ${c.committed ? "committed" : "skipped"} ${c.reason ? `(${c.reason})` : ""}`
        ),
        ``
      );
    }

    if (summary.remediationSummary.length > 0) {
      lines.push(
        `## Remediation Summary`,
        ...summary.remediationSummary.map(
          (r) => `- ${r.taskId}: ${r.attempts} attempt(s), ${r.result}`
        ),
        ``
      );
    }

    if (summary.syncOutcomes.length > 0) {
      lines.push(
        `## Sync Outcomes`,
        ...summary.syncOutcomes.map((s) => `- ${s.taskId}: ${s.outcome}`),
        ``
      );
    }

    const reportPath = getProjectSummaryPath(
      this.config.project.rootDir,
      this.config.project.id
    );
    try {
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, lines.join("\n"));
      log.info(`Summary report: ${reportPath}`);
    } catch {
      // Non-fatal
    }

    // Also log to changelog
    await this.changelog.logMessage(
      `AUTOPILOT ${summary.stopReason} — ${summary.tasksCompleted} done, ${summary.tasksFailed} failed, ${summary.totalSessionsSpawned} sessions, ${dur}s`
    );
  }

  private async writeAutopilotStatus(event: string): Promise<void> {
    const allStates = this.store.getAllTasks();
    const running = this.scheduler.getRunning();
    const ready = findReadyTasks(this.config.tasks, allStates);
    const bounds = this.autopilotConfig.bounds;

    const lines: string[] = [
      `# Autopilot Live Status`,
      ``,
      `**Mode:** unattended autopilot`,
      `**Event:** ${event}`,
      `**Updated:** ${new Date().toISOString()}`,
      `**Provider:** ${this.config.execution.defaultProvider} (${this.useClaudeSdk ? "sdk" : "cli"})`,
      `**Started:** ${new Date(this.startedAt).toISOString()}`,
      ``,
      `## Bounds`,
      `- Max tasks: ${bounds.maxTasks ?? "∞"}`,
      `- Max parallel: ${bounds.maxParallelTasks}`,
      `- Max duration: ${bounds.maxDurationMinutes ?? "∞"} min`,
      ``,
      `## Progress`,
      `- Completed: ${this.tasksCompleted.length}`,
      `- Failed: ${this.tasksFailed.length}`,
      `- Running: ${running.length} (${running.join(", ") || "none"})`,
      `- Ready: ${ready.length}`,
      `- Sessions spawned: ${this.sessionsSpawned.length}`,
      ``,
    ];

    if (running.length > 0) {
      lines.push(
        `## Running Tasks`,
        ...running.map((id) => {
          const t = this.config.tasks.find((t) => t.id === id);
          const s = allStates[id];
          return `- ${id} [${t?.track ?? "?"}] ${t?.title ?? "?"} — phase: ${s?.state ?? "?"}`;
        }),
        ``
      );
    }

    if (this.tasksCompleted.length > 0) {
      const last = this.tasksCompleted.slice(-5);
      lines.push(
        `## Last Completed`,
        ...last.map((id) => `- ${id}`),
        ``
      );
    }

    if (this.tasksFailed.length > 0) {
      lines.push(
        `## Failed Tasks`,
        ...this.tasksFailed.map((id) => {
          const s = allStates[id];
          return `- ${id}: ${s?.error ?? "unknown"}`;
        }),
        ``
      );
    }

    if (ready.length > 0) {
      lines.push(
        `## Next Ready`,
        ...ready.slice(0, 10).map((t) => `- ${t.id} [${t.track}]`),
        ``
      );
    }

    lines.push(
      `## Stop Policy`,
      `- stopOnFailure: ${this.autopilotConfig.stopPolicy.stopOnFailure}`,
      `- stopOnValidationFail: ${this.autopilotConfig.stopPolicy.stopOnValidationFail}`,
      `- stopOnRemediationExhausted: ${this.autopilotConfig.stopPolicy.stopOnRemediationExhausted}`,
      `- stopOnCommitFail: ${this.autopilotConfig.stopPolicy.stopOnCommitFail}`,
      `- stopOnUnverifiedSync: ${this.autopilotConfig.stopPolicy.stopOnUnverifiedSync}`,
      ``
    );

    const statusPath = getProjectAutopilotStatusPath(
      this.config.project.rootDir,
      this.config.project.id
    );
    try {
      await mkdir(dirname(statusPath), { recursive: true });
      await writeFile(statusPath, lines.join("\n"));
    } catch {
      // Non-fatal
    }
  }

  getMasterSession(): SessionMeta | null {
    return this.masterSession;
  }
}
