import { BRAND } from "../brand.js";
import type { SessionMeta } from "../../workspace/types.js";

interface SessionsPanelProps {
  width: number;
  height: number;
  sessions: SessionMeta[];
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return BRAND.success;
    case "failed":
      return BRAND.error;
    case "running":
      return BRAND.info;
    case "aborted":
      return BRAND.warning;
    default:
      return BRAND.fgDim;
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    case "running":
      return "▸";
    case "aborted":
      return "#";
    default:
      return "·";
  }
}

export function SessionsPanel({
  width,
  height,
  sessions,
}: SessionsPanelProps) {
  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.border}
      title=" SESSIONS "
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      {sessions.length === 0 ? (
        <box padding={1}>
          <text fg={BRAND.fgDim}>No sessions yet</text>
          <text fg={BRAND.fgMuted}>{""}</text>
          <text fg={BRAND.fgMuted}>
            Sessions are created when you run tasks.
          </text>
        </box>
      ) : (
        <scrollbox>
          {/* Header */}
          <box flexDirection="row" gap={1}>
            <text fg={BRAND.fgMuted}>
              {"  "}
              {"ID".padEnd(10)}
              {"Status".padEnd(12)}
              {"Started".padEnd(21)}
              {"Tasks"}
            </text>
          </box>
          {sessions.map((s) => (
            <box key={s.id} flexDirection="row" gap={1}>
              <text fg={statusColor(s.status)}>
                {statusIcon(s.status)}
              </text>
              <text fg={BRAND.purple}>
                {s.id.slice(0, 8).padEnd(10)}
              </text>
              <text fg={statusColor(s.status)}>
                {s.status.padEnd(12)}
              </text>
              <text fg={BRAND.fgDim}>
                {s.startedAt.slice(0, 19).padEnd(21)}
              </text>
              <text fg={BRAND.fg}>
                {`${s.tasksCompleted}/${s.taskCount}`}
                {s.tasksFailed > 0 ? ` (${s.tasksFailed} failed)` : ""}
              </text>
            </box>
          ))}
        </scrollbox>
      )}
    </box>
  );
}
