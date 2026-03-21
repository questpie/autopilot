import { appendFile, writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ProviderEvent, ProviderEventSink } from "./types.js";

/**
 * Per-session JSONL event log.
 * Writes to: ~/.qap/workspaces/<ws>/projects/<prj>/sessions/<session-id>.events.jsonl
 *
 * This is the primary source for live monitoring and session replay.
 */
export class SessionEventLog {
  private filePath: string;
  private initialized = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Create a ProviderEventSink bound to this log */
  createSink(): ProviderEventSink {
    return (event: ProviderEvent) => {
      this.write(event);
    };
  }

  async write(event: ProviderEvent): Promise<void> {
    const line = JSON.stringify(event) + "\n";
    try {
      if (!this.initialized) {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.initialized = true;
      }
      await appendFile(this.filePath, line);
    } catch {
      try {
        await writeFile(this.filePath, line);
        this.initialized = true;
      } catch {
        // Non-fatal — don't crash the runner
      }
    }
  }

  /** Read all events from the log */
  async readAll(): Promise<ProviderEvent[]> {
    if (!existsSync(this.filePath)) return [];
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ProviderEvent);
    } catch {
      return [];
    }
  }

  /**
   * Tail the event log, calling callback for each new event.
   * Returns an AbortController to stop tailing.
   */
  tail(callback: (event: ProviderEvent) => void): AbortController {
    const ac = new AbortController();
    let offset = 0;

    const poll = async () => {
      if (ac.signal.aborted) return;

      try {
        if (!existsSync(this.filePath)) {
          setTimeout(poll, 200);
          return;
        }

        const raw = await readFile(this.filePath, "utf-8");
        const lines = raw.split("\n").filter(Boolean);

        for (let i = offset; i < lines.length; i++) {
          try {
            const event = JSON.parse(lines[i]!) as ProviderEvent;
            callback(event);
          } catch {
            // Skip malformed lines
          }
        }
        offset = lines.length;
      } catch {
        // File might not exist yet
      }

      if (!ac.signal.aborted) {
        setTimeout(poll, 200);
      }
    };

    poll();
    return ac;
  }

  getPath(): string {
    return this.filePath;
  }
}

/**
 * Build the session event log path from workspace/project/session IDs.
 */
export function sessionEventLogPath(
  workspaceId: string,
  projectId: string,
  sessionId: string
): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
  return `${home}/.qap/workspaces/${workspaceId}/projects/${projectId}/sessions/${sessionId}.events.jsonl`;
}
