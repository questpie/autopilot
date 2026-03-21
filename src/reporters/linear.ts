import type {
  TaskConfig,
  TaskRunState,
  AgentResult,
  ProjectConfig,
  PermissionProfile,
} from "../core/types.js";
import type { ProviderRunner } from "../runners/provider.js";
import { log } from "../utils/logger.js";

/**
 * Linear sync via agent delegation.
 *
 * Instead of calling the Linear API directly, we delegate Linear operations
 * to the coding agent (Claude/Codex) which has Linear MCP access.
 * No API key, no SDK, no auth config needed.
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
    // enabled can be overridden by agentConfig.enabled (--no-sync, --dry-run)
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

  async syncTaskStart(task: TaskConfig): Promise<void> {
    if (!this.enabled) return;

    const issueId = extractIssueId(task);
    if (!issueId) return;

    await this.delegateToAgent(
      `Update the Linear issue ${issueId} status to "In Progress". ` +
        `Use your Linear MCP tools. Only update the status, nothing else. ` +
        `Output only: "Done: <issue-id> → In Progress" or "Error: <reason>"`
    );
  }

  async syncTaskDone(
    task: TaskConfig,
    state: TaskRunState,
    result: AgentResult
  ): Promise<void> {
    if (!this.enabled) return;

    const issueId = extractIssueId(task);
    if (!issueId) return;

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

    await this.delegateToAgent(
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
  }): Promise<void> {
    if (!this.enabled || !this.projectId) return;

    const body = [
      `**Autopilot Session Summary**`,
      `- Total: ${stats.total}`,
      `- Done: ${stats.done}`,
      `- Failed: ${stats.failed}`,
      `- Blocked: ${stats.blocked}`,
      `- Remaining: ${stats.total - stats.done - stats.failed - stats.blocked}`,
    ].join("\\n");

    await this.delegateToAgent(
      `Find the parent/umbrella issue for the project "${this.projectId}" in Linear ` +
        `and add a comment with this progress summary:\n${body}\n\n` +
        `Use your Linear MCP tools. Output only: "Done: summary posted" or "Error: <reason>"`
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async delegateToAgent(
    prompt: string
  ): Promise<string | null> {
    if (!this.runner) {
      log.warn("[Linear] No agent runner attached — skipping sync.");
      return null;
    }

    log.info("[Linear] Delegating to agent...");

    try {
      const result = await this.runner.run(prompt, {
        cwd: this.cwd,
        timeout: 60_000,
        permissionProfile: this.permissionProfile,
      });

      if (result.success) {
        log.success(
          `[Linear] ${result.output.trim().slice(0, 200)}`
        );
        return result.output;
      }

      log.warn(
        `[Linear] Agent sync failed (non-fatal): ${result.error?.slice(0, 200)}`
      );
      return null;
    } catch (err) {
      log.warn(
        `[Linear] Sync error (non-fatal): ${err instanceof Error ? err.message : err}`
      );
      return null;
    }
  }
}

function extractIssueId(task: TaskConfig): string | null {
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
