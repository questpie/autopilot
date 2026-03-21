import { BRAND } from "../brand.js";
import type { SessionMeta } from "../../workspace/types.js";

interface SessionDetailPanelProps {
  width: number;
  height: number;
  session: SessionMeta;
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

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <box flexDirection="row" gap={1}>
      <text fg={BRAND.fgDim}>{label.padEnd(14)}</text>
      <text fg={color ?? BRAND.fg}>{value}</text>
    </box>
  );
}

export function SessionDetailPanel({
  width,
  height,
  session,
}: SessionDetailPanelProps) {
  const s = session;
  const duration =
    s.finishedAt && s.startedAt
      ? `${((new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 1000).toFixed(1)}s`
      : s.status === "running"
        ? "running..."
        : "—";

  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.purple}
      title={` SESSION ${s.id.slice(0, 8)} `}
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      <scrollbox>
        {/* Summary section */}
        <box flexDirection="column" paddingLeft={1} paddingTop={1}>
          <box flexDirection="row" gap={1} alignItems="center">
            <text fg={statusColor(s.status)}>
              {`${statusIcon(s.status)} ${s.status.toUpperCase()}`}
            </text>
            <text fg={BRAND.fgDim}>{`(${duration})`}</text>
          </box>

          <text fg={BRAND.fgMuted}>{""}</text>

          <Row label="ID" value={s.id} />
          <Row label="Started" value={s.startedAt.slice(0, 19).replace("T", " ")} />
          {s.finishedAt && (
            <Row label="Finished" value={s.finishedAt.slice(0, 19).replace("T", " ")} />
          )}
          <Row label="Provider" value={s.provider} color={BRAND.info} />
          {s.backend && <Row label="Backend" value={s.backend} />}
          {s.triggerAction && (
            <Row label="Triggered by" value={s.triggerAction} color={BRAND.purple} />
          )}
          {s.currentTaskId && (
            <Row label="Current task" value={s.currentTaskId} color={BRAND.info} />
          )}
        </box>

        {/* Tasks section */}
        <box flexDirection="column" paddingLeft={1} paddingTop={1}>
          <text fg={BRAND.purple}>
            <strong>TASKS</strong>
          </text>
          <box flexDirection="row" gap={2}>
            <text fg={BRAND.success}>{`${s.tasksCompleted} completed`}</text>
            <text fg={BRAND.error}>{`${s.tasksFailed} failed`}</text>
            <text fg={BRAND.fgDim}>{`${s.taskCount} total`}</text>
          </box>

          {s.taskCount > 0 && (
            <box paddingTop={1}>
              <box
                width={Math.min(width - 6, 40)}
                height={1}
                flexDirection="row"
              >
                {s.tasksCompleted > 0 && (
                  <box
                    width={Math.max(1, Math.round((s.tasksCompleted / s.taskCount) * Math.min(width - 6, 40)))}
                    height={1}
                    backgroundColor={BRAND.success}
                  >
                    <text fg="#000000">{""}</text>
                  </box>
                )}
                {s.tasksFailed > 0 && (
                  <box
                    width={Math.max(1, Math.round((s.tasksFailed / s.taskCount) * Math.min(width - 6, 40)))}
                    height={1}
                    backgroundColor={BRAND.error}
                  >
                    <text fg="#000000">{""}</text>
                  </box>
                )}
              </box>
            </box>
          )}
        </box>

        {/* Execution phase */}
        {s.currentPhase && (
          <box flexDirection="column" paddingLeft={1} paddingTop={1}>
            <text fg={BRAND.purple}>
              <strong>PHASE</strong>
            </text>
            <text fg={BRAND.fg}>{s.currentPhase}</text>
            {s.activeTool && (
              <text fg={BRAND.fgDim}>{`Active tool: ${s.activeTool}`}</text>
            )}
          </box>
        )}

        {/* Notes */}
        {s.notes && s.notes.length > 0 && (
          <box flexDirection="column" paddingLeft={1} paddingTop={1}>
            <text fg={BRAND.purple}>
              <strong>NOTES</strong>
            </text>
            {s.notes.map((note, i) => (
              <text key={i} fg={BRAND.fgDim}>
                {`  ${note}`}
              </text>
            ))}
          </box>
        )}

        {/* Last update */}
        {s.lastAssistantUpdate && (
          <box flexDirection="column" paddingLeft={1} paddingTop={1}>
            <text fg={BRAND.purple}>
              <strong>LAST UPDATE</strong>
            </text>
            <text fg={BRAND.fgDim}>{s.lastAssistantUpdate.slice(0, 120)}</text>
          </box>
        )}

        {/* Navigation hint */}
        <box paddingLeft={1} paddingTop={1}>
          <text fg={BRAND.fgMuted}>
            {"Press 2 or /sessions to go back"}
          </text>
        </box>
      </scrollbox>
    </box>
  );
}
