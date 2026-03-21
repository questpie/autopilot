import type {
  TaskConfig,
  TaskRunState,
  AgentResult,
  ProjectConfig,
  PermissionProfile,
  TrackerSyncResult,
  TrackerSyncOutcome,
} from "../core/types.js";
import type { ProviderRunner } from "../runners/provider.js";
import { log } from "../utils/logger.js";

/**
 * Linear sync via agent delegation.
 *
 * Instead of calling the Linear API directly, we delegate Linear operations
 * to the coding agent (Claude/Codex) which has Linear MCP access.
 * No API key, no SDK, no auth config needed.
 *
 * Returns structured TrackerSyncResult for every operation so callers
 * can distinguish success / noop / unavailable / failed / unverified.
 */
export class LinearReporter {
  private enabled: boolean;
  private projectId: string | undefined;
  private runner: ProviderRunner | null;
  private cwd: string;
  private permissionProfile: PermissionProfile;

  constructor(
    config: ProjectConfig["tracker"],
    agentConfig?: {
      runner: ProviderRunner;
      cwd: string;
      permissionProfile: PermissionProfile;
      enabled?: boolean;
    }
  ) {
    const trackerEnabled =
      config?.provider === "linear" && (config?.enabled ?? true);
    this.enabled =
      agentConfig?.enabled !== undefined
        ? agentConfig.enabled
        : trackerEnabled;

    this.projectId = config?.projectId;
    this.runner = agentConfig?.runner ?? null;
    this.cwd = agentConfig?.cwd ?? process.cwd();
    this.permissionProfile = agentConfig?.permissionProfile ?? "safe";
  }

  async syncTaskStart(task: TaskConfig): Promise<TrackerSyncResult> {
    const issueId = extractIssueId(task);
    if (!this.enabled) {
      return syncResult("noop", issueId, "start", "sync disabled");
    }
    if (!issueId) {
      return syncResult("noop", null, "start", "no issue ID found");
    }

    return this.delegateAndParse(
      issueId,
      "start",
      `Update the Linear issue ${issueId} status to "In Progress". ` +
        `Use your Linear MCP tools. Only update the status, nothing else. ` +
        `Output only: "Done: <issue-id> → In Progress" or "Error: <reason>"`
    );
  }

  async syncTaskDone(
    task: TaskConfig,
    state: TaskRunState,
    result: AgentResult
  ): Promise<TrackerSyncResult> {
    const issueId = extractIssueId(task);
    if (!this.enabled) {
      return syncResult("noop", issueId, "done", "sync disabled");
    }
    if (!issueId) {
      return syncResult("noop", null, "done", "no issue ID found");
    }

    const lastRun = state.runs[state.runs.length - 1];
    const status = result.success ? "Done" : "Failed";
    const duration = (result.duration / 1000).toFixed(1);

    const commentBody = [
      `**Autopilot ${status}**`,
      `- Duration: ${duration}s`,
      `- Provider: ${lastRun?.provider ?? "unknown"} [${lastRun?.permissionProfile ?? "unknown"}]`,
      `- Final state: ${state.state}`,
      result.error ? `- Error: ${result.error}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const linearStatus = mapStateToLinearStatus(state.state);

    return this.delegateAndParse(
      issueId,
      "done",
      `Do two things with Linear issue ${issueId} using your Linear MCP tools:\n` +
        `1. Update its status to "${linearStatus}"\n` +
        `2. Add a comment with this content:\n${commentBody}\n\n` +
        `Output only: "Done: <issue-id> → ${linearStatus} + comment" or "Error: <reason>"`
    );
  }

  async syncSummary(stats: {
    total: number;
    done: number;
    failed: number;
    blocked: number;
  }): Promise<TrackerSyncResult> {
    if (!this.enabled) {
      return syncResult("noop", null, "summary", "sync disabled");
    }
    if (!this.projectId) {
      return syncResult("noop", null, "summary", "no project ID");
    }

    const body = [
      `**Autopilot Session Summary**`,
      `- Total: ${stats.total}`,
      `- Done: ${stats.done}`,
      `- Failed: ${stats.failed}`,
      `- Blocked: ${stats.blocked}`,
      `- Remaining: ${stats.total - stats.done - stats.failed - stats.blocked}`,
    ].join("\\n");

    return this.delegateAndParse(
      this.projectId,
      "summary",
      `Find the parent/umbrella issue for the project "${this.projectId}" in Linear ` +
        `and add a comment with this progress summary:\n${body}\n\n` +
        `Use your Linear MCP tools. Output only: "Done: summary posted" or "Error: <reason>"`
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Core delegation: run agent, then parse output to determine real outcome.
   */
  private async delegateAndParse(
    issueId: string,
    action: string,
    prompt: string
  ): Promise<TrackerSyncResult> {
    if (!this.runner) {
      const r = syncResult("unavailable", issueId, action, "no agent runner attached");
      logSyncResult(r);
      return r;
    }

    log.info(`[Linear] Delegating ${action} for ${issueId}...`);

    try {
      const result = await this.runner.run(prompt, {
        cwd: this.cwd,
        timeout: 60_000,
        permissionProfile: this.permissionProfile,
      });

      const outcome = classifyAgentOutput(result.success, result.output, result.error);
      const r: TrackerSyncResult = {
        ...outcome,
        issueId,
        action,
        rawOutput: result.output?.slice(0, 500),
      };
      logSyncResult(r);
      return r;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const r = syncResult("failed", issueId, action, `exception: ${msg}`);
      logSyncResult(r);
      return r;
    }
  }
}

// ── Output Classification ──────────────────────────────────

/**
 * Parse agent output to determine real sync outcome.
 * We look for explicit success/error markers rather than trusting exit code alone.
 */
export function classifyAgentOutput(
  exitSuccess: boolean,
  output: string,
  error?: string
): { outcome: TrackerSyncOutcome; reason: string } {
  const text = (output ?? "").trim();
  const lower = text.toLowerCase();

  // Agent process failed
  if (!exitSuccess) {
    // Check for known unavailability patterns
    if (isToolUnavailable(lower, error)) {
      return { outcome: "unavailable", reason: "Linear MCP tools not available" };
    }
    return { outcome: "failed", reason: error?.slice(0, 200) ?? "agent exited with non-zero" };
  }

  // Agent succeeded (exit 0) — now verify the output indicates actual mutation

  // Check for tool unavailability even on exit 0
  if (isToolUnavailable(lower, error)) {
    return { outcome: "unavailable", reason: "Linear MCP tools not available" };
  }

  // Explicit success markers from our prompt format
  if (lower.includes("done:") && !lower.includes("error:")) {
    return { outcome: "success", reason: extractDoneLine(text) };
  }

  // Explicit error in output
  if (lower.includes("error:")) {
    const errorLine = extractErrorLine(text);
    // Check for "already" patterns = noop
    if (lower.includes("already")) {
      return { outcome: "noop", reason: errorLine };
    }
    return { outcome: "failed", reason: errorLine };
  }

  // Agent mentions "already" = noop
  if (lower.includes("already in") || lower.includes("already set") || lower.includes("no change")) {
    return { outcome: "noop", reason: "issue already in desired state" };
  }

  // Agent completed but no clear success/error marker
  // This is the key fix: we don't trust exit code 0 alone
  return {
    outcome: "unverified",
    reason: "agent completed but no confirmed mutation marker in output",
  };
}

function isToolUnavailable(lower: string, error?: string): boolean {
  const combined = lower + " " + (error?.toLowerCase() ?? "");
  return (
    combined.includes("mcp") && combined.includes("not available") ||
    combined.includes("mcp") && combined.includes("not found") ||
    combined.includes("no tools") ||
    combined.includes("tool_not_found") ||
    combined.includes("no mcp") ||
    combined.includes("could not find") && combined.includes("linear")
  );
}

function extractDoneLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().toLowerCase().startsWith("done:"));
  return line?.trim() ?? "Done";
}

function extractErrorLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().toLowerCase().startsWith("error:"));
  return line?.trim() ?? "Unknown error";
}

// ── Helpers ────────────────────────────────────────────────

function syncResult(
  outcome: TrackerSyncOutcome,
  issueId: string | null,
  action: string,
  reason: string
): TrackerSyncResult {
  return { outcome, issueId, action, reason };
}

function logSyncResult(r: TrackerSyncResult): void {
  const tag = `[Linear] ${r.outcome}: ${r.reason}`;
  switch (r.outcome) {
    case "success":
      log.success(tag);
      break;
    case "noop":
      log.info(tag);
      break;
    case "unavailable":
      log.warn(tag);
      break;
    case "failed":
      log.warn(tag);
      break;
    case "unverified":
      log.warn(tag);
      break;
  }
}

export function extractIssueId(task: TaskConfig): string | null {
  if (task.issueUrl) {
    const match = task.issueUrl.match(/issue\/([A-Z]+-\d+)/);
    if (match) return match[1]!;
  }
  if (/^[A-Z]+-\d+$/.test(task.id)) return task.id;
  return null;
}

function mapStateToLinearStatus(
  state: TaskRunState["state"]
): string {
  switch (state) {
    case "in_progress":
      return "In Progress";
    case "done":
    case "committed":
      return "Done";
    case "failed":
      return "Failed";
    case "blocked":
      return "Blocked";
    default:
      return "In Progress";
  }
}
