import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { BRAND } from "../brand.js";
import type { SessionMeta } from "../../workspace/types.js";

interface SessionsPanelProps {
  width: number;
  height: number;
  sessions: SessionMeta[];
  onSelect?: (sessionId: string) => void;
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

function formatDuration(session: SessionMeta): string {
  if (!session.finishedAt) return session.status === "running" ? "running" : "—";
  const ms = new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime();
  return ms < 60000 ? `${(ms / 1000).toFixed(0)}s` : `${(ms / 60000).toFixed(1)}m`;
}

export function SessionsPanel({
  width,
  height,
  sessions,
  onSelect,
}: SessionsPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useKeyboard((key) => {
    if (sessions.length === 0) return;
    if (key.name === "up" || key.name === "k") {
      setSelectedIdx((prev) => (prev > 0 ? prev - 1 : sessions.length - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setSelectedIdx((prev) => (prev < sessions.length - 1 ? prev + 1 : 0));
    }
    if (key.name === "return" && onSelect && sessions[selectedIdx]) {
      onSelect(sessions[selectedIdx]!.id);
    }
  });

  if (sessions.length === 0) {
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
        padding={1}
      >
        <text fg={BRAND.fgDim}>No sessions yet.</text>
        <text fg={BRAND.fgMuted}>{""}</text>
        <text fg={BRAND.fg}>Sessions are created when you run tasks:</text>
        <text fg={BRAND.fgMuted}>{""}</text>
        <text fg={BRAND.purple}>  /run           Run next ready task</text>
        <text fg={BRAND.purple}>  /run-next      Run next ready task</text>
        <text fg={BRAND.purple}>  {"  /run-task <id> Run a specific task"}</text>
        <text fg={BRAND.fgMuted}>{""}</text>
        <text fg={BRAND.fgDim}>Each run creates a new session with its own history.</text>
      </box>
    );
  }

  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.border}
      title={` SESSIONS (${sessions.length}) `}
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      <scrollbox>
        {/* Header */}
        <box flexDirection="row" gap={1}>
          <text fg={BRAND.fgMuted}>
            {"  "}
            {"ID".padEnd(10)}
            {"Status".padEnd(12)}
            {"Action".padEnd(10)}
            {"Started".padEnd(21)}
            {"Duration".padEnd(10)}
            {"Tasks"}
          </text>
        </box>
        {sessions.map((s, i) => (
          <box
            key={s.id}
            flexDirection="row"
            gap={1}
            backgroundColor={i === selectedIdx ? BRAND.surface : undefined}
          >
            <text fg={statusColor(s.status)}>
              {i === selectedIdx ? ">" : " "}{statusIcon(s.status)}
            </text>
            <text fg={BRAND.purple}>
              {i === selectedIdx ? (
                <strong>{s.id.slice(0, 8).padEnd(10)}</strong>
              ) : (
                s.id.slice(0, 8).padEnd(10)
              )}
            </text>
            <text fg={statusColor(s.status)}>
              {s.status.padEnd(12)}
            </text>
            <text fg={BRAND.fgDim}>
              {(s.triggerAction ?? "—").padEnd(10)}
            </text>
            <text fg={BRAND.fgDim}>
              {s.startedAt.slice(0, 19).padEnd(21)}
            </text>
            <text fg={BRAND.fgDim}>
              {formatDuration(s).padEnd(10)}
            </text>
            <text fg={BRAND.fg}>
              {`${s.tasksCompleted}/${s.taskCount}`}
              {s.tasksFailed > 0 ? ` (${s.tasksFailed} failed)` : ""}
            </text>
          </box>
        ))}

        {/* Navigation hint */}
        <box paddingTop={1} paddingLeft={1}>
          <text fg={BRAND.fgMuted}>
            {"j/k or arrows to navigate · Enter to view details · /session show <id>"}
          </text>
        </box>
      </scrollbox>
    </box>
  );
}
