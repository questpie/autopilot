import { appendFile, writeFile, readFile } from "node:fs/promises";
import type {
  TaskConfig,
  TaskRunState,
  AgentResult,
} from "../core/types.js";

/**
 * Session changelog — concise, human-readable, no output blobs.
 * Full agent output is in the event log (events.jsonl) and state store.
 */
export class ChangelogReporter {
  constructor(private filePath: string) {}

  async init(sessionId: string): Promise<void> {
    const header = [
      `# Autopilot Session: ${sessionId}`,
      `Started: ${new Date().toISOString()}`,
      "",
      "---",
      "",
    ].join("\n");

    try {
      await readFile(this.filePath, "utf-8");
      await appendFile(
        this.filePath,
        `\n\n${"=".repeat(60)}\n\n${header}`
      );
    } catch {
      await writeFile(this.filePath, header);
    }
  }

  async logTaskStart(task: TaskConfig): Promise<void> {
    await this.append(
      `**${this.ts()}** START ${task.id} — ${task.title} [${task.track}/${task.kind}]`
    );
  }

  async logTaskResult(
    task: TaskConfig,
    state: TaskRunState,
    result: AgentResult
  ): Promise<void> {
    const status = result.success ? "OK" : "FAIL";
    const duration = (result.duration / 1000).toFixed(1);

    await this.append(
      `**${this.ts()}** ${status} ${task.id} — ${duration}s, ${result.record.provider}[${result.record.permissionProfile}], exit=${result.exitCode}` +
        (result.error ? `, error: ${result.error.slice(0, 120)}` : "")
    );
  }

  async logValidation(
    taskId: string,
    mode: string,
    passed: boolean,
    _output: string,
    summary?: string,
    recommendation?: string
  ): Promise<void> {
    let line = `**${this.ts()}** VALIDATE ${passed ? "PASS" : "FAIL"} ${taskId} (${mode})`;
    if (!passed && summary) {
      line += ` — ${summary}`;
    }
    if (!passed && recommendation) {
      line += ` [${recommendation}]`;
    }
    await this.append(line);
  }

  async logDiffSummary(
    taskId: string,
    diffSummary: string
  ): Promise<void> {
    if (!diffSummary) return;
    await this.append(
      `**${this.ts()}** DIFF ${taskId}\n\`\`\`\n${diffSummary}\n\`\`\``
    );
  }

  async logUnlocked(
    taskId: string,
    unlocked: string[]
  ): Promise<void> {
    if (unlocked.length === 0) return;
    await this.append(
      `**${this.ts()}** UNLOCKED by ${taskId}: ${unlocked.join(", ")}`
    );
  }

  async logMessage(message: string): Promise<void> {
    await this.append(`**${this.ts()}** ${message}`);
  }

  async logSummary(
    total: number,
    done: number,
    failed: number,
    blocked: number
  ): Promise<void> {
    await this.append(
      [
        "",
        `## Summary (${new Date().toISOString()})`,
        `Done: ${done}/${total} | Failed: ${failed} | Blocked: ${blocked} | Remaining: ${total - done - failed - blocked}`,
        "",
      ].join("\n")
    );
  }

  private ts(): string {
    return new Date().toISOString().slice(11, 19);
  }

  private async append(text: string): Promise<void> {
    await appendFile(this.filePath, text + "\n");
  }
}
