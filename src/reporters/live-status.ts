import { writeFile } from "node:fs/promises";
import type {
  ProjectConfig,
  TaskConfig,
  TaskRunState,
  AgentProvider,
  PermissionProfile,
} from "../core/types.js";
import { findReadyTasks, deriveEpicState } from "../core/readiness.js";
import type { Store } from "../storage/store.js";

const STATUS_FILE = "LIVE_STATUS.md";

export class LiveStatusWriter {
  private filePath: string;

  constructor(rootDir: string) {
    this.filePath = `${rootDir}/${STATUS_FILE}`;
  }

  async write(
    config: ProjectConfig,
    store: Store,
    event: string,
    extra?: {
      currentTask?: TaskConfig;
      provider?: AgentProvider;
      profile?: PermissionProfile;
      command?: string;
    }
  ): Promise<void> {
    const allStates = store.getAllTasks();
    const now = new Date().toISOString();

    const done = config.tasks.filter((t) =>
      ["done", "committed"].includes(allStates[t.id]?.state ?? "todo")
    );
    const failed = config.tasks.filter(
      (t) => allStates[t.id]?.state === "failed"
    );
    const blocked = config.tasks.filter(
      (t) => allStates[t.id]?.state === "blocked"
    );
    const inProgress = config.tasks.filter(
      (t) => allStates[t.id]?.state === "in_progress"
    );
    const ready = findReadyTasks(config.tasks, allStates);

    const lines: string[] = [
      `# Autopilot Live Status`,
      ``,
      `**Last event:** ${event}`,
      `**Last update:** ${now}`,
      `**Session:** ${store.getSessionId()}`,
      ``,
    ];

    if (extra?.currentTask) {
      const t = extra.currentTask;
      const epic = config.epics.find((e) => e.id === t.epicId);
      lines.push(
        `## Current Task`,
        `- **ID:** ${t.id}`,
        `- **Title:** ${t.title}`,
        `- **Epic:** ${epic?.title ?? t.epicId}`,
        `- **Track:** ${t.track} | Kind: ${t.kind}`,
        `- **Provider:** ${extra.provider ?? "default"} [${extra.profile ?? "default"}]`,
        extra.command ? `- **Command:** \`${extra.command}\`` : "",
        ``
      );
    }

    lines.push(
      `## Progress`,
      `- Total: ${config.tasks.length}`,
      `- Done: ${done.length}`,
      `- In Progress: ${inProgress.length}`,
      `- Failed: ${failed.length}`,
      `- Blocked: ${blocked.length}`,
      `- Ready: ${ready.length}`,
      ``
    );

    if (done.length > 0) {
      lines.push(
        `## Completed Tasks`,
        ...done.map((t) => `- ${t.id}: ${t.title}`),
        ``
      );
    }

    if (failed.length > 0) {
      lines.push(
        `## Failed Tasks`,
        ...failed.map((t) => {
          const s = allStates[t.id];
          return `- ${t.id}: ${t.title} — ${s?.error ?? "unknown"}`;
        }),
        ``
      );
    }

    if (ready.length > 0) {
      lines.push(
        `## Next Ready`,
        ...ready
          .slice(0, 10)
          .map((t) => `- ${t.id} [${t.track}/${t.kind}]: ${t.title}`),
        ``
      );
    }

    try {
      await writeFile(this.filePath, lines.filter((l) => l !== undefined).join("\n"));
    } catch {
      // Non-fatal
    }
  }
}
