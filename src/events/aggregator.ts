import type { ProviderEvent } from "./types.js";

// ── Log View Modes ──────────────────────────────────────────

export type LogViewMode = "conversation" | "activity" | "raw";

export interface AggregatedEntry {
  ts: string;
  kind: "system" | "assistant" | "tool" | "validation" | "error" | "raw";
  text: string;
}

// ── Event Aggregator ────────────────────────────────────────

/**
 * Aggregates raw provider events into human-readable entries
 * based on the selected view mode.
 */
export function aggregateEvents(
  events: ProviderEvent[],
  mode: LogViewMode
): AggregatedEntry[] {
  if (mode === "raw") {
    return events.map(rawEntry);
  }

  const entries: AggregatedEntry[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i]!;

    switch (event.type) {
      case "session-start": {
        const taskId = event.taskId ? ` (task: ${event.taskId})` : "";
        entries.push({
          ts: fmtTs(event.ts),
          kind: "system",
          text: `Session started${taskId}`,
        });
        i++;
        break;
      }

      case "session-end": {
        const p = event.payload;
        const dur = p.duration ? ` ${(p.duration / 1000).toFixed(1)}s` : "";
        entries.push({
          ts: fmtTs(event.ts),
          kind: "system",
          text: `Session ended (${p.reason ?? "unknown"}${dur})`,
        });
        i++;
        break;
      }

      case "assistant-text-delta": {
        // Fold consecutive text deltas into one message
        let text = "";
        while (i < events.length && events[i]!.type === "assistant-text-delta") {
          text += (events[i]!.payload as { text: string }).text;
          i++;
        }
        if (text.trim()) {
          entries.push({
            ts: fmtTs(event.ts),
            kind: "assistant",
            text: text.trim(),
          });
        }
        break;
      }

      case "assistant-message": {
        entries.push({
          ts: fmtTs(event.ts),
          kind: "assistant",
          text: (event.payload as { text: string }).text,
        });
        i++;
        break;
      }

      case "tool-call-start": {
        if (mode === "conversation") {
          // Skip tool details in conversation mode — just advance
          i++;
          break;
        }
        // Activity mode: group consecutive tool calls with descriptions
        const toolGroup = groupToolCalls(events, i);
        entries.push({
          ts: fmtTs(event.ts),
          kind: "tool",
          text: toolGroup.summary,
        });
        i = toolGroup.nextIndex;
        break;
      }

      case "tool-call-update": {
        // Skip in conversation mode, show in activity
        if (mode === "activity") {
          const p = event.payload as { toolName: string; progress?: string };
          entries.push({
            ts: fmtTs(event.ts),
            kind: "tool",
            text: `${p.toolName}: ${p.progress ?? "..."}`,
          });
        }
        i++;
        break;
      }

      case "tool-call-end": {
        // Already handled by groupToolCalls or skip
        if (mode === "activity") {
          const p = event.payload as { toolName: string };
          entries.push({
            ts: fmtTs(event.ts),
            kind: "tool",
            text: `\u2713 ${p.toolName}`,
          });
        }
        i++;
        break;
      }

      case "tool-call-fail": {
        const p = event.payload as { toolName: string; error: string };
        entries.push({
          ts: fmtTs(event.ts),
          kind: "error",
          text: `\u2717 ${p.toolName}: ${p.error.slice(0, 120)}`,
        });
        i++;
        break;
      }

      case "notification": {
        const p = event.payload as { message: string; level?: string };
        // Detect validation notifications
        const isValidation =
          p.message.toLowerCase().includes("validation") ||
          p.message.toLowerCase().includes("finding");
        entries.push({
          ts: fmtTs(event.ts),
          kind: isValidation ? "validation" : "system",
          text: p.message,
        });
        i++;
        break;
      }

      case "subagent-start": {
        if (mode === "activity") {
          const p = event.payload as { agentId: string; agentType?: string; description?: string };
          const label = p.description ?? p.agentType ?? p.agentId;
          // Look ahead for the matching subagent-stop to show as a range
          const stopIdx = findSubagentStop(events, i, p.agentId);
          if (stopIdx >= 0) {
            const stopEvent = events[stopIdx]!;
            const lastTools = collectSubagentTools(events, i + 1, stopIdx);
            entries.push({
              ts: fmtTs(event.ts),
              kind: "tool",
              text: `\u25B6 SUBAGENT: ${label}`,
            });
            if (lastTools.length > 0) {
              entries.push({
                ts: fmtTs(event.ts),
                kind: "tool",
                text: `  last tools: ${lastTools.slice(-2).join(", ")}`,
              });
            }
            i = stopIdx + 1;
          } else {
            entries.push({
              ts: fmtTs(event.ts),
              kind: "tool",
              text: `\u25B6 SUBAGENT: ${label} (running)`,
            });
            i++;
          }
        } else {
          i++;
        }
        break;
      }

      case "subagent-stop": {
        // If we get here it wasn't consumed by subagent-start lookahead
        if (mode === "activity") {
          const p = event.payload as { agentId: string; result?: string };
          entries.push({
            ts: fmtTs(event.ts),
            kind: "tool",
            text: `\u25A0 SUBAGENT done: ${p.agentId}${p.result ? ` — ${p.result.slice(0, 80)}` : ""}`,
          });
        }
        i++;
        break;
      }

      case "result": {
        const p = event.payload as { text: string; stopReason?: string };
        entries.push({
          ts: fmtTs(event.ts),
          kind: "system",
          text: `Result (${p.stopReason ?? "done"}): ${p.text.slice(0, 200)}`,
        });
        i++;
        break;
      }

      case "error": {
        const p = event.payload as { message: string };
        entries.push({
          ts: fmtTs(event.ts),
          kind: "error",
          text: p.message,
        });
        i++;
        break;
      }

      default: {
        if (mode === "activity") {
          entries.push(rawEntry(event));
        }
        i++;
        break;
      }
    }
  }

  return entries;
}

// ── Tool Call Grouping ──────────────────────────────────────

interface ToolGroup {
  summary: string;
  nextIndex: number;
}

function groupToolCalls(events: ProviderEvent[], startIdx: number): ToolGroup {
  const toolCounts: Record<string, number> = {};
  const toolLabels: Record<string, string> = {};
  let i = startIdx;

  // Collect consecutive tool-call-start events (with interleaved end/update)
  while (i < events.length) {
    const e = events[i]!;
    if (e.type === "tool-call-start") {
      const p = e.payload as { toolName: string; input?: unknown };
      const name = p.toolName;
      toolCounts[name] = (toolCounts[name] ?? 0) + 1;
      // Extract a brief label from tool input
      if (!toolLabels[name] && p.input) {
        toolLabels[name] = extractToolLabel(name, p.input);
      }
      i++;
    } else if (
      e.type === "tool-call-end" ||
      e.type === "tool-call-update"
    ) {
      i++;
    } else {
      break;
    }
  }

  const parts = Object.entries(toolCounts).map(([name, count]) => {
    const label = toolLabels[name];
    const countSuffix = count > 1 ? ` (${count}x)` : "";
    return label ? `${name}${countSuffix} ${label}` : `${name}${countSuffix}`;
  });

  return {
    summary: `\u25B8 ${parts.join(", ")}`,
    nextIndex: i,
  };
}

/**
 * Extract a short human-readable label from tool input.
 * E.g., Read → file path, Edit → file path, Bash → command snippet.
 */
function extractToolLabel(toolName: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case "Read":
      return obj.file_path ? shortenPath(String(obj.file_path)) : "";
    case "Edit":
    case "Write":
      return obj.file_path ? shortenPath(String(obj.file_path)) : "";
    case "Glob":
      return obj.pattern ? String(obj.pattern).slice(0, 40) : "";
    case "Grep":
      return obj.pattern ? `"${String(obj.pattern).slice(0, 30)}"` : "";
    case "Bash":
      return obj.command ? String(obj.command).slice(0, 40) : "";
    case "Agent":
      return obj.description ? String(obj.description).slice(0, 50) : "";
    default:
      return "";
  }
}

function shortenPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join("/")}`;
}

/**
 * Find the matching subagent-stop event for a given agentId.
 */
function findSubagentStop(
  events: ProviderEvent[],
  startIdx: number,
  agentId: string
): number {
  for (let i = startIdx + 1; i < events.length; i++) {
    const e = events[i]!;
    if (
      e.type === "subagent-stop" &&
      (e.payload as { agentId: string }).agentId === agentId
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Collect tool names used between start and stop indices (subagent scope).
 */
function collectSubagentTools(
  events: ProviderEvent[],
  startIdx: number,
  endIdx: number
): string[] {
  const tools: string[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const e = events[i]!;
    if (e.type === "tool-call-start") {
      tools.push((e.payload as { toolName: string }).toolName);
    }
  }
  return tools;
}

// ── Formatting Helpers ──────────────────────────────────────

function fmtTs(ts: string): string {
  return ts?.slice(11, 19) ?? "";
}

function rawEntry(event: ProviderEvent): AggregatedEntry {
  const payload = "payload" in event ? event.payload : {};
  return {
    ts: fmtTs(event.ts),
    kind: "raw",
    text: `${event.type}: ${JSON.stringify(payload).slice(0, 150)}`,
  };
}

// ── CLI Formatting ──────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
} as const;

/**
 * Format an aggregated entry for CLI output.
 */
export function formatEntry(entry: AggregatedEntry): string {
  const ts = `${C.dim}[${entry.ts}]${C.reset}`;

  switch (entry.kind) {
    case "system":
      return `${ts} ${C.cyan}SYSTEM${C.reset}  ${entry.text}`;
    case "assistant":
      return `${ts} ${C.white}${C.bold}ASSISTANT${C.reset}\n  ${entry.text.replace(/\n/g, "\n  ")}`;
    case "tool":
      return `${ts} ${C.yellow}TOOL${C.reset}    ${entry.text}`;
    case "validation":
      return `${ts} ${C.magenta}VALID${C.reset}   ${entry.text}`;
    case "error":
      return `${ts} ${C.red}ERROR${C.reset}   ${entry.text}`;
    case "raw":
      return `${ts} ${C.gray}${entry.text}${C.reset}`;
  }
}
