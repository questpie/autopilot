import { BRAND } from "../brand.js";
import type { LogViewMode, AggregatedEntry } from "../../events/aggregator.js";

interface LogPanelProps {
  width: number;
  height: number;
  logs: string[];
  title?: string;
  viewMode?: LogViewMode;
  /** Pre-aggregated entries (used when session events are processed) */
  aggregatedEntries?: AggregatedEntry[];
  /** Session ID displayed in header */
  sessionId?: string;
}

function kindColor(kind: AggregatedEntry["kind"]): string {
  switch (kind) {
    case "system": return BRAND.info;
    case "assistant": return BRAND.fg;
    case "tool": return BRAND.warning;
    case "validation": return BRAND.purple;
    case "error": return BRAND.error;
    case "raw": return BRAND.fgDim;
  }
}

function kindLabel(kind: AggregatedEntry["kind"]): string {
  switch (kind) {
    case "system": return "SYS";
    case "assistant": return "AI ";
    case "tool": return "▸  ";
    case "validation": return "VAL";
    case "error": return "ERR";
    case "raw": return "RAW";
  }
}

export function LogPanel({
  width,
  height,
  logs,
  title,
  viewMode,
  aggregatedEntries,
  sessionId,
}: LogPanelProps) {
  const modeLabel = viewMode ? ` ${viewMode.toUpperCase()}` : "";
  const sessionLabel = sessionId ? ` ${sessionId.slice(0, 8)}` : "";
  const panelTitle = title ?? ` LOG${sessionLabel}${modeLabel} `;

  // If we have aggregated entries, render them with colors
  if (aggregatedEntries && aggregatedEntries.length > 0) {
    return (
      <box
        width={width}
        height={height}
        border
        borderStyle="single"
        borderColor={BRAND.border}
        title={panelTitle}
        titleAlignment="left"
        backgroundColor={BRAND.card}
        flexDirection="column"
      >
        <scrollbox>
          {aggregatedEntries.map((entry, i) => (
            <box key={i} flexDirection="row" gap={1}>
              <text fg={BRAND.fgDim}>{`[${entry.ts}]`}</text>
              <text fg={kindColor(entry.kind)}>
                {entry.kind === "assistant" ? (
                  <strong>{kindLabel(entry.kind)}</strong>
                ) : (
                  kindLabel(entry.kind)
                )}
              </text>
              <text fg={kindColor(entry.kind)}>
                {entry.text.length > width - 20
                  ? entry.text.slice(0, width - 23) + "..."
                  : entry.text}
              </text>
            </box>
          ))}
          {/* Mode toggle hint */}
          {viewMode && (
            <box paddingTop={1} paddingLeft={1}>
              <text fg={BRAND.fgMuted}>
                {`[c]onversation [a]ctivity [r]aw — current: ${viewMode}`}
              </text>
            </box>
          )}
        </scrollbox>
      </box>
    );
  }

  // Fallback: plain string logs
  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.border}
      title={panelTitle}
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      <scrollbox>
        {logs.map((line, i) => (
          <text key={i} fg={BRAND.fgDim}>
            {line}
          </text>
        ))}
      </scrollbox>
    </box>
  );
}
