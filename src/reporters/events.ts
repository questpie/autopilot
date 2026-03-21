import { appendFile, writeFile } from "node:fs/promises";
import type { AgentProvider, PermissionProfile } from "../core/types.js";

export interface AutopilotEvent {
  ts: string;
  event: string;
  taskId?: string;
  epicId?: string;
  provider?: AgentProvider;
  profile?: PermissionProfile;
  duration?: number;
  exitCode?: number;
  error?: string;
  unlocked?: string[];
  diffSummary?: string;
  detail?: string;
}

/**
 * Structured JSONL event log. One JSON object per line.
 * Designed for machine consumption (TUI, web, grep).
 */
export class EventLog {
  constructor(private filePath: string) {}

  async emit(event: AutopilotEvent): Promise<void> {
    const line = JSON.stringify(event) + "\n";
    try {
      await appendFile(this.filePath, line);
    } catch {
      // First write — file doesn't exist yet
      await writeFile(this.filePath, line);
    }
  }
}
